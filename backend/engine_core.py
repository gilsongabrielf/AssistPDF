"""Core PDF engine: inspection, rendering, Organize (6) & Optimize (3) tools."""
from __future__ import annotations

import base64
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from typing import Any, Dict, List, Optional, Tuple

import pypdfium2 as pdfium
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.pdfgen import canvas as rl_canvas


def get_capabilities() -> Dict[str, Any]:
    """Detect available local engines (native Python + optional system binaries)."""
    return {
        "pypdf": True,
        "pypdfium2": True,
        "reportlab": True,
        "pillow": True,
        "libreoffice": shutil.which("soffice") is not None or shutil.which("libreoffice") is not None,
        "ghostscript": shutil.which("gs") is not None or shutil.which("gswin64c") is not None,
        "tesseract": shutil.which("tesseract") is not None,
        "lgpd_local_only": True,
    }


def find_libreoffice() -> Optional[str]:
    return shutil.which("soffice") or shutil.which("libreoffice")


def find_ghostscript() -> Optional[str]:
    return shutil.which("gs") or shutil.which("gswin64c") or shutil.which("gswin32c")


def find_tesseract() -> Optional[str]:
    return shutil.which("tesseract")


def open_reader(pdf_bytes: bytes, password: Optional[str] = None, strict: bool = False) -> PdfReader:
    reader = PdfReader(io.BytesIO(pdf_bytes), strict=strict)
    if reader.is_encrypted:
        pwd = password or ""
        res = reader.decrypt(pwd)
        if res == 0:
            raise ValueError("PDF protegido por senha. Informe a senha correta para continuar.")
    return reader


def parse_page_ranges(range_str: str, total_pages: int) -> List[List[int]]:
    """Parse strings like '1-3, 5, 7-9' into lists of 0-based page indices per group."""
    groups: List[List[int]] = []
    if not range_str or not range_str.strip():
        return [list(range(total_pages))]
    for part in range_str.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a_str, b_str = part.split("-", 1)
            a = max(1, int(a_str.strip())) if a_str.strip() else 1
            b = min(total_pages, int(b_str.strip())) if b_str.strip() else total_pages
            if a <= b:
                groups.append(list(range(a - 1, b)))
            else:
                groups.append(list(range(a - 1, b - 2, -1)))
        else:
            p = int(part)
            if 1 <= p <= total_pages:
                groups.append([p - 1])
    if not groups:
        raise ValueError("Nenhuma página válida encontrada no intervalo informado.")
    return groups


def render_page_to_pil(pdf_bytes: bytes, page_index: int, scale: float = 1.5, password: Optional[str] = None) -> Image.Image:
    doc = pdfium.PdfDocument(pdf_bytes, password=password or None)
    try:
        if page_index < 0 or page_index >= len(doc):
            raise ValueError(f"Página {page_index + 1} fora do intervalo (total: {len(doc)}).")
        page = doc[page_index]
        bitmap = page.render(scale=scale)
        pil_img = bitmap.to_pil()
        page.close()
        return pil_img.convert("RGB")
    finally:
        doc.close()


def inspect_pdf(pdf_bytes: bytes, password: Optional[str] = None, include_thumbnails: bool = True, max_thumbs: int = 60) -> Dict[str, Any]:
    """Return page count, dimensions, encryption state, and optional thumbnails."""
    reader = PdfReader(io.BytesIO(pdf_bytes), strict=False)
    is_encrypted = reader.is_encrypted
    if is_encrypted:
        if password is not None:
            if reader.decrypt(password) == 0:
                return {"is_encrypted": True, "needs_password": True, "page_count": 0, "pages": []}
        else:
            try:
                if reader.decrypt("") == 0:
                    return {"is_encrypted": True, "needs_password": True, "page_count": 0, "pages": []}
            except Exception:
                return {"is_encrypted": True, "needs_password": True, "page_count": 0, "pages": []}

    page_count = len(reader.pages)
    pages_info: List[Dict[str, Any]] = []

    doc = None
    if include_thumbnails:
        try:
            doc = pdfium.PdfDocument(pdf_bytes, password=password or None)
        except Exception:
            doc = None

    try:
        for idx, page in enumerate(reader.pages):
            box = page.mediabox
            w = float(box.width)
            h = float(box.height)
            rot = int(page.get("/Rotate", 0) or 0)
            thumb_b64 = None
            if doc is not None and idx < max_thumbs:
                try:
                    p = doc[idx]
                    # Fit width ~220px for crisp fast previews
                    scale = min(0.55, 240.0 / max(w, 1.0))
                    bmp = p.render(scale=max(scale, 0.2))
                    img = bmp.to_pil().convert("RGB")
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=75)
                    thumb_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
                    p.close()
                except Exception:
                    thumb_b64 = None
            pages_info.append({
                "index": idx,
                "number": idx + 1,
                "width": round(w, 2),
                "height": round(h, 2),
                "rotation": rot,
                "thumbnail": thumb_b64,
            })
    finally:
        if doc is not None:
            doc.close()

    meta = reader.metadata or {}
    return {
        "is_encrypted": is_encrypted,
        "needs_password": False,
        "page_count": page_count,
        "size_bytes": len(pdf_bytes),
        "title": str(meta.get("/Title", "") or ""),
        "author": str(meta.get("/Author", "") or ""),
        "pages": pages_info,
    }


def render_page_png_bytes(pdf_bytes: bytes, page_index: int, scale: float = 1.6, password: Optional[str] = None) -> bytes:
    img = render_page_to_pil(pdf_bytes, page_index, scale=scale, password=password)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ==================== ORGANIZE PDF (6 TOOLS) ====================

def merge_pdfs(files_bytes: List[bytes]) -> bytes:
    writer = PdfWriter()
    for data in files_bytes:
        reader = open_reader(data)
        for page in reader.pages:
            writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def split_pdf(
    pdf_bytes: bytes,
    mode: str = "ranges",
    ranges: str = "",
    fixed_step: int = 1,
    merge_ranges: bool = False,
) -> Tuple[bytes, str, str]:
    """Split PDF by ranges, fixed page count, or all pages. Returns (bytes, filename, media_type)."""
    reader = open_reader(pdf_bytes)
    total = len(reader.pages)

    if mode == "all":
        groups = [[i] for i in range(total)]
    elif mode == "fixed":
        step = max(1, fixed_step)
        groups = [list(range(i, min(i + step, total))) for i in range(0, total, step)]
    else:
        groups = parse_page_ranges(ranges, total)

    if merge_ranges or len(groups) == 1:
        writer = PdfWriter()
        for g in groups:
            for idx in g:
                writer.add_page(reader.pages[idx])
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue(), "dividido.pdf", "application/pdf"

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, g in enumerate(groups, start=1):
            w = PdfWriter()
            for idx in g:
                w.add_page(reader.pages[idx])
            pbuf = io.BytesIO()
            w.write(pbuf)
            label = f"parte_{i:02d}_pag_{g[0]+1}" + (f"-{g[-1]+1}" if len(g) > 1 else "") + ".pdf"
            zf.writestr(label, pbuf.getvalue())
    return zip_buf.getvalue(), "pdf_dividido.zip", "application/zip"


def remove_pages(pdf_bytes: bytes, pages_to_remove: List[int]) -> bytes:
    """Remove 1-based page numbers from PDF."""
    reader = open_reader(pdf_bytes)
    remove_set = {p - 1 for p in pages_to_remove}
    writer = PdfWriter()
    kept = 0
    for idx, page in enumerate(reader.pages):
        if idx not in remove_set:
            writer.add_page(page)
            kept += 1
    if kept == 0:
        raise ValueError("Não é possível remover todas as páginas do documento.")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def extract_pages(pdf_bytes: bytes, pages_to_extract: List[int], separate_files: bool = False) -> Tuple[bytes, str, str]:
    """Extract 1-based page numbers into a single PDF or a ZIP of individual PDFs."""
    reader = open_reader(pdf_bytes)
    total = len(reader.pages)
    indices = [p - 1 for p in pages_to_extract if 1 <= p <= total]
    if not indices:
        raise ValueError("Selecione pelo menos uma página válida para extrair.")

    if not separate_files or len(indices) == 1:
        writer = PdfWriter()
        for idx in indices:
            writer.add_page(reader.pages[idx])
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue(), "paginas_extraidas.pdf", "application/pdf"

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx in indices:
            w = PdfWriter()
            w.add_page(reader.pages[idx])
            pbuf = io.BytesIO()
            w.write(pbuf)
            zf.writestr(f"pagina_{idx + 1:03d}.pdf", pbuf.getvalue())
    return zip_buf.getvalue(), "paginas_extraidas.zip", "application/zip"


def organize_pages(files_bytes: List[bytes], plan: List[Dict[str, int]]) -> bytes:
    """Reorder, rotate, duplicate or delete pages across one or more PDFs.
    plan item: {"file_index": 0, "page_index": 0, "rotation": 0}
    """
    readers = [open_reader(b) for b in files_bytes]
    if not plan:
        raise ValueError("O documento resultante precisa ter pelo menos uma página.")
    writer = PdfWriter()
    for item in plan:
        fi = int(item.get("file_index", 0))
        pi = int(item.get("page_index", 0))
        rot = int(item.get("rotation", 0)) % 360
        if 0 <= fi < len(readers) and 0 <= pi < len(readers[fi].pages):
            page = readers[fi].pages[pi]
            added = writer.add_page(page)
            if rot:
                added.rotate(rot)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def scan_to_pdf(images_bytes: List[bytes], filter_mode: str = "document", page_size: str = "A4") -> bytes:
    """Enhance scanned/photographed document images and compile into a clean PDF."""
    if not images_bytes:
        raise ValueError("Envie ou capture ao menos uma imagem.")
    ps = A4 if page_size.upper() == "A4" else LETTER
    pw, ph = ps
    out = io.BytesIO()
    c = rl_canvas.Canvas(out, pagesize=ps)

    for raw in images_bytes:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img).convert("RGB")

        if filter_mode == "document":
            img = ImageOps.autocontrast(img, cutoff=2)
            img = ImageEnhance.Contrast(img).enhance(1.35)
            img = ImageEnhance.Brightness(img).enhance(1.08)
            img = ImageEnhance.Sharpness(img).enhance(1.6)
        elif filter_mode == "grayscale":
            img = ImageOps.grayscale(img)
            img = ImageOps.autocontrast(img, cutoff=2)
            img = img.convert("RGB")
        elif filter_mode == "bw":
            gray = ImageOps.grayscale(img)
            gray = ImageOps.autocontrast(gray, cutoff=3)
            # Clean document thresholding
            bw = gray.point(lambda x: 255 if x > 155 else 0, mode="1").convert("RGB")
            img = bw

        margin = 18
        avail_w = pw - 2 * margin
        avail_h = ph - 2 * margin
        iw, ih = img.size
        ratio = min(avail_w / iw, avail_h / ih)
        dw, dh = iw * ratio, ih * ratio
        dx = (pw - dw) / 2
        dy = (ph - dh) / 2

        tmp_img = io.BytesIO()
        img.save(tmp_img, format="JPEG", quality=88)
        tmp_img.seek(0)
        from reportlab.lib.utils import ImageReader
        c.drawImage(ImageReader(tmp_img), dx, dy, width=dw, height=dh)
        c.showPage()

    c.save()
    return out.getvalue()


# ==================== OPTIMIZE PDF (3 TOOLS) ====================

def compress_pdf(pdf_bytes: bytes, level: str = "recommended") -> bytes:
    """Compress PDF at low, recommended, or extreme level."""
    gs = find_ghostscript()
    if gs:
        preset_map = {"low": "/printer", "recommended": "/ebook", "extreme": "/screen"}
        preset = preset_map.get(level, "/ebook")
        with tempfile.TemporaryDirectory() as tmp:
            inp = os.path.join(tmp, "in.pdf")
            outp = os.path.join(tmp, "out.pdf")
            with open(inp, "wb") as f:
                f.write(pdf_bytes)
            cmd = [
                gs, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
                f"-dPDFSETTINGS={preset}", "-dNOPAUSE", "-dQUIET", "-dBATCH",
                f"-sOutputFile={outp}", inp,
            ]
            res = subprocess.run(cmd, capture_output=True, timeout=120)
            if res.returncode == 0 and os.path.exists(outp) and os.path.getsize(outp) > 0:
                with open(outp, "rb") as f:
                    compressed = f.read()
                return compressed if len(compressed) < len(pdf_bytes) else pdf_bytes

    # Pure-Python + PDFium compression fallback
    reader = open_reader(pdf_bytes)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)

    if level == "low":
        for page in writer.pages:
            try:
                page.compress_content_streams(level=9)
            except Exception:
                pass
        try:
            writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
        except Exception:
            pass
        out = io.BytesIO()
        writer.write(out)
        data = out.getvalue()
        return data if len(data) <= len(pdf_bytes) else pdf_bytes

    # For recommended: recompress embedded images + compress content streams
    if level == "recommended":
        quality = 62
        for page in writer.pages:
            try:
                for img_file in page.images:
                    try:
                        pil = Image.open(io.BytesIO(img_file.data)).convert("RGB")
                        max_dim = 1400
                        if max(pil.size) > max_dim:
                            pil.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                        img_file.replace(pil, quality=quality)
                    except Exception:
                        pass
            except Exception:
                pass
            try:
                page.compress_content_streams(level=9)
            except Exception:
                pass
        try:
            writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
        except Exception:
            pass
        out = io.BytesIO()
        writer.write(out)
        data = out.getvalue()
        if len(data) < len(pdf_bytes) * 0.92:
            return data
        # If embedded image compression didn't shrink much, keep smaller result
        return data if len(data) < len(pdf_bytes) else pdf_bytes

    # Extreme: rasterize pages at compact DPI + JPEG compression
    doc = pdfium.PdfDocument(pdf_bytes)
    try:
        out = io.BytesIO()
        c = None
        for i in range(len(doc)):
            p = doc[i]
            w_pt, h_pt = p.get_size()
            bmp = p.render(scale=1.25)  # ~90 DPI
            pil = bmp.to_pil().convert("RGB")
            p.close()
            if c is None:
                c = rl_canvas.Canvas(out, pagesize=(w_pt, h_pt))
            else:
                c.setPageSize((w_pt, h_pt))
            jbuf = io.BytesIO()
            pil.save(jbuf, format="JPEG", quality=48, optimize=True)
            jbuf.seek(0)
            from reportlab.lib.utils import ImageReader
            c.drawImage(ImageReader(jbuf), 0, 0, width=w_pt, height=h_pt)
            c.showPage()
        if c is not None:
            c.save()
        extreme_data = out.getvalue()
        return extreme_data if len(extreme_data) < len(pdf_bytes) else pdf_bytes
    finally:
        doc.close()


def repair_pdf(pdf_bytes: bytes) -> Tuple[bytes, str]:
    """Attempt to repair damaged PDF XREF tables or structure."""
    # Strategy 1: pypdf non-strict rebuild
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes), strict=False)
        writer = PdfWriter()
        recovered = 0
        for page in reader.pages:
            try:
                writer.add_page(page)
                recovered += 1
            except Exception:
                continue
        if recovered > 0:
            if reader.metadata:
                try:
                    writer.add_metadata({k: str(v) for k, v in reader.metadata.items() if isinstance(k, str)})
                except Exception:
                    pass
            out = io.BytesIO()
            writer.write(out)
            return out.getvalue(), f"Estrutura reconstruída com sucesso ({recovered} página(s) recuperada(s))."
    except Exception:
        pass

    # Strategy 2: PDFium visual recovery fallback
    try:
        doc = pdfium.PdfDocument(pdf_bytes)
        out = io.BytesIO()
        c = None
        count = len(doc)
        for i in range(count):
            p = doc[i]
            w_pt, h_pt = p.get_size()
            bmp = p.render(scale=2.0)
            pil = bmp.to_pil().convert("RGB")
            p.close()
            if c is None:
                c = rl_canvas.Canvas(out, pagesize=(w_pt, h_pt))
            else:
                c.setPageSize((w_pt, h_pt))
            jbuf = io.BytesIO()
            pil.save(jbuf, format="JPEG", quality=90)
            jbuf.seek(0)
            from reportlab.lib.utils import ImageReader
            c.drawImage(ImageReader(jbuf), 0, 0, width=w_pt, height=h_pt)
            c.showPage()
        doc.close()
        if c is not None:
            c.save()
            return out.getvalue(), f"PDF recuperado via renderização de segurança ({count} página(s))."
    except Exception as exc:
        raise ValueError(f"Arquivo PDF gravemente corrompido e não pôde ser recuperado: {exc}")

    raise ValueError("Não foi possível recuperar páginas deste arquivo.")


def ocr_pdf(
    pdf_bytes: bytes,
    lang: str = "por+eng",
    client_ocr_pages: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[bytes, str]:
    """Create searchable PDF via native Tesseract CLI OR browser-computed Tesseract.js OCR layer."""
    tess = find_tesseract()

    # Mode A: Client-provided OCR words/lines (from local browser Tesseract.js — zero cloud!)
    if client_ocr_pages:
        reader = open_reader(pdf_bytes)
        writer = PdfWriter()
        total_words = 0

        for idx, page in enumerate(reader.pages):
            added = writer.add_page(page)
            w_pt = float(added.mediabox.width)
            h_pt = float(added.mediabox.height)
            page_ocr = next((p for p in client_ocr_pages if int(p.get("page_index", -1)) == idx), None)

            if page_ocr and page_ocr.get("words"):
                overlay_buf = io.BytesIO()
                c = rl_canvas.Canvas(overlay_buf, pagesize=(w_pt, h_pt))
                img_w = float(page_ocr.get("image_width") or w_pt)
                img_h = float(page_ocr.get("image_height") or h_pt)
                sx = w_pt / max(img_w, 1.0)
                sy = h_pt / max(img_h, 1.0)

                for w_obj in page_ocr["words"]:
                    text = str(w_obj.get("text", "")).strip()
                    if not text:
                        continue
                    x0 = float(w_obj.get("x0", 0)) * sx
                    y0 = float(w_obj.get("y0", 0)) * sy
                    x1 = float(w_obj.get("x1", 0)) * sx
                    y1 = float(w_obj.get("y1", 0)) * sy
                    box_h = max(4.0, y1 - y0)
                    box_w = max(4.0, x1 - x0)
                    pdf_y = h_pt - y1

                    tx = c.beginText(x0, pdf_y)
                    tx.setTextRenderMode(3)  # Invisible selectable text!
                    font_size = max(5.0, min(box_h * 0.9, 48.0))
                    tx.setFont("Helvetica", font_size)
                    est_w = c.stringWidth(text, "Helvetica", font_size)
                    if est_w > 0:
                        tx.setHorizScale(max(20.0, min(300.0, (box_w / est_w) * 100.0)))
                    tx.textOut(text + " ")
                    c.drawText(tx)
                    total_words += 1

                c.save()
                overlay_reader = PdfReader(io.BytesIO(overlay_buf.getvalue()))
                added.merge_page(overlay_reader.pages[0])

        out = io.BytesIO()
        writer.write(out)
        return out.getvalue(), f"Camada de texto pesquisável aplicada ({total_words} palavras reconhecidas)."

    # Mode B: Native Server Tesseract CLI (Docker / Linux / Windows with Tesseract installed)
    if tess:
        doc = pdfium.PdfDocument(pdf_bytes)
        writer = PdfWriter()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                for i in range(len(doc)):
                    p = doc[i]
                    bmp = p.render(scale=2.5)
                    pil = bmp.to_pil().convert("RGB")
                    p.close()
                    img_path = os.path.join(tmp, f"page_{i}.png")
                    out_base = os.path.join(tmp, f"ocr_{i}")
                    pil.save(img_path, format="PNG")
                    res = subprocess.run(
                        [tess, img_path, out_base, "-l", lang, "pdf"],
                        capture_output=True,
                        timeout=120,
                    )
                    pdf_part = out_base + ".pdf"
                    if res.returncode == 0 and os.path.exists(pdf_part):
                        part_reader = PdfReader(pdf_part)
                        for rp in part_reader.pages:
                            writer.add_page(rp)
                    else:
                        # Fallback keep original page
                        orig_reader = open_reader(pdf_bytes)
                        writer.add_page(orig_reader.pages[i])
        finally:
            doc.close()
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue(), f"OCR nativo concluído com Tesseract ({lang})."

    raise ValueError(
        "Motor Tesseract CLI não instalado no servidor; utilize o modo OCR no navegador (automático na interface) ou implante via Docker."
    )
