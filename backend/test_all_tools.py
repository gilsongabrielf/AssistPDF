"""Automated end-to-end verification of all 29 Hospital PDF Suite tools."""
from __future__ import annotations

import base64
import io
import json
import zipfile

from docx import Document as DocxDocument
from openpyxl import Workbook
from PIL import Image
from pptx import Presentation
from pypdf import PdfReader
from reportlab.pdfgen import canvas as rl_canvas

import engine_convert as conv
import engine_core as core
import engine_edit_sec as edit_sec
import main


def make_sample_pdf(pages_text: list[str]) -> bytes:
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf)
    for txt in pages_text:
        c.setFont("Helvetica", 12)
        y = 750
        for line in txt.splitlines():
            c.drawString(50, y, line)
            y -= 20
        c.showPage()
    c.save()
    return buf.getvalue()


def make_sample_png(color=(13, 148, 136)) -> bytes:
    im = Image.new("RGB", (320, 220), color=color)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def make_sample_docx() -> bytes:
    d = DocxDocument()
    d.add_heading("Laudo Hospitalar", level=1)
    d.add_paragraph("Paciente atendido com sucesso.")
    t = d.add_table(rows=2, cols=2)
    t.cell(0, 0).text = "Exame"
    t.cell(0, 1).text = "Resultado"
    t.cell(1, 0).text = "Hemograma"
    t.cell(1, 1).text = "Normal"
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def make_sample_xlsx() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Escala"
    ws.append(["Setor", "Plantao", "Status"])
    ws.append(["UTI Adulto", "Noturno", "Completo"])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def make_sample_pptx() -> bytes:
    prs = Presentation()
    s = prs.slides.add_slide(prs.slide_layouts[1])
    s.shapes.title.text = "Protocolo de Seguranca do Paciente"
    s.placeholders[1].text = "Identificacao correta\nHigienizacao das maos"
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def run_all():
    pdf_a = make_sample_pdf([
        "Prontuario Medico\nPaciente: Maria da Silva\nCPF: 123.456.789-00\nEmail: maria@exemplo.com",
        "Evolucao Clinica\nSetor: Clinica Medica   Leito: 12   Status: Estavel",
        "Alta Hospitalar\nRetorno em 15 dias.",
    ])
    pdf_b = make_sample_pdf([
        "Prontuario Medico\nPaciente: Maria da Silva\nCPF: 123.456.789-00\nEmail: maria@exemplo.com",
        "Evolucao Clinica ALTERADA\nSetor: UTI   Leito: 04   Status: Observacao",
    ])
    png_bytes = make_sample_png()
    png_b64 = "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")

    # Verify FastAPI route registration & built frontend dist
    route_paths = {r.path for r in main.app.routes}
    assert "/api/health" in route_paths
    assert "/api/tools/merge" in route_paths
    assert "/api/tools/redact" in route_paths
    assert "/api/tools/compare" in route_paths
    assert (main.FRONTEND_DIST / "index.html").exists()

    # Inspect & Render
    insp = core.inspect_pdf(pdf_a)
    assert insp["page_count"] == 3 and insp["pages"][0]["thumbnail"].startswith("data:image/jpeg")
    png_render = core.render_page_png_bytes(pdf_a, 0)
    assert png_render[:4] == b"\x89PNG"

    # 1. Merge
    d = core.merge_pdfs([pdf_a, pdf_b])
    assert len(PdfReader(io.BytesIO(d)).pages) == 5

    # 2. Split
    d, fname, _ = core.split_pdf(pdf_a, mode="ranges", ranges="1-2, 3")
    assert zipfile.is_zipfile(io.BytesIO(d))

    # 3. Remove pages
    d = core.remove_pages(pdf_a, [2])
    assert len(PdfReader(io.BytesIO(d)).pages) == 2

    # 4. Extract pages
    d, _, _ = core.extract_pages(pdf_a, [1, 3], separate_files=False)
    assert len(PdfReader(io.BytesIO(d)).pages) == 2

    # 5. Organize
    d = core.organize_pages([pdf_a], [{"file_index": 0, "page_index": 2, "rotation": 90}, {"file_index": 0, "page_index": 0, "rotation": 0}])
    assert len(PdfReader(io.BytesIO(d)).pages) == 2

    # 6. Scan to PDF
    d = core.scan_to_pdf([png_bytes], filter_mode="document")
    assert len(PdfReader(io.BytesIO(d)).pages) == 1

    # 7. Compress
    for lvl in ("low", "recommended", "extreme"):
        d = core.compress_pdf(pdf_a, level=lvl)
        assert len(PdfReader(io.BytesIO(d)).pages) == 3

    # 8. Repair
    d, msg = core.repair_pdf(pdf_a)
    assert len(PdfReader(io.BytesIO(d)).pages) == 3

    # 9. OCR (client OCR layer)
    ocr_pages = [{"page_index": 0, "image_width": 595, "image_height": 842, "words": [{"text": "HOSPITALOCR", "x0": 50, "y0": 50, "x1": 180, "y1": 70}]}]
    d, msg = core.ocr_pdf(pdf_a, client_ocr_pages=ocr_pages)
    assert "HOSPITALOCR" in (PdfReader(io.BytesIO(d)).pages[0].extract_text() or "")

    # 10. JPG to PDF
    d = conv.images_to_pdf([png_bytes])
    assert len(PdfReader(io.BytesIO(d)).pages) == 1

    # 11. Word to PDF
    d = conv.word_to_pdf(make_sample_docx(), "laudo.docx")
    assert len(PdfReader(io.BytesIO(d)).pages) >= 1

    # 12. PowerPoint to PDF
    d = conv.powerpoint_to_pdf(make_sample_pptx(), "slides.pptx")
    assert len(PdfReader(io.BytesIO(d)).pages) == 1

    # 13. Excel to PDF
    d = conv.excel_to_pdf(make_sample_xlsx(), "escala.xlsx")
    assert len(PdfReader(io.BytesIO(d)).pages) >= 1

    # 14. HTML to PDF
    d = conv.html_to_pdf("<h1>Relatorio</h1><p>Paciente OK</p>")
    assert len(PdfReader(io.BytesIO(d)).pages) >= 1

    # 15. PDF to JPG
    d, _, _ = conv.pdf_to_jpg(pdf_a, mode="pages", dpi=100)
    assert zipfile.is_zipfile(io.BytesIO(d))

    # 16. PDF to Word
    d = conv.pdf_to_word(pdf_a)
    assert zipfile.is_zipfile(io.BytesIO(d))

    # 17. PDF to PowerPoint
    d = conv.pdf_to_powerpoint(pdf_a)
    assert zipfile.is_zipfile(io.BytesIO(d))

    # 18. PDF to Excel
    d = conv.pdf_to_excel(pdf_a)
    assert zipfile.is_zipfile(io.BytesIO(d))

    # 19. PDF to PDF/A
    d = conv.pdf_to_pdfa(pdf_a, conformance="2B")
    assert b"pdfaid:part" in d

    # 20. Rotate
    d = edit_sec.rotate_pdf(pdf_a, angle=90)
    assert len(PdfReader(io.BytesIO(d)).pages) == 3

    # 21. Page numbers
    d = edit_sec.add_page_numbers(pdf_a, position="bottom-center")
    assert len(PdfReader(io.BytesIO(d)).pages) == 3

    # 22. Watermark
    d = edit_sec.add_watermark(pdf_a, text="CONFIDENCIAL", mosaic=True)
    assert len(PdfReader(io.BytesIO(d)).pages) == 3

    # 23. Crop
    d = edit_sec.crop_pdf(pdf_a, x=0.1, y=0.1, width=0.8, height=0.8)
    assert len(PdfReader(io.BytesIO(d)).pages) == 3

    # 24. Edit
    anns = [
        {"page_index": 0, "type": "text", "x": 0.2, "y": 0.2, "text": "Aprovado", "color": "#C81E3A", "fontSize": 14},
        {"page_index": 0, "type": "highlight", "x": 0.1, "y": 0.3, "width": 0.4, "height": 0.05, "color": "#FACC15"},
        {"page_index": 0, "type": "draw", "color": "#0D9488", "points": [{"x": 0.1, "y": 0.5}, {"x": 0.3, "y": 0.55}]},
    ]
    d = edit_sec.edit_pdf(pdf_a, anns)
    assert len(PdfReader(io.BytesIO(d)).pages) == 3

    # 25 & 26. Protect & Unlock (AES-256 round-trip)
    prot = edit_sec.protect_pdf(pdf_a, user_password="Hosp2026!")
    assert PdfReader(io.BytesIO(prot)).is_encrypted
    unlk = edit_sec.unlock_pdf(prot, password="Hosp2026!")
    assert not PdfReader(io.BytesIO(unlk)).is_encrypted

    # 27. Sign
    sigs = [{"page_index": 0, "x": 0.5, "y": 0.7, "width": 0.3, "height": 0.1, "dataUrl": png_b64, "caption": "Dr. Teste - CRM 12345"}]
    d = edit_sec.sign_pdf(pdf_a, sigs)
    assert len(PdfReader(io.BytesIO(d)).pages) == 3

    # 28. Redact (TRUE LGPD permanent text destruction check!)
    d, red_count = edit_sec.redact_pdf(pdf_a, boxes=[], auto_patterns=["cpf", "email"], custom_terms=["Maria da Silva"])
    assert red_count >= 3
    red_txt = PdfReader(io.BytesIO(d)).pages[0].extract_text() or ""
    assert "123.456.789-00" not in red_txt and "Maria da Silva" not in red_txt

    # 29. Compare + Compare PDF Report
    cmp = edit_sec.compare_pdf(pdf_a, pdf_b)
    assert cmp["changed_pages"] >= 1
    rep = edit_sec.compare_pdf_report(pdf_a, pdf_b)
    assert len(PdfReader(io.BytesIO(rep)).pages) == 3

    print(f"SUCCESS: ALL 29 PDF TOOLS + SPA DIST + LGPD PERMANENT REDACTION ({red_count} areas) PASSED!")


if __name__ == "__main__":
    run_all()
