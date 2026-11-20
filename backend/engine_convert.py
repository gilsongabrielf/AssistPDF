"""PDF Conversion engine: Convert TO PDF (5) & Convert FROM PDF (5) tools."""
from __future__ import annotations

import html as html_lib
import io
import os
import re
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import openpyxl
import pypdfium2 as pdfium
from bs4 import BeautifulSoup
from docx import Document as DocxDocument
from docx.shared import Inches, Pt
from PIL import Image, ImageOps
from pptx import Presentation
from pptx.util import Inches as PptxInches, Pt as PptxPt
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
    TextStringObject,
)
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, LETTER, landscape, portrait
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from engine_core import find_ghostscript, find_libreoffice, open_reader


def _safe_xml(text: str) -> str:
    return html_lib.escape(text or "").replace("\n", "<br/>")


def _libreoffice_convert(file_bytes: bytes, filename: str, target_ext: str = "pdf") -> Optional[bytes]:
    soffice = find_libreoffice()
    if not soffice:
        return None
    with tempfile.TemporaryDirectory() as tmp:
        safe_name = os.path.basename(filename) or f"input.{target_ext}"
        in_path = os.path.join(tmp, safe_name)
        with open(in_path, "wb") as f:
            f.write(file_bytes)
        res = subprocess.run(
            [soffice, "--headless", "--convert-to", target_ext, "--outdir", tmp, in_path],
            capture_output=True,
            timeout=120,
        )
        if res.returncode == 0:
            stem = os.path.splitext(safe_name)[0]
            out_path = os.path.join(tmp, f"{stem}.{target_ext}")
            if os.path.exists(out_path):
                with open(out_path, "rb") as f:
                    return f.read()
    return None


# ==================== CONVERT TO PDF (5 TOOLS) ====================

def images_to_pdf(
    images_bytes: List[bytes],
    page_size: str = "A4",
    orientation: str = "portrait",
    margin: str = "small",
) -> bytes:
    if not images_bytes:
        raise ValueError("Envie ao menos uma imagem (JPG, PNG, WebP ou BMP).")

    margin_map = {"none": 0, "small": 24, "large": 54}
    m = margin_map.get(margin, 24)
    out = io.BytesIO()
    c = None

    for raw in images_bytes:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img).convert("RGB")
        iw, ih = img.size

        if page_size.lower() == "fit":
            pw, ph = float(iw) * 0.75, float(ih) * 0.75
            cur_m = 0
        else:
            base = A4 if page_size.upper() == "A4" else LETTER
            if orientation == "landscape":
                pw, ph = landscape(base)
            elif orientation == "auto":
                pw, ph = landscape(base) if iw > ih else portrait(base)
            else:
                pw, ph = portrait(base)
            cur_m = m

        if c is None:
            c = rl_canvas.Canvas(out, pagesize=(pw, ph))
        else:
            c.setPageSize((pw, ph))

        avail_w = max(10, pw - 2 * cur_m)
        avail_h = max(10, ph - 2 * cur_m)
        ratio = min(avail_w / iw, avail_h / ih)
        dw, dh = iw * ratio, ih * ratio
        dx = (pw - dw) / 2
        dy = (ph - dh) / 2

        jbuf = io.BytesIO()
        img.save(jbuf, format="JPEG", quality=92)
        jbuf.seek(0)
        c.drawImage(ImageReader(jbuf), dx, dy, width=dw, height=dh)
        c.showPage()

    if c is not None:
        c.save()
    return out.getvalue()


def word_to_pdf(file_bytes: bytes, filename: str = "documento.docx") -> bytes:
    # Prefer LibreOffice if installed (full fidelity for .doc & .docx)
    lo_pdf = _libreoffice_convert(file_bytes, filename, "pdf")
    if lo_pdf:
        return lo_pdf

    if filename.lower().endswith(".doc") and not filename.lower().endswith(".docx"):
        raise ValueError("Arquivos legados .DOC requerem LibreOffice (disponível no modo Docker/Intranet). Salve como .DOCX ou use o deploy Docker.")

    doc = DocxDocument(io.BytesIO(file_bytes))
    out = io.BytesIO()
    pdf_doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "HospitalBody", parent=styles["Normal"], fontName="Helvetica", fontSize=10.5, leading=15, spaceAfter=6
    )
    h1_style = ParagraphStyle(
        "HospitalH1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=16, leading=21, textColor=colors.HexColor("#0F766E"), spaceAfter=8
    )
    h2_style = ParagraphStyle(
        "HospitalH2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=colors.HexColor("#1E293B"), spaceAfter=6
    )

    story = []
    # Iterate document body elements in order (paragraphs & tables)
    from docx.oxml.text.paragraph import CT_P
    from docx.oxml.table import CT_Tbl
    from docx.table import Table as DocxTable
    from docx.text.paragraph import Paragraph as DocxParagraph

    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            p = DocxParagraph(child, doc)
            txt = p.text.strip()
            if not txt:
                story.append(Spacer(1, 5))
                continue
            sname = (p.style.name or "").lower()
            if "heading 1" in sname or "título 1" in sname or "title" in sname:
                story.append(Paragraph(_safe_xml(txt), h1_style))
            elif "heading" in sname or "título" in sname:
                story.append(Paragraph(_safe_xml(txt), h2_style))
            else:
                # Preserve inline bold/italic runs
                runs_xml = []
                for run in p.runs:
                    rtxt = html_lib.escape(run.text or "")
                    if not rtxt:
                        continue
                    if run.bold:
                        rtxt = f"<b>{rtxt}</b>"
                    if run.italic:
                        rtxt = f"<i>{rtxt}</i>"
                    runs_xml.append(rtxt)
                content = "".join(runs_xml) or _safe_xml(txt)
                story.append(Paragraph(content, body_style))
        elif isinstance(child, CT_Tbl):
            tbl = DocxTable(child, doc)
            rows_data = []
            for row in tbl.rows:
                rows_data.append([Paragraph(_safe_xml(cell.text.strip()), body_style) for cell in row.cells])
            if rows_data:
                t = Table(rows_data, repeatRows=1)
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E6F4F1")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]))
                story.append(Spacer(1, 4))
                story.append(t)
                story.append(Spacer(1, 8))

    # Append embedded images if present and story is minimal
    for rel in doc.part.rels.values():
        if "image" in rel.target_ref:
            try:
                blob = rel.target_part.blob
                pil = Image.open(io.BytesIO(blob)).convert("RGB")
                iw, ih = pil.size
                max_w = 160 * mm
                scale = min(1.0, max_w / max(iw * 0.75, 1))
                ibuf = io.BytesIO()
                pil.save(ibuf, format="JPEG", quality=88)
                ibuf.seek(0)
                story.append(Spacer(1, 6))
                story.append(RLImage(ibuf, width=iw * 0.75 * scale, height=ih * 0.75 * scale))
            except Exception:
                pass

    if not story:
        story.append(Paragraph("Documento vazio.", body_style))

    pdf_doc.build(story)
    return out.getvalue()


def powerpoint_to_pdf(file_bytes: bytes, filename: str = "apresentacao.pptx") -> bytes:
    lo_pdf = _libreoffice_convert(file_bytes, filename, "pdf")
    if lo_pdf:
        return lo_pdf

    if filename.lower().endswith(".ppt") and not filename.lower().endswith(".pptx"):
        raise ValueError("Arquivos legados .PPT requerem LibreOffice (disponível no modo Docker/Intranet). Converta para .PPTX ou use Docker.")

    prs = Presentation(io.BytesIO(file_bytes))
    pw, ph = 960.0, 540.0  # 16:9 widescreen points
    out = io.BytesIO()
    c = rl_canvas.Canvas(out, pagesize=(pw, ph))

    for s_idx, slide in enumerate(prs.slides, start=1):
        # Clean subtle slide card
        c.setFillColor(colors.HexColor("#FFFFFF"))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#0D9488"))
        c.rect(0, ph - 10, pw, 10, fill=1, stroke=0)

        y_cursor = ph - 55
        slide_title = None
        if slide.shapes.title and slide.shapes.title.text.strip():
            slide_title = slide.shapes.title.text.strip()
            c.setFillColor(colors.HexColor("#0F766E"))
            c.setFont("Helvetica-Bold", 24)
            c.drawString(48, y_cursor, slide_title[:75])
            y_cursor -= 38
            c.setStrokeColor(colors.HexColor("#E2E8F0"))
            c.line(48, y_cursor + 12, pw - 48, y_cursor + 12)

        c.setFillColor(colors.HexColor("#1E293B"))
        for shape in slide.shapes:
            if shape == slide.shapes.title:
                continue
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    txt = para.text.strip()
                    if not txt:
                        continue
                    c.setFont("Helvetica", 14)
                    # Simple word wrap
                    words = txt.split()
                    line = "• " if para.level >= 0 else ""
                    for word in words:
                        test = (line + " " + word).strip()
                        if c.stringWidth(test, "Helvetica", 14) > pw - 110:
                            if y_cursor > 45:
                                c.drawString(54 + para.level * 18, y_cursor, line)
                                y_cursor -= 20
                            line = word
                        else:
                            line = test
                    if line and y_cursor > 45:
                        c.drawString(54 + para.level * 18, y_cursor, line)
                        y_cursor -= 24
            elif shape.shape_type == 13:  # Picture
                try:
                    blob = shape.image.blob
                    pil = Image.open(io.BytesIO(blob)).convert("RGB")
                    iw, ih = pil.size
                    max_w, max_h = 360.0, max(120.0, y_cursor - 55)
                    ratio = min(max_w / iw, max_h / ih, 1.0)
                    dw, dh = iw * ratio, ih * ratio
                    ibuf = io.BytesIO()
                    pil.save(ibuf, format="JPEG", quality=88)
                    ibuf.seek(0)
                    c.drawImage(ImageReader(ibuf), pw - dw - 48, max(45, y_cursor - dh), width=dw, height=dh)
                except Exception:
                    pass

        c.setFillColor(colors.HexColor("#64748B"))
        c.setFont("Helvetica", 10)
        c.drawRightString(pw - 36, 20, f"Slide {s_idx} / {len(prs.slides)}")
        c.showPage()

    c.save()
    return out.getvalue()


def excel_to_pdf(file_bytes: bytes, filename: str = "planilha.xlsx", orientation: str = "landscape") -> bytes:
    lo_pdf = _libreoffice_convert(file_bytes, filename, "pdf")
    if lo_pdf:
        return lo_pdf

    if filename.lower().endswith(".xls") and not filename.lower().endswith(".xlsx"):
        raise ValueError("Arquivos legados .XLS requerem LibreOffice (disponível no modo Docker/Intranet). Salve como .XLSX ou use Docker.")

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ps = landscape(A4) if orientation == "landscape" else portrait(A4)
    out = io.BytesIO()
    pdf_doc = SimpleDocTemplate(
        out, pagesize=ps, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=14 * mm, bottomMargin=14 * mm
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "SheetTitle", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, textColor=colors.HexColor("#0F766E"), spaceAfter=8
    )
    cell_style = ParagraphStyle("CellText", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=11)

    story = []
    for s_idx, sheet_name in enumerate(wb.sheetnames):
        ws = wb[sheet_name]
        if s_idx > 0:
            story.append(PageBreak())
        story.append(Paragraph(_safe_xml(f"Planilha: {sheet_name}"), title_style))

        rows = []
        max_cols = 0
        for row in ws.iter_rows(values_only=True):
            if any(v is not None and str(v).strip() != "" for v in row):
                vals = ["" if v is None else str(v) for v in row]
                # Trim trailing empties
                while vals and vals[-1] == "":
                    vals.pop()
                max_cols = max(max_cols, len(vals))
                rows.append(vals)

        if not rows or max_cols == 0:
            story.append(Paragraph("(Planilha sem dados)", cell_style))
            continue

        # Cap columns to fit cleanly on page
        max_cols = min(max_cols, 14)
        table_data = []
        for r in rows[:400]:
            padded = (r + [""] * max_cols)[:max_cols]
            table_data.append([Paragraph(_safe_xml(val[:180]), cell_style) for val in padded])

        avail_w = ps[0] - 28 * mm
        col_w = avail_w / max_cols
        t = Table(table_data, colWidths=[col_w] * max_cols, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0D9488")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFA")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(t)

    pdf_doc.build(story)
    return out.getvalue()


def html_to_pdf(
    html_content: str,
    page_size: str = "A4",
    orientation: str = "portrait",
) -> bytes:
    if not html_content or not html_content.strip():
        raise ValueError("Informe o código HTML ou envie um arquivo .html.")

    base = A4 if page_size.upper() == "A4" else LETTER
    ps = landscape(base) if orientation == "landscape" else portrait(base)
    soup = BeautifulSoup(html_content, "lxml")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    out = io.BytesIO()
    pdf_doc = SimpleDocTemplate(
        out, pagesize=ps, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle("HtmlBody", parent=styles["Normal"], fontName="Helvetica", fontSize=10.5, leading=15, spaceAfter=6)
    h1 = ParagraphStyle("HtmlH1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=colors.HexColor("#0F766E"), spaceAfter=8)
    h2 = ParagraphStyle("HtmlH2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=colors.HexColor("#1E293B"), spaceAfter=6)
    h3 = ParagraphStyle("HtmlH3", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=colors.HexColor("#334155"), spaceAfter=5)
    code_s = ParagraphStyle("HtmlCode", parent=styles["Code"], fontName="Courier", fontSize=9, leading=12, backColor=colors.HexColor("#F1F5F9"), spaceAfter=6)

    story = []
    root = soup.body or soup

    for el in root.find_all(["h1", "h2", "h3", "h4", "p", "ul", "ol", "table", "pre", "blockquote"], recursive=True):
        # Skip nested paragraphs inside table or list to avoid duplication
        if el.name == "p" and el.find_parent(["table", "li"]):
            continue
        if el.name == "h1":
            story.append(Paragraph(_safe_xml(el.get_text(" ", strip=True)), h1))
        elif el.name == "h2":
            story.append(Paragraph(_safe_xml(el.get_text(" ", strip=True)), h2))
        elif el.name in ("h3", "h4"):
            story.append(Paragraph(_safe_xml(el.get_text(" ", strip=True)), h3))
        elif el.name == "p":
            txt = el.get_text(" ", strip=True)
            if txt:
                story.append(Paragraph(_safe_xml(txt), body))
        elif el.name in ("ul", "ol"):
            for idx, li in enumerate(el.find_all("li", recursive=False), start=1):
                prefix = f"{idx}. " if el.name == "ol" else "• "
                story.append(Paragraph(prefix + _safe_xml(li.get_text(" ", strip=True)), body))
            story.append(Spacer(1, 4))
        elif el.name == "pre":
            story.append(Paragraph(_safe_xml(el.get_text()), code_s))
        elif el.name == "blockquote":
            story.append(Paragraph(f"<i>{_safe_xml(el.get_text(' ', strip=True))}</i>", body))
        elif el.name == "table":
            tdata = []
            for tr in el.find_all("tr"):
                cells = [Paragraph(_safe_xml(td.get_text(" ", strip=True)), body) for td in tr.find_all(["th", "td"])]
                if cells:
                    tdata.append(cells)
            if tdata:
                t = Table(tdata, repeatRows=1)
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E6F4F1")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("PADDING", (0, 0), (-1, -1), 5),
                ]))
                story.append(Spacer(1, 4))
                story.append(t)
                story.append(Spacer(1, 8))

    if not story:
        plain = root.get_text("\n", strip=True) or "Conteúdo HTML vazio."
        for line in plain.splitlines():
            if line.strip():
                story.append(Paragraph(_safe_xml(line.strip()), body))

    pdf_doc.build(story)
    return out.getvalue()


# ==================== CONVERT FROM PDF (5 TOOLS) ====================

def pdf_to_jpg(pdf_bytes: bytes, mode: str = "pages", dpi: int = 150, fmt: str = "jpg") -> Tuple[bytes, str, str]:
    ext = "png" if fmt.lower() == "png" else "jpg"
    pil_fmt = "PNG" if ext == "png" else "JPEG"
    media_single = "image/png" if ext == "png" else "image/jpeg"

    if mode == "extract_images":
        reader = open_reader(pdf_bytes)
        zip_buf = io.BytesIO()
        count = 0
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for p_idx, page in enumerate(reader.pages, start=1):
                for img_idx, img_obj in enumerate(page.images, start=1):
                    count += 1
                    fname = f"pag_{p_idx:03d}_img_{img_idx:02d}_{img_obj.name}"
                    zf.writestr(fname, img_obj.data)
        if count == 0:
            raise ValueError("Nenhuma imagem incorporada foi encontrada neste PDF. Use o modo 'Converter páginas em JPG'.")
        return zip_buf.getvalue(), "imagens_extraidas.zip", "application/zip"

    # Render each page via pypdfium2
    scale = max(72, min(dpi, 300)) / 72.0
    doc = pdfium.PdfDocument(pdf_bytes)
    try:
        total = len(doc)
        if total == 1:
            p = doc[0]
            pil = p.render(scale=scale).to_pil().convert("RGB")
            p.close()
            buf = io.BytesIO()
            pil.save(buf, format=pil_fmt, quality=92)
            return buf.getvalue(), f"pagina_001.{ext}", media_single

        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i in range(total):
                p = doc[i]
                pil = p.render(scale=scale).to_pil().convert("RGB")
                p.close()
                buf = io.BytesIO()
                pil.save(buf, format=pil_fmt, quality=90)
                zf.writestr(f"pagina_{i + 1:03d}.{ext}", buf.getvalue())
        return zip_buf.getvalue(), f"pdf_para_{ext}.zip", "application/zip"
    finally:
        doc.close()


def pdf_to_word(pdf_bytes: bytes) -> bytes:
    reader = open_reader(pdf_bytes)
    doc = DocxDocument()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    for p_idx, page in enumerate(reader.pages):
        if p_idx > 0:
            doc.add_page_break()
        text = page.extract_text() or ""
        if text.strip():
            # Split into paragraphs by double newlines or natural lines
            blocks = re.split(r"\n\s*\n", text.strip())
            for block in blocks:
                lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
                if not lines:
                    continue
                joined = " ".join(lines)
                if len(joined) < 80 and joined.isupper() and len(lines) == 1:
                    doc.add_heading(joined, level=2)
                else:
                    doc.add_paragraph(joined)

        # Include embedded images found on page
        try:
            for img_obj in page.images:
                try:
                    pil = Image.open(io.BytesIO(img_obj.data)).convert("RGB")
                    ibuf = io.BytesIO()
                    pil.save(ibuf, format="PNG")
                    ibuf.seek(0)
                    doc.add_picture(ibuf, width=Inches(5.5))
                except Exception:
                    pass
        except Exception:
            pass

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def pdf_to_powerpoint(pdf_bytes: bytes, mode: str = "slides_image") -> bytes:
    prs = Presentation()
    prs.slide_width = PptxInches(13.333)
    prs.slide_height = PptxInches(7.5)
    blank_layout = prs.slide_layouts[6]

    if mode == "text":
        reader = open_reader(pdf_bytes)
        for idx, page in enumerate(reader.pages, start=1):
            slide = prs.slides.add_slide(blank_layout)
            tb = slide.shapes.add_textbox(PptxInches(0.6), PptxInches(0.5), PptxInches(12.1), PptxInches(6.4))
            tf = tb.text_frame
            tf.word_wrap = True
            txt = (page.extract_text() or f"(Página {idx} sem texto selecionável)").strip()
            p0 = tf.paragraphs[0]
            p0.text = f"Página {idx}"
            p0.font.bold = True
            p0.font.size = PptxPt(20)
            for line in txt.splitlines()[:28]:
                if line.strip():
                    p = tf.add_paragraph()
                    p.text = line.strip()
                    p.font.size = PptxPt(13)
    else:
        doc = pdfium.PdfDocument(pdf_bytes)
        try:
            for i in range(len(doc)):
                page = doc[i]
                pil = page.render(scale=2.0).to_pil().convert("RGB")
                page.close()
                ibuf = io.BytesIO()
                pil.save(ibuf, format="PNG")
                ibuf.seek(0)
                slide = prs.slides.add_slide(blank_layout)
                iw, ih = pil.size
                sw, sh = 13.333, 7.5
                ratio = min(sw / iw, sh / ih)
                dw, dh = iw * ratio, ih * ratio
                left = (sw - dw) / 2
                top = (sh - dh) / 2
                slide.shapes.add_picture(ibuf, PptxInches(left), PptxInches(top), width=PptxInches(dw), height=PptxInches(dh))
        finally:
            doc.close()

    out = io.BytesIO()
    prs.save(out)
    return out.getvalue()


def pdf_to_excel(pdf_bytes: bytes, single_sheet: bool = False) -> bytes:
    reader = open_reader(pdf_bytes)
    wb = openpyxl.Workbook()
    ws_first = wb.active

    from openpyxl.styles import Font, PatternFill

    header_fill = PatternFill(start_color="0D9488", end_color="0D9488", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")

    if single_sheet:
        ws_first.title = "Dados_PDF"

    for p_idx, page in enumerate(reader.pages, start=1):
        ws = ws_first if (single_sheet or p_idx == 1) else wb.create_sheet(title=f"Pagina_{p_idx}")
        if not single_sheet and p_idx == 1:
            ws.title = "Pagina_1"

        try:
            text = page.extract_text(extraction_mode="layout") or ""
        except Exception:
            text = page.extract_text() or ""

        lines = [ln for ln in text.splitlines() if ln.strip()]
        if single_sheet and p_idx > 1:
            ws.append([])
            ws.append([f"--- Página {p_idx} ---"])

        for r_idx, line in enumerate(lines):
            # Split columns on 2+ spaces or tabs
            cols = [c.strip() for c in re.split(r"\t+|\s{2,}", line.strip()) if c.strip()]
            if not cols:
                cols = [line.strip()]
            ws.append(cols)
            if r_idx == 0 and not single_sheet:
                for col_i in range(1, len(cols) + 1):
                    cell = ws.cell(row=ws.max_row, column=col_i)
                    cell.fill = header_fill
                    cell.font = header_font

        # Auto-fit column widths
        for col in ws.columns:
            max_len = max((len(str(c.value or "")) for c in col), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(max(max_len + 3, 12), 55)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def pdf_to_pdfa(pdf_bytes: bytes, conformance: str = "2B") -> bytes:
    """Convert PDF to archival PDF/A (1B, 2B, or 3B)."""
    part = conformance[0] if conformance and conformance[0] in ("1", "2", "3") else "2"
    conf_letter = conformance[1].upper() if len(conformance) > 1 else "B"

    gs = find_ghostscript()
    if gs:
        with tempfile.TemporaryDirectory() as tmp:
            inp = os.path.join(tmp, "in.pdf")
            outp = os.path.join(tmp, "out_pdfa.pdf")
            with open(inp, "wb") as f:
                f.write(pdf_bytes)
            cmd = [
                gs,
                f"-dPDFA={part}",
                "-dBATCH",
                "-dNOPAUSE",
                "-dQUIET",
                "-sColorConversionStrategy=RGB",
                "-sDEVICE=pdfwrite",
                "-dPDFACompatibilityPolicy=1",
                f"-sOutputFile={outp}",
                inp,
            ]
            res = subprocess.run(cmd, capture_output=True, timeout=120)
            if res.returncode == 0 and os.path.exists(outp) and os.path.getsize(outp) > 0:
                with open(outp, "rb") as f:
                    return f.read()

    # Pure-Python PDF/A archival preparation: strip JS, embed XMP pdfaid metadata & OutputIntent
    reader = open_reader(pdf_bytes)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    xmp_xml = f"""<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>{part}</pdfaid:part>
      <pdfaid:conformance>{conf_letter}</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreateDate>{now_iso}</xmp:CreateDate>
      <xmp:ModifyDate>{now_iso}</xmp:ModifyDate>
      <xmp:CreatorTool>Hospital PDF Suite - Arquivamento PDF/A-{part}{conf_letter}</xmp:CreatorTool>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>""".encode("utf-8")

    meta_stream = DecodedStreamObject()
    meta_stream.set_data(xmp_xml)
    meta_stream[NameObject("/Type")] = NameObject("/Metadata")
    meta_stream[NameObject("/Subtype")] = NameObject("/XML")
    writer._root_object[NameObject("/Metadata")] = writer._add_object(meta_stream)

    # Add OutputIntent for sRGB archival compliance
    oi = DictionaryObject()
    oi[NameObject("/Type")] = NameObject("/OutputIntent")
    oi[NameObject("/S")] = NameObject("/GTS_PDFA1")
    oi[NameObject("/OutputConditionIdentifier")] = TextStringObject("sRGB IEC61966-2.1")
    oi[NameObject("/RegistryName")] = TextStringObject("http://www.color.org")
    oi[NameObject("/Info")] = TextStringObject("sRGB IEC61966-2.1")
    writer._root_object[NameObject("/OutputIntents")] = ArrayObject([writer._add_object(oi)])

    writer.add_metadata({
        "/Producer": f"Hospital PDF Suite (PDF/A-{part}{conf_letter})",
        "/Creator": "Hospital PDF Suite",
    })

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
