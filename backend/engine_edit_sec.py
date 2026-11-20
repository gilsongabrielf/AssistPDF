"""Edit PDF (5) & Security/Compare (5) tools — including true permanent LGPD Redaction."""
from __future__ import annotations

import base64
import difflib
import io
import re
from typing import Any, Dict, List, Optional, Tuple

import pypdfium2 as pdfium
from PIL import Image, ImageChops, ImageDraw
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas

from engine_core import open_reader


def _hex_to_rgb(hex_color: str) -> Tuple[float, float, float]:
    h = (hex_color or "#1E293B").lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    if len(h) != 6:
        return (0.12, 0.16, 0.23)
    return (int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0)


def _hex_to_rgb255(hex_color: str) -> Tuple[int, int, int]:
    r, g, b = _hex_to_rgb(hex_color)
    return (int(r * 255), int(g * 255), int(b * 255))


# ==================== EDIT PDF (5 TOOLS) ====================

def rotate_pdf(pdf_bytes: bytes, angle: int = 90, per_page: Optional[Dict[str, int]] = None) -> bytes:
    reader = open_reader(pdf_bytes)
    writer = PdfWriter()
    for idx, page in enumerate(reader.pages):
        added = writer.add_page(page)
        if per_page is not None:
            rot = int(per_page.get(str(idx), 0)) % 360
        else:
            rot = int(angle) % 360
        if rot:
            added.rotate(rot)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def add_page_numbers(
    pdf_bytes: bytes,
    position: str = "bottom-center",
    template: str = "Página {n} de {total}",
    start_number: int = 1,
    from_page: int = 1,
    to_page: Optional[int] = None,
    font_size: int = 11,
    color_hex: str = "#334155",
    margin: int = 28,
) -> bytes:
    reader = open_reader(pdf_bytes)
    writer = PdfWriter()
    total = len(reader.pages)
    end_p = to_page if (to_page and to_page > 0) else total
    r, g, b = _hex_to_rgb(color_hex)

    for idx, page in enumerate(reader.pages):
        added = writer.add_page(page)
        p_num = idx + 1
        if from_page <= p_num <= end_p:
            w = float(added.mediabox.width)
            h = float(added.mediabox.height)
            display_n = start_number + (p_num - from_page)
            label = template.replace("{n}", str(display_n)).replace("{total}", str(total))

            ov_buf = io.BytesIO()
            c = rl_canvas.Canvas(ov_buf, pagesize=(w, h))
            c.setFillColorRGB(r, g, b)
            c.setFont("Helvetica", max(6, min(font_size, 48)))

            parts = position.split("-")
            v_pos = parts[0] if len(parts) > 0 else "bottom"
            h_pos = parts[1] if len(parts) > 1 else "center"

            if v_pos == "top":
                y = h - margin - font_size * 0.5
            elif v_pos == "middle":
                y = h / 2.0
            else:
                y = margin

            if h_pos == "left":
                c.drawString(margin, y, label)
            elif h_pos == "right":
                c.drawRightString(w - margin, y, label)
            else:
                c.drawCentredString(w / 2.0, y, label)

            c.save()
            ov_reader = PdfReader(io.BytesIO(ov_buf.getvalue()))
            added.merge_page(ov_reader.pages[0])

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def add_watermark(
    pdf_bytes: bytes,
    wm_type: str = "text",
    text: str = "USO INTERNO HOSPITALAR",
    image_bytes: Optional[bytes] = None,
    position: str = "middle-center",
    opacity: float = 0.28,
    rotation: int = 45,
    font_size: int = 38,
    color_hex: str = "#0D9488",
    mosaic: bool = False,
    from_page: int = 1,
    to_page: Optional[int] = None,
) -> bytes:
    reader = open_reader(pdf_bytes)
    writer = PdfWriter()
    total = len(reader.pages)
    end_p = to_page if (to_page and to_page > 0) else total
    r, g, b = _hex_to_rgb(color_hex)
    alpha = max(0.05, min(float(opacity), 1.0))

    pil_img = None
    if wm_type == "image" and image_bytes:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        # Bake alpha into RGBA image for crisp PDF transparency
        r_ch, g_ch, b_ch, a_ch = pil_img.split()
        a_ch = a_ch.point(lambda p: int(p * alpha))
        pil_img = Image.merge("RGBA", (r_ch, g_ch, b_ch, a_ch))

    def _draw_one(c: rl_canvas.Canvas, cx: float, cy: float, page_w: float) -> None:
        c.saveState()
        c.translate(cx, cy)
        c.rotate(rotation)
        if wm_type == "image" and pil_img is not None:
            iw, ih = pil_img.size
            target_w = min(page_w * 0.42, float(font_size) * 5.0)
            ratio = target_w / max(iw, 1)
            dw, dh = iw * ratio, ih * ratio
            buf = io.BytesIO()
            pil_img.save(buf, format="PNG")
            buf.seek(0)
            c.drawImage(ImageReader(buf), -dw / 2.0, -dh / 2.0, width=dw, height=dh, mask="auto")
        else:
            c.setFillColorRGB(r, g, b, alpha=alpha)
            c.setFont("Helvetica-Bold", max(10, min(font_size, 120)))
            c.drawCentredString(0, -font_size * 0.3, text or "CONFIDENCIAL")
        c.restoreState()

    for idx, page in enumerate(reader.pages):
        added = writer.add_page(page)
        p_num = idx + 1
        if from_page <= p_num <= end_p:
            w = float(added.mediabox.width)
            h = float(added.mediabox.height)
            ov_buf = io.BytesIO()
            c = rl_canvas.Canvas(ov_buf, pagesize=(w, h))

            if mosaic:
                cols, rows = 3, 4
                for ri in range(rows):
                    for ci in range(cols):
                        cx = (ci + 0.5) * (w / cols)
                        cy = (ri + 0.5) * (h / rows)
                        _draw_one(c, cx, cy, w)
            else:
                parts = position.split("-")
                v_pos = parts[0] if len(parts) > 0 else "middle"
                h_pos = parts[1] if len(parts) > 1 else "center"
                cx = w * (0.2 if h_pos == "left" else (0.8 if h_pos == "right" else 0.5))
                cy = h * (0.82 if v_pos == "top" else (0.18 if v_pos == "bottom" else 0.5))
                _draw_one(c, cx, cy, w)

            c.save()
            ov_reader = PdfReader(io.BytesIO(ov_buf.getvalue()))
            added.merge_page(ov_reader.pages[0])

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def crop_pdf(
    pdf_bytes: bytes,
    x: float,
    y: float,
    width: float,
    height: float,
    apply_to: str = "all",
    target_page: int = 0,
) -> bytes:
    """Crop PDF using normalized coordinates (0..1) where (0,0) is TOP-LEFT."""
    reader = open_reader(pdf_bytes)
    writer = PdfWriter()
    nx = max(0.0, min(x, 0.98))
    ny = max(0.0, min(y, 0.98))
    nw = max(0.02, min(width, 1.0 - nx))
    nh = max(0.02, min(height, 1.0 - ny))

    for idx, page in enumerate(reader.pages):
        added = writer.add_page(page)
        if apply_to == "all" or idx == target_page:
            mb = added.mediabox
            llx, lly = float(mb.left), float(mb.bottom)
            pw, ph = float(mb.width), float(mb.height)

            new_llx = llx + nx * pw
            new_urx = llx + (nx + nw) * pw
            new_ury = lly + (1.0 - ny) * ph
            new_lly = lly + (1.0 - ny - nh) * ph

            rect = RectangleObject((new_llx, new_lly, new_urx, new_ury))
            added.cropbox = rect
            added.mediabox = rect

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def edit_pdf(pdf_bytes: bytes, annotations: List[Dict[str, Any]]) -> bytes:
    """Apply interactive annotations (text, rect, highlight, draw, image) to PDF pages.
    All coordinates are normalized (0..1) from TOP-LEFT of page.
    """
    reader = open_reader(pdf_bytes)
    writer = PdfWriter()

    by_page: Dict[int, List[Dict[str, Any]]] = {}
    for ann in annotations:
        p_idx = int(ann.get("page_index", 0))
        by_page.setdefault(p_idx, []).append(ann)

    for idx, page in enumerate(reader.pages):
        added = writer.add_page(page)
        items = by_page.get(idx, [])
        if items:
            w = float(added.mediabox.width)
            h = float(added.mediabox.height)
            ov_buf = io.BytesIO()
            c = rl_canvas.Canvas(ov_buf, pagesize=(w, h))

            for ann in items:
                atype = ann.get("type", "text")
                color_hex = ann.get("color", "#1E293B")
                r, g, b = _hex_to_rgb(color_hex)
                opacity = float(ann.get("opacity", 1.0))

                if atype == "text":
                    txt = str(ann.get("text", ""))
                    if not txt:
                        continue
                    px = float(ann.get("x", 0.1)) * w
                    py_top = float(ann.get("y", 0.1)) * h
                    fsize = float(ann.get("fontSize", 14))
                    bold = bool(ann.get("bold", False))
                    font_name = "Helvetica-Bold" if bold else "Helvetica"
                    c.saveState()
                    if ann.get("bgColor"):
                        br, bg_c, bb = _hex_to_rgb(ann["bgColor"])
                        tw = c.stringWidth(txt, font_name, fsize) + 8
                        c.setFillColorRGB(br, bg_c, bb, alpha=0.85)
                        c.rect(px - 4, h - py_top - fsize - 3, tw, fsize + 6, fill=1, stroke=0)
                    c.setFillColorRGB(r, g, b, alpha=opacity)
                    c.setFont(font_name, fsize)
                    for li, line in enumerate(txt.splitlines()):
                        c.drawString(px, h - py_top - fsize - li * (fsize * 1.25), line)
                    c.restoreState()

                elif atype in ("rect", "highlight"):
                    rx = float(ann.get("x", 0.1)) * w
                    ry_top = float(ann.get("y", 0.1)) * h
                    rw = float(ann.get("width", 0.2)) * w
                    rh = float(ann.get("height", 0.05)) * h
                    pdf_y = h - ry_top - rh
                    c.saveState()
                    if atype == "highlight":
                        c.setFillColorRGB(r, g, b, alpha=min(opacity, 0.38))
                        c.rect(rx, pdf_y, rw, rh, fill=1, stroke=0)
                    else:
                        fill_flag = 1 if ann.get("filled", False) else 0
                        c.setStrokeColorRGB(r, g, b, alpha=opacity)
                        c.setFillColorRGB(r, g, b, alpha=opacity * 0.25)
                        c.setLineWidth(float(ann.get("strokeWidth", 2)))
                        c.rect(rx, pdf_y, rw, rh, fill=fill_flag, stroke=1)
                    c.restoreState()

                elif atype == "draw":
                    pts = ann.get("points", [])
                    if len(pts) >= 2:
                        c.saveState()
                        c.setStrokeColorRGB(r, g, b, alpha=opacity)
                        c.setLineWidth(float(ann.get("strokeWidth", 2.5)))
                        c.setLineCap(1)
                        c.setLineJoin(1)
                        p = c.beginPath()
                        p.moveTo(float(pts[0]["x"]) * w, h - float(pts[0]["y"]) * h)
                        for pt in pts[1:]:
                            p.lineTo(float(pt["x"]) * w, h - float(pt["y"]) * h)
                        c.drawPath(p, stroke=1, fill=0)
                        c.restoreState()

                elif atype == "image":
                    data_url = str(ann.get("dataUrl", ""))
                    if "," in data_url:
                        raw_img = base64.b64decode(data_url.split(",", 1)[1])
                        ix = float(ann.get("x", 0.1)) * w
                        iy_top = float(ann.get("y", 0.1)) * h
                        iw = float(ann.get("width", 0.25)) * w
                        ih = float(ann.get("height", 0.15)) * h
                        pdf_y = h - iy_top - ih
                        c.drawImage(ImageReader(io.BytesIO(raw_img)), ix, pdf_y, width=iw, height=ih, mask="auto")

            c.save()
            ov_reader = PdfReader(io.BytesIO(ov_buf.getvalue()))
            added.merge_page(ov_reader.pages[0])

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# ==================== SECURITY & COMPARE (5 TOOLS) ====================

def unlock_pdf(pdf_bytes: bytes, password: str = "") -> bytes:
    reader = PdfReader(io.BytesIO(pdf_bytes), strict=False)
    if reader.is_encrypted:
        res = reader.decrypt(password or "")
        if res == 0:
            raise ValueError("Senha incorreta. Não foi possível desbloquear este PDF.")
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    if reader.metadata:
        try:
            writer.add_metadata({k: str(v) for k, v in reader.metadata.items() if isinstance(k, str)})
        except Exception:
            pass
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def protect_pdf(
    pdf_bytes: bytes,
    user_password: str,
    owner_password: Optional[str] = None,
    allow_print: bool = True,
    allow_copy: bool = False,
) -> bytes:
    if not user_password:
        raise ValueError("Informe uma senha para proteger o PDF.")
    reader = open_reader(pdf_bytes)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)

    # Standard PDF permission flags
    perms = 0
    if allow_print:
        perms |= (1 << 2) | (1 << 11)  # Print + High-res print
    if allow_copy:
        perms |= (1 << 4) | (1 << 9)   # Copy text + accessibility

    writer.encrypt(
        user_password=user_password,
        owner_password=owner_password or user_password,
        permissions_flag=perms,
        algorithm="AES-256",
    )
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def sign_pdf(pdf_bytes: bytes, signatures: List[Dict[str, Any]]) -> bytes:
    """Place drawn/typed/uploaded visual signatures + optional hospital credential label onto PDF pages."""
    reader = open_reader(pdf_bytes)
    writer = PdfWriter()
    by_page: Dict[int, List[Dict[str, Any]]] = {}
    for sig in signatures:
        p_idx = int(sig.get("page_index", 0))
        by_page.setdefault(p_idx, []).append(sig)

    for idx, page in enumerate(reader.pages):
        added = writer.add_page(page)
        sigs = by_page.get(idx, [])
        if sigs:
            w = float(added.mediabox.width)
            h = float(added.mediabox.height)
            ov_buf = io.BytesIO()
            c = rl_canvas.Canvas(ov_buf, pagesize=(w, h))

            for sig in sigs:
                data_url = str(sig.get("dataUrl", ""))
                if "," not in data_url:
                    continue
                raw_img = base64.b64decode(data_url.split(",", 1)[1])
                sx = float(sig.get("x", 0.5)) * w
                sy_top = float(sig.get("y", 0.75)) * h
                sw = float(sig.get("width", 0.28)) * w
                sh = float(sig.get("height", 0.1)) * h
                pdf_y = h - sy_top - sh

                c.drawImage(ImageReader(io.BytesIO(raw_img)), sx, pdf_y, width=sw, height=sh, mask="auto")

                caption = str(sig.get("caption", "")).strip()
                if caption:
                    c.setStrokeColorRGB(0.05, 0.58, 0.53)
                    c.setLineWidth(0.7)
                    c.line(sx, pdf_y - 2, sx + sw, pdf_y - 2)
                    c.setFillColorRGB(0.18, 0.24, 0.31)
                    c.setFont("Helvetica", 7.5)
                    for li, line in enumerate(caption.splitlines()[:3]):
                        c.drawString(sx, pdf_y - 11 - li * 9, line)

            c.save()
            ov_reader = PdfReader(io.BytesIO(ov_buf.getvalue()))
            added.merge_page(ov_reader.pages[0])

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


LGPD_PATTERNS: Dict[str, str] = {
    "cpf": r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b",
    "cnpj": r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b",
    "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    "phone": r"(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}|\d{4})-?\d{4}\b",
    "date": r"\b\d{2}/\d{2}/\d{4}\b",
}


def redact_pdf(
    pdf_bytes: bytes,
    boxes: List[Dict[str, Any]],
    auto_patterns: List[str],
    custom_terms: List[str],
    fill_color: str = "#000000",
) -> Tuple[bytes, int]:
    """TRUE PERMANENT LGPD REDACTION:
    Finds all manual boxes + auto-detected text boxes, renders affected pages to high-res
    raster, paints permanent solid opaque rectangles, and rebuilds those pages so underlying
    sensitive patient data is 100% physically removed and uncopyable.
    """
    reader = open_reader(pdf_bytes)
    doc = pdfium.PdfDocument(pdf_bytes)
    rgb = _hex_to_rgb255(fill_color)

    # Compile regexes for auto-redaction
    regex_list: List[re.Pattern[str]] = []
    for key in auto_patterns:
        pat = LGPD_PATTERNS.get(key)
        if pat:
            regex_list.append(re.compile(pat, re.IGNORECASE))
    for term in custom_terms:
        t = term.strip()
        if t:
            regex_list.append(re.compile(re.escape(t), re.IGNORECASE))

    manual_by_page: Dict[int, List[Dict[str, Any]]] = {}
    for b in boxes:
        pi = int(b.get("page_index", 0))
        manual_by_page.setdefault(pi, []).append(b)

    writer = PdfWriter()
    total_redactions = 0

    try:
        for idx, page in enumerate(reader.pages):
            p_boxes_norm: List[Tuple[float, float, float, float]] = []

            # 1. Manual boxes (normalized 0..1 from top-left)
            for b in manual_by_page.get(idx, []):
                nx = float(b.get("x", 0))
                ny = float(b.get("y", 0))
                nw = float(b.get("width", 0))
                nh = float(b.get("height", 0))
                if nw > 0 and nh > 0:
                    p_boxes_norm.append((nx, ny, nx + nw, ny + nh))

            # 2. Automatic LGPD regex / custom term detection via PDFium charboxes
            if regex_list and idx < len(doc):
                fp = doc[idx]
                pw, ph = fp.get_size()
                tp = fp.get_textpage()
                full_text = tp.get_text_range() or ""
                for rx in regex_list:
                    for m in rx.finditer(full_text):
                        start_i, end_i = m.start(), m.end()
                        xs0, ys0, xs1, ys1 = [], [], [], []
                        for ci in range(start_i, end_i):
                            try:
                                left, bottom, right, top = tp.get_charbox(ci)
                                if right > left and top > bottom:
                                    xs0.append(left)
                                    ys0.append(bottom)
                                    xs1.append(right)
                                    ys1.append(top)
                            except Exception:
                                continue
                        if xs0:
                            # Convert PDF bottom-left pts -> normalized top-left (0..1)
                            pad = 2.0
                            nx0 = max(0.0, (min(xs0) - pad) / max(pw, 1.0))
                            nx1 = min(1.0, (max(xs1) + pad) / max(pw, 1.0))
                            ny0 = max(0.0, (ph - (max(ys1) + pad)) / max(ph, 1.0))
                            ny1 = min(1.0, (ph - (min(ys0) - pad)) / max(ph, 1.0))
                            p_boxes_norm.append((nx0, ny0, nx1, ny1))
                tp.close()
                fp.close()

            if not p_boxes_norm:
                writer.add_page(page)
                continue

            total_redactions += len(p_boxes_norm)
            # Permanently flatten & redact page at crisp 200 DPI
            fp = doc[idx]
            w_pt, h_pt = fp.get_size()
            pil = fp.render(scale=200.0 / 72.0).to_pil().convert("RGB")
            fp.close()

            iw, ih = pil.size
            draw = ImageDraw.Draw(pil)
            for nx0, ny0, nx1, ny1 in p_boxes_norm:
                draw.rectangle(
                    [int(nx0 * iw), int(ny0 * ih), int(nx1 * iw), int(ny1 * ih)],
                    fill=rgb,
                )

            pbuf = io.BytesIO()
            c = rl_canvas.Canvas(pbuf, pagesize=(w_pt, h_pt))
            ibuf = io.BytesIO()
            pil.save(ibuf, format="JPEG", quality=92)
            ibuf.seek(0)
            c.drawImage(ImageReader(ibuf), 0, 0, width=w_pt, height=h_pt)
            c.showPage()
            c.save()

            red_reader = PdfReader(io.BytesIO(pbuf.getvalue()))
            writer.add_page(red_reader.pages[0])
    finally:
        doc.close()

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue(), total_redactions


def compare_pdf(pdf1_bytes: bytes, pdf2_bytes: bytes) -> Dict[str, Any]:
    """Compare two PDFs visually (pixel diff heatmap) and textually (unified diff)."""
    r1 = open_reader(pdf1_bytes)
    r2 = open_reader(pdf2_bytes)
    d1 = pdfium.PdfDocument(pdf1_bytes)
    d2 = pdfium.PdfDocument(pdf2_bytes)

    max_pages = max(len(d1), len(d2))
    pages_result: List[Dict[str, Any]] = []
    changed_pages = 0

    try:
        for i in range(max_pages):
            img1 = d1[i].render(scale=1.2).to_pil().convert("RGB") if i < len(d1) else None
            img2 = d2[i].render(scale=1.2).to_pil().convert("RGB") if i < len(d2) else None

            txt1 = (r1.pages[i].extract_text() or "") if i < len(r1.pages) else ""
            txt2 = (r2.pages[i].extract_text() or "") if i < len(r2.pages) else ""

            diff_lines = list(
                difflib.unified_diff(
                    txt1.splitlines(),
                    txt2.splitlines(),
                    fromfile=f"Original (Pág {i + 1})",
                    tofile=f"Revisado (Pág {i + 1})",
                    lineterm="",
                )
            )

            # Build visual diff image
            diff_pct = 0.0
            if img1 is not None and img2 is not None:
                if img1.size != img2.size:
                    img2_aligned = img2.resize(img1.size, Image.Resampling.LANCZOS)
                else:
                    img2_aligned = img2
                diff = ImageChops.difference(img1, img2_aligned).convert("L")
                # Highlight changed pixels in Hospital Crimson (#C81E3A)
                mask = diff.point(lambda p: 255 if p > 18 else 0)
                hist = mask.histogram()
                diff_pixels = hist[255] if len(hist) > 255 else 0
                total_pixels = max(1, img1.size[0] * img1.size[1])
                diff_pct = round((diff_pixels / total_pixels) * 100.0, 2)

                overlay = img2_aligned.copy()
                red_layer = Image.new("RGB", overlay.size, (200, 30, 58))
                blended = Image.blend(overlay, red_layer, 0.55)
                overlay.paste(blended, mask=mask)
                diff_img = overlay
            elif img1 is not None:
                diff_pct = 100.0
                diff_img = img1
            else:
                diff_pct = 100.0
                diff_img = img2

            has_changes = diff_pct > 0.02 or len(diff_lines) > 0
            if has_changes:
                changed_pages += 1

            def _to_b64(im: Optional[Image.Image]) -> Optional[str]:
                if im is None:
                    return None
                buf = io.BytesIO()
                im.save(buf, format="JPEG", quality=78)
                return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

            pages_result.append({
                "page_number": i + 1,
                "has_changes": has_changes,
                "visual_diff_percent": diff_pct,
                "img_left": _to_b64(img1),
                "img_right": _to_b64(img2),
                "img_diff": _to_b64(diff_img),
                "text_diff": diff_lines[:120],
            })
    finally:
        d1.close()
        d2.close()

    return {
        "pages_left": len(r1.pages),
        "pages_right": len(r2.pages),
        "total_compared": max_pages,
        "changed_pages": changed_pages,
        "identical": changed_pages == 0,
        "pages": pages_result,
    }


def compare_pdf_report(pdf1_bytes: bytes, pdf2_bytes: bytes) -> bytes:
    """Generate a downloadable PDF visual comparison report."""
    result = compare_pdf(pdf1_bytes, pdf2_bytes)
    ps = landscape(A4)
    pw, ph = ps
    out = io.BytesIO()
    c = rl_canvas.Canvas(out, pagesize=ps)

    for page_info in result["pages"]:
        c.setFillColor(colors.HexColor("#0F766E"))
        c.rect(0, ph - 38, pw, 38, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 13)
        status = f"Alterada ({page_info['visual_diff_percent']}%)" if page_info["has_changes"] else "Sem alterações"
        c.drawString(24, ph - 24, f"Relatório de Comparação — Página {page_info['page_number']} | {status}")

        slots = [
            ("Documento A (Original)", page_info["img_left"]),
            ("Documento B (Revisado)", page_info["img_right"]),
            ("Diferenças Destacadas", page_info["img_diff"]),
        ]
        col_w = (pw - 64) / 3.0
        max_h = ph - 95

        for idx, (label, b64) in enumerate(slots):
            x0 = 20 + idx * (col_w + 12)
            c.setFillColor(colors.HexColor("#334155"))
            c.setFont("Helvetica-Bold", 9.5)
            c.drawString(x0, ph - 58, label)
            if b64 and "," in b64:
                raw = base64.b64decode(b64.split(",", 1)[1])
                pil = Image.open(io.BytesIO(raw))
                iw, ih = pil.size
                ratio = min(col_w / iw, max_h / ih)
                dw, dh = iw * ratio, ih * ratio
                c.drawImage(ImageReader(io.BytesIO(raw)), x0, ph - 68 - dh, width=dw, height=dh)
                c.setStrokeColor(colors.HexColor("#CBD5E1"))
                c.rect(x0, ph - 68 - dh, dw, dh, fill=0, stroke=1)
        c.showPage()

    c.save()
    return out.getvalue()
