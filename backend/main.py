"""Hospital PDF Suite — FastAPI Backend (100% Local Processing, Zero Data Retention / LGPD)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

import engine_convert as conv
import engine_core as core
import engine_edit_sec as edit_sec

app = FastAPI(
    title="Hospital PDF Suite API",
    description="Suíte completa de ferramentas PDF 100% local para ambiente hospitalar e conformidade LGPD.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Disposition",
        "X-Original-Size",
        "X-Output-Size",
        "X-Tool-Message",
        "X-Redaction-Count",
    ],
)


def _file_response(
    data: bytes,
    filename: str,
    media_type: str = "application/pdf",
    original_size: Optional[int] = None,
    message: Optional[str] = None,
    extra_headers: Optional[dict] = None,
) -> Response:
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Output-Size": str(len(data)),
        "Cache-Control": "no-store, max-age=0",
    }
    if original_size is not None:
        headers["X-Original-Size"] = str(original_size)
    if message:
        # Encode safely to ASCII for HTTP headers
        headers["X-Tool-Message"] = message.encode("latin-1", "replace").decode("latin-1")
    if extra_headers:
        headers.update(extra_headers)
    return Response(content=data, media_type=media_type, headers=headers)


async def _read_upload(upload: UploadFile) -> bytes:
    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail="Arquivo enviado está vazio.")
    return data


def _handle_err(exc: Exception) -> None:
    if isinstance(exc, HTTPException):
        raise exc
    raise HTTPException(status_code=400, detail=str(exc))


# ==================== HEALTH & INSPECTION ====================

@app.get("/api/health")
def health():
    return {"status": "ok", "lgpd_local_only": True}


@app.get("/api/capabilities")
def capabilities():
    return core.get_capabilities()


@app.post("/api/inspect")
async def api_inspect(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    include_thumbnails: bool = Form(True),
):
    try:
        data = await _read_upload(file)
        return core.inspect_pdf(data, password=password, include_thumbnails=include_thumbnails)
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/render-page")
async def api_render_page(
    file: UploadFile = File(...),
    page_index: int = Form(0),
    scale: float = Form(1.6),
    password: Optional[str] = Form(None),
):
    try:
        data = await _read_upload(file)
        png = core.render_page_png_bytes(data, page_index=page_index, scale=scale, password=password)
        return Response(content=png, media_type="image/png", headers={"Cache-Control": "no-store"})
    except Exception as exc:
        _handle_err(exc)


# ==================== ORGANIZE PDF (6) ====================

@app.post("/api/tools/merge")
async def tool_merge(files: List[UploadFile] = File(...)):
    try:
        blobs = [await _read_upload(f) for f in files]
        if len(blobs) < 2:
            raise ValueError("Envie pelo menos 2 arquivos PDF para juntar.")
        out = core.merge_pdfs(blobs)
        return _file_response(out, "hospital_unificado.pdf", original_size=sum(len(b) for b in blobs), message=f"{len(blobs)} PDFs unidos com sucesso.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/split")
async def tool_split(
    file: UploadFile = File(...),
    mode: str = Form("ranges"),
    ranges: str = Form(""),
    fixed_step: int = Form(1),
    merge_ranges: bool = Form(False),
):
    try:
        data = await _read_upload(file)
        out, fname, mtype = core.split_pdf(data, mode=mode, ranges=ranges, fixed_step=fixed_step, merge_ranges=merge_ranges)
        return _file_response(out, fname, media_type=mtype, original_size=len(data), message="PDF dividido com sucesso.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/remove-pages")
async def tool_remove_pages(
    file: UploadFile = File(...),
    pages: str = Form(...),
):
    try:
        data = await _read_upload(file)
        pages_list = [int(x) for x in json.loads(pages)]
        out = core.remove_pages(data, pages_list)
        return _file_response(out, "paginas_removidas.pdf", original_size=len(data), message=f"{len(pages_list)} pagina(s) removida(s).")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/extract-pages")
async def tool_extract_pages(
    file: UploadFile = File(...),
    pages: str = Form(...),
    separate_files: bool = Form(False),
):
    try:
        data = await _read_upload(file)
        pages_list = [int(x) for x in json.loads(pages)]
        out, fname, mtype = core.extract_pages(data, pages_list, separate_files=separate_files)
        return _file_response(out, fname, media_type=mtype, original_size=len(data), message=f"{len(pages_list)} pagina(s) extraida(s).")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/organize")
async def tool_organize(
    files: List[UploadFile] = File(...),
    plan: str = Form(...),
):
    try:
        blobs = [await _read_upload(f) for f in files]
        plan_list = json.loads(plan)
        out = core.organize_pages(blobs, plan_list)
        return _file_response(out, "pdf_organizado.pdf", original_size=sum(len(b) for b in blobs), message="Paginas reorganizadas com sucesso.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/scan-to-pdf")
async def tool_scan_to_pdf(
    files: List[UploadFile] = File(...),
    filter_mode: str = Form("document"),
    page_size: str = Form("A4"),
):
    try:
        blobs = [await _read_upload(f) for f in files]
        out = core.scan_to_pdf(blobs, filter_mode=filter_mode, page_size=page_size)
        return _file_response(out, "documento_digitalizado.pdf", original_size=sum(len(b) for b in blobs), message="Digitalizacao convertida em PDF.")
    except Exception as exc:
        _handle_err(exc)


# ==================== OPTIMIZE PDF (3) ====================

@app.post("/api/tools/compress")
async def tool_compress(
    file: UploadFile = File(...),
    level: str = Form("recommended"),
):
    try:
        data = await _read_upload(file)
        out = core.compress_pdf(data, level=level)
        saved_pct = max(0.0, round((1.0 - len(out) / max(len(data), 1)) * 100.0, 1))
        return _file_response(out, "pdf_comprimido.pdf", original_size=len(data), message=f"Reducao de {saved_pct}% no tamanho.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/repair")
async def tool_repair(file: UploadFile = File(...)):
    try:
        data = await _read_upload(file)
        out, msg = core.repair_pdf(data)
        return _file_response(out, "pdf_reparado.pdf", original_size=len(data), message=msg)
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/ocr")
async def tool_ocr(
    file: UploadFile = File(...),
    lang: str = Form("por+eng"),
    client_ocr_pages: Optional[str] = Form(None),
):
    try:
        data = await _read_upload(file)
        ocr_pages = json.loads(client_ocr_pages) if client_ocr_pages else None
        out, msg = core.ocr_pdf(data, lang=lang, client_ocr_pages=ocr_pages)
        return _file_response(out, "pdf_pesquisavel_ocr.pdf", original_size=len(data), message=msg)
    except Exception as exc:
        _handle_err(exc)


# ==================== CONVERT TO PDF (5) ====================

@app.post("/api/tools/jpg-to-pdf")
async def tool_jpg_to_pdf(
    files: List[UploadFile] = File(...),
    page_size: str = Form("A4"),
    orientation: str = Form("portrait"),
    margin: str = Form("small"),
):
    try:
        blobs = [await _read_upload(f) for f in files]
        out = conv.images_to_pdf(blobs, page_size=page_size, orientation=orientation, margin=margin)
        return _file_response(out, "imagens_para_pdf.pdf", original_size=sum(len(b) for b in blobs), message=f"{len(blobs)} imagem(ns) convertida(s).")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/word-to-pdf")
async def tool_word_to_pdf(file: UploadFile = File(...)):
    try:
        data = await _read_upload(file)
        out = conv.word_to_pdf(data, filename=file.filename or "documento.docx")
        stem = Path(file.filename or "documento").stem
        return _file_response(out, f"{stem}.pdf", original_size=len(data), message="Documento Word convertido em PDF.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/powerpoint-to-pdf")
async def tool_powerpoint_to_pdf(file: UploadFile = File(...)):
    try:
        data = await _read_upload(file)
        out = conv.powerpoint_to_pdf(data, filename=file.filename or "apresentacao.pptx")
        stem = Path(file.filename or "apresentacao").stem
        return _file_response(out, f"{stem}.pdf", original_size=len(data), message="Apresentacao convertida em PDF.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/excel-to-pdf")
async def tool_excel_to_pdf(
    file: UploadFile = File(...),
    orientation: str = Form("landscape"),
):
    try:
        data = await _read_upload(file)
        out = conv.excel_to_pdf(data, filename=file.filename or "planilha.xlsx", orientation=orientation)
        stem = Path(file.filename or "planilha").stem
        return _file_response(out, f"{stem}.pdf", original_size=len(data), message="Planilha Excel convertida em PDF.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/html-to-pdf")
async def tool_html_to_pdf(
    html_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    page_size: str = Form("A4"),
    orientation: str = Form("portrait"),
):
    try:
        content = html_content or ""
        if file is not None:
            raw = await file.read()
            if raw:
                content = raw.decode("utf-8", errors="replace")
        out = conv.html_to_pdf(content, page_size=page_size, orientation=orientation)
        return _file_response(out, "pagina_html.pdf", message="HTML convertido em PDF.")
    except Exception as exc:
        _handle_err(exc)


# ==================== CONVERT FROM PDF (5) ====================

@app.post("/api/tools/pdf-to-jpg")
async def tool_pdf_to_jpg(
    file: UploadFile = File(...),
    mode: str = Form("pages"),
    dpi: int = Form(150),
    fmt: str = Form("jpg"),
):
    try:
        data = await _read_upload(file)
        out, fname, mtype = conv.pdf_to_jpg(data, mode=mode, dpi=dpi, fmt=fmt)
        return _file_response(out, fname, media_type=mtype, original_size=len(data), message="Imagens geradas com sucesso.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/pdf-to-word")
async def tool_pdf_to_word(file: UploadFile = File(...)):
    try:
        data = await _read_upload(file)
        out = conv.pdf_to_word(data)
        stem = Path(file.filename or "documento").stem
        return _file_response(
            out,
            f"{stem}.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            original_size=len(data),
            message="PDF convertido para Word (.docx).",
        )
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/pdf-to-powerpoint")
async def tool_pdf_to_powerpoint(
    file: UploadFile = File(...),
    mode: str = Form("slides_image"),
):
    try:
        data = await _read_upload(file)
        out = conv.pdf_to_powerpoint(data, mode=mode)
        stem = Path(file.filename or "apresentacao").stem
        return _file_response(
            out,
            f"{stem}.pptx",
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            original_size=len(data),
            message="PDF convertido para PowerPoint (.pptx).",
        )
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/pdf-to-excel")
async def tool_pdf_to_excel(
    file: UploadFile = File(...),
    single_sheet: bool = Form(False),
):
    try:
        data = await _read_upload(file)
        out = conv.pdf_to_excel(data, single_sheet=single_sheet)
        stem = Path(file.filename or "planilha").stem
        return _file_response(
            out,
            f"{stem}.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            original_size=len(data),
            message="PDF convertido para Excel (.xlsx).",
        )
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/pdf-to-pdfa")
async def tool_pdf_to_pdfa(
    file: UploadFile = File(...),
    conformance: str = Form("2B"),
):
    try:
        data = await _read_upload(file)
        out = conv.pdf_to_pdfa(data, conformance=conformance)
        stem = Path(file.filename or "documento").stem
        return _file_response(
            out,
            f"{stem}_PDFA-{conformance}.pdf",
            original_size=len(data),
            message=f"Convertido para arquivamento PDF/A-{conformance}.",
        )
    except Exception as exc:
        _handle_err(exc)


# ==================== EDIT PDF (5) ====================

@app.post("/api/tools/rotate")
async def tool_rotate(
    file: UploadFile = File(...),
    angle: int = Form(90),
    per_page: Optional[str] = Form(None),
):
    try:
        data = await _read_upload(file)
        pmap = json.loads(per_page) if per_page else None
        out = edit_sec.rotate_pdf(data, angle=angle, per_page=pmap)
        return _file_response(out, "pdf_rotacionado.pdf", original_size=len(data), message="Rotacao aplicada com sucesso.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/page-numbers")
async def tool_page_numbers(
    file: UploadFile = File(...),
    position: str = Form("bottom-center"),
    template: str = Form("Página {n} de {total}"),
    start_number: int = Form(1),
    from_page: int = Form(1),
    to_page: Optional[int] = Form(None),
    font_size: int = Form(11),
    color_hex: str = Form("#334155"),
    margin: int = Form(28),
):
    try:
        data = await _read_upload(file)
        out = edit_sec.add_page_numbers(
            data,
            position=position,
            template=template,
            start_number=start_number,
            from_page=from_page,
            to_page=to_page,
            font_size=font_size,
            color_hex=color_hex,
            margin=margin,
        )
        return _file_response(out, "pdf_numerado.pdf", original_size=len(data), message="Numeracao inserida com sucesso.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/watermark")
async def tool_watermark(
    file: UploadFile = File(...),
    wm_type: str = Form("text"),
    text: str = Form("USO INTERNO HOSPITALAR"),
    watermark_image: Optional[UploadFile] = File(None),
    position: str = Form("middle-center"),
    opacity: float = Form(0.28),
    rotation: int = Form(45),
    font_size: int = Form(38),
    color_hex: str = Form("#0D9488"),
    mosaic: bool = Form(False),
    from_page: int = Form(1),
    to_page: Optional[int] = Form(None),
):
    try:
        data = await _read_upload(file)
        img_bytes = await watermark_image.read() if watermark_image else None
        out = edit_sec.add_watermark(
            data,
            wm_type=wm_type,
            text=text,
            image_bytes=img_bytes,
            position=position,
            opacity=opacity,
            rotation=rotation,
            font_size=font_size,
            color_hex=color_hex,
            mosaic=mosaic,
            from_page=from_page,
            to_page=to_page,
        )
        return _file_response(out, "pdf_marca_dagua.pdf", original_size=len(data), message="Marca d'agua aplicada.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/crop")
async def tool_crop(
    file: UploadFile = File(...),
    x: float = Form(0.05),
    y: float = Form(0.05),
    width: float = Form(0.9),
    height: float = Form(0.9),
    apply_to: str = Form("all"),
    target_page: int = Form(0),
):
    try:
        data = await _read_upload(file)
        out = edit_sec.crop_pdf(data, x=x, y=y, width=width, height=height, apply_to=apply_to, target_page=target_page)
        return _file_response(out, "pdf_recortado.pdf", original_size=len(data), message="Recorte aplicado com sucesso.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/edit")
async def tool_edit(
    file: UploadFile = File(...),
    annotations: str = Form("[]"),
):
    try:
        data = await _read_upload(file)
        ann_list = json.loads(annotations)
        out = edit_sec.edit_pdf(data, ann_list)
        return _file_response(out, "pdf_editado.pdf", original_size=len(data), message=f"{len(ann_list)} anotacao(oes) salva(s) no PDF.")
    except Exception as exc:
        _handle_err(exc)


# ==================== SECURITY & COMPARE (5) ====================

@app.post("/api/tools/unlock")
async def tool_unlock(
    file: UploadFile = File(...),
    password: str = Form(""),
):
    try:
        data = await _read_upload(file)
        out = edit_sec.unlock_pdf(data, password=password)
        return _file_response(out, "pdf_desbloqueado.pdf", original_size=len(data), message="PDF desbloqueado com sucesso.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/protect")
async def tool_protect(
    file: UploadFile = File(...),
    user_password: str = Form(...),
    owner_password: Optional[str] = Form(None),
    allow_print: bool = Form(True),
    allow_copy: bool = Form(False),
):
    try:
        data = await _read_upload(file)
        out = edit_sec.protect_pdf(
            data,
            user_password=user_password,
            owner_password=owner_password,
            allow_print=allow_print,
            allow_copy=allow_copy,
        )
        return _file_response(out, "pdf_protegido.pdf", original_size=len(data), message="Criptografia AES-256 aplicada.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/sign")
async def tool_sign(
    file: UploadFile = File(...),
    signatures: str = Form("[]"),
):
    try:
        data = await _read_upload(file)
        sig_list = json.loads(signatures)
        if not sig_list:
            raise ValueError("Posicione ao menos uma assinatura no documento antes de salvar.")
        out = edit_sec.sign_pdf(data, sig_list)
        return _file_response(out, "pdf_assinado.pdf", original_size=len(data), message="Documento assinado com sucesso.")
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/redact")
async def tool_redact(
    file: UploadFile = File(...),
    boxes: str = Form("[]"),
    auto_patterns: str = Form("[]"),
    custom_terms: str = Form("[]"),
    fill_color: str = Form("#000000"),
):
    try:
        data = await _read_upload(file)
        box_list = json.loads(boxes)
        pat_list = json.loads(auto_patterns)
        term_list = json.loads(custom_terms)
        out, count = edit_sec.redact_pdf(data, box_list, pat_list, term_list, fill_color=fill_color)
        return _file_response(
            out,
            "pdf_tarjado_lgpd.pdf",
            original_size=len(data),
            message=f"{count} area(s) sensivel(is) ocultada(s) permanentemente (LGPD).",
            extra_headers={"X-Redaction-Count": str(count)},
        )
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/compare")
async def tool_compare(
    file_left: UploadFile = File(...),
    file_right: UploadFile = File(...),
):
    try:
        b1 = await _read_upload(file_left)
        b2 = await _read_upload(file_right)
        return JSONResponse(content=edit_sec.compare_pdf(b1, b2))
    except Exception as exc:
        _handle_err(exc)


@app.post("/api/tools/compare-report")
async def tool_compare_report(
    file_left: UploadFile = File(...),
    file_right: UploadFile = File(...),
):
    try:
        b1 = await _read_upload(file_left)
        b2 = await _read_upload(file_right)
        out = edit_sec.compare_pdf_report(b1, b2)
        return _file_response(out, "relatorio_comparacao.pdf", message="Relatorio visual de comparacao gerado.")
    except Exception as exc:
        _handle_err(exc)


# ==================== SERVE BUILT FRONTEND (PRODUCTION / INTRANET) ====================

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(FRONTEND_DIST / "index.html"))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
