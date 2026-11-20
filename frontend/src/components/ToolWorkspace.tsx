import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Highlighter,
  Image as ImageIcon,
  Loader2,
  Pen,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import type { ToolDef } from "../data/tools";
import {
  type Capabilities,
  type CompareResult,
  type PdfInspectResult,
  type ToolDownloadResult,
  formatBytes,
  inspectPdfFile,
  runCompareRequest,
  runLocalBrowserOcr,
  runToolRequest,
  triggerBlobDownload,
} from "../lib/api";
import { CameraScanner } from "./CameraScanner";
import { DropZone } from "./DropZone";
import {
  type EditAnnotation,
  type NormRect,
  PageCanvasEditor,
  type PlacedSignature,
} from "./PageCanvasEditor";
import { SignaturePad } from "./SignaturePad";
import { ToolIcon } from "./ToolIcon";

interface Props {
  tool: ToolDef;
  capabilities: Capabilities | null;
}

interface OrganizeTile {
  uid: string;
  fileIndex: number;
  pageIndex: number;
  pageNumber: number;
  fileName: string;
  rotation: number;
  thumbnail: string | null;
}

const DEFAULT_HTML_SAMPLE = `<h1>Relatório Interno Hospitalar</h1>
<p>Documento gerado localmente pelo portal institucional de documentos PDF.</p>
<h2>Resumo do Setor</h2>
<ul>
  <li>Processamento 100% interno na rede do hospital</li>
  <li>Conformidade com a LGPD (sem envio de dados à nuvem)</li>
  <li>Padronização documental para prontuários e protocolos</li>
</ul>
<table>
  <tr><th>Indicador</th><th>Meta</th><th>Status</th></tr>
  <tr><td>Tempo de triagem</td><td>&lt; 10 min</td><td>Conforme</td></tr>
  <tr><td>Segurança do paciente</td><td>100%</td><td>Auditado</td></tr>
</table>`;

const POSITIONS_3X3 = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export const ToolWorkspace: React.FC<Props> = ({ tool, capabilities }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [compareRightFile, setCompareRightFile] = useState<File[]>([]);
  const [inspectData, setInspectData] = useState<PdfInspectResult | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [progressPct, setProgressPct] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolDownloadResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [comparePageIdx, setComparePageIdx] = useState(0);

  // Page selection & organization states
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [organizeTiles, setOrganizeTiles] = useState<OrganizeTile[]>([]);
  const [perPageRotations, setPerPageRotations] = useState<Record<number, number>>({});
  const [currentPage, setCurrentPage] = useState(0);

  // Split options
  const [splitMode, setSplitMode] = useState<"ranges" | "fixed" | "all">("ranges");
  const [splitRanges, setSplitRanges] = useState("1-2");
  const [splitFixedStep, setSplitFixedStep] = useState(1);
  const [splitMerge, setSplitMerge] = useState(false);
  const [extractSeparate, setExtractSeparate] = useState(false);

  // Scan / Images to PDF options
  const [scanFilter, setScanFilter] = useState("document");
  const [pageSize, setPageSize] = useState("A4");
  const [orientation, setOrientation] = useState("portrait");
  const [imgMargin, setImgMargin] = useState("small");

  // Compress / OCR / PDF to JPG / PPT / Excel / PDFA
  const [compressLevel, setCompressLevel] = useState<"extreme" | "recommended" | "low">("recommended");
  const [ocrLang, setOcrLang] = useState("por+eng");
  const [excelOrient, setExcelOrient] = useState("landscape");
  const [htmlContent, setHtmlContent] = useState(DEFAULT_HTML_SAMPLE);
  const [pdfToJpgMode, setPdfToJpgMode] = useState("pages");
  const [pdfToJpgDpi, setPdfToJpgDpi] = useState(150);
  const [pdfToJpgFmt, setPdfToJpgFmt] = useState("jpg");
  const [pptMode, setPptMode] = useState("slides_image");
  const [excelSingleSheet, setExcelSingleSheet] = useState(false);
  const [pdfaConformance, setPdfaConformance] = useState("2B");

  // Rotate / Page Numbers / Watermark
  const [rotateAngle, setRotateAngle] = useState(90);
  const [numPosition, setNumPosition] = useState("bottom-center");
  const [numTemplate, setNumTemplate] = useState("Página {n} de {total}");
  const [numStart, setNumStart] = useState(1);
  const [numFontSize, setNumFontSize] = useState(11);
  const [numColor, setNumColor] = useState("#334155");

  const [wmType, setWmType] = useState<"text" | "image">("text");
  const [wmText, setWmText] = useState("CONFIDENCIAL • USO HOSPITALAR");
  const [wmImageFile, setWmImageFile] = useState<File | null>(null);
  const [wmPosition, setWmPosition] = useState("middle-center");
  const [wmOpacity, setWmOpacity] = useState(0.26);
  const [wmRotation, setWmRotation] = useState(40);
  const [wmFontSize, setWmFontSize] = useState(34);
  const [wmColor, setWmColor] = useState("#0D9488");
  const [wmMosaic, setWmMosaic] = useState(false);

  // Crop / Edit / Sign / Redact
  const [cropRect, setCropRect] = useState<NormRect>({ page_index: 0, x: 0.08, y: 0.08, width: 0.84, height: 0.84 });
  const [cropApplyTo, setCropApplyTo] = useState<"all" | "single">("all");

  const [editTool, setEditTool] = useState<"text" | "highlight" | "rect" | "draw" | "image">("text");
  const [editColor, setEditColor] = useState("#C81E3A");
  const [editText, setEditText] = useState("Revisado — Equipe Clínica");
  const [editFontSize, setEditFontSize] = useState(14);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<EditAnnotation[]>([]);

  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [sigCaption, setSigCaption] = useState(
    `Assinado em ${new Date().toLocaleDateString("pt-BR")}\nCRM / COREN:`
  );
  const [signatures, setSignatures] = useState<PlacedSignature[]>([]);

  const [redactBoxes, setRedactBoxes] = useState<NormRect[]>([]);
  const [redactPatterns, setRedactPatterns] = useState<string[]>(["cpf"]);
  const [redactTerms, setRedactTerms] = useState("");
  const [redactColor, setRedactColor] = useState("#000000");

  // Unlock / Protect
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(false);

  // Reset state whenever tool changes
  useEffect(() => {
    setFiles([]);
    setCompareRightFile([]);
    setInspectData(null);
    setError(null);
    setResult(null);
    setCompareResult(null);
    setSelectedPages([]);
    setOrganizeTiles([]);
    setPerPageRotations({});
    setCurrentPage(0);
    setAnnotations([]);
    setSignatures([]);
    setRedactBoxes([]);
    setPassword("");
    setConfirmPassword("");
    setProgressMsg("");
    setProgressPct(0);
  }, [tool.id]);

  // Auto-inspect PDFs for tools that need page previews or page count
  const needsInspect = [
    "split",
    "remove-pages",
    "extract-pages",
    "organize",
    "rotate",
    "crop",
    "edit",
    "sign",
    "redact",
    "ocr",
  ].includes(tool.id);

  useEffect(() => {
    if (!needsInspect || files.length === 0) {
      setInspectData(null);
      setOrganizeTiles([]);
      return;
    }

    let alive = true;
    setInspectLoading(true);
    setError(null);

    if (tool.id === "organize") {
      Promise.all(files.map((f) => inspectPdfFile(f, undefined, true)))
        .then((results) => {
          if (!alive) return;
          const tiles: OrganizeTile[] = [];
          results.forEach((res, fIdx) => {
            res.pages.forEach((p) => {
              tiles.push({
                uid: `${fIdx}-${p.index}-${Math.random().toString(36).slice(2, 7)}`,
                fileIndex: fIdx,
                pageIndex: p.index,
                pageNumber: p.number,
                fileName: files[fIdx].name,
                rotation: 0,
                thumbnail: p.thumbnail,
              });
            });
          });
          setOrganizeTiles(tiles);
          setInspectData(results[0] || null);
        })
        .catch((e: Error) => alive && setError(e.message))
        .finally(() => alive && setInspectLoading(false));
    } else {
      const wantThumbs = ["split", "remove-pages", "extract-pages", "rotate"].includes(tool.id);
      inspectPdfFile(files[0], undefined, wantThumbs)
        .then((res) => {
          if (!alive) return;
          setInspectData(res);
          setCurrentPage(0);
          setSelectedPages([]);
          setPerPageRotations({});
          if (tool.id === "split" && res.page_count > 1) {
            setSplitRanges(`1-${Math.ceil(res.page_count / 2)}, ${Math.ceil(res.page_count / 2) + 1}-${res.page_count}`);
          }
        })
        .catch((e: Error) => alive && setError(e.message))
        .finally(() => alive && setInspectLoading(false));
    }

    return () => {
      alive = false;
    };
  }, [files, tool.id, needsInspect]);

  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum].sort((a, b) => a - b)
    );
  };

  const toggleRedactPattern = (key: string) => {
    setRedactPatterns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleProcess = async () => {
    setError(null);
    setResult(null);
    setCompareResult(null);
    setProcessing(true);
    setProgressMsg("Processando localmente...");
    setProgressPct(25);

    try {
      // Special: Compare PDF returns interactive JSON comparison
      if (tool.id === "compare") {
        if (!files[0] || !compareRightFile[0]) {
          throw new Error("Envie os dois arquivos PDF (Original e Revisado) para comparar.");
        }
        const cmp = await runCompareRequest(files[0], compareRightFile[0]);
        setCompareResult(cmp);
        setComparePageIdx(0);
        return;
      }

      const fd = new FormData();
      let endpoint = `/api/tools/${tool.id}`;
      let fallbackName = "resultado.pdf";

      switch (tool.id) {
        case "merge":
          if (files.length < 2) throw new Error("Selecione pelo menos 2 arquivos PDF para juntar.");
          files.forEach((f) => fd.append("files", f));
          fallbackName = "hospital_unificado.pdf";
          break;

        case "split":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("mode", splitMode);
          fd.append("ranges", splitRanges);
          fd.append("fixed_step", String(splitFixedStep));
          fd.append("merge_ranges", String(splitMerge));
          fallbackName = "pdf_dividido.zip";
          break;

        case "remove-pages":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          if (selectedPages.length === 0) throw new Error("Clique em pelo menos uma página para remover.");
          fd.append("file", files[0]);
          fd.append("pages", JSON.stringify(selectedPages));
          fallbackName = "paginas_removidas.pdf";
          break;

        case "extract-pages":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          if (selectedPages.length === 0) throw new Error("Clique em pelo menos uma página para extrair.");
          fd.append("file", files[0]);
          fd.append("pages", JSON.stringify(selectedPages));
          fd.append("separate_files", String(extractSeparate));
          fallbackName = extractSeparate ? "paginas_extraidas.zip" : "paginas_extraidas.pdf";
          break;

        case "organize":
          if (files.length === 0 || organizeTiles.length === 0) throw new Error("Envie ao menos um PDF.");
          files.forEach((f) => fd.append("files", f));
          fd.append(
            "plan",
            JSON.stringify(
              organizeTiles.map((t) => ({
                file_index: t.fileIndex,
                page_index: t.pageIndex,
                rotation: t.rotation,
              }))
            )
          );
          fallbackName = "pdf_organizado.pdf";
          break;

        case "scan-to-pdf":
          if (files.length === 0) throw new Error("Capture ou envie ao menos uma foto do documento.");
          files.forEach((f) => fd.append("files", f));
          fd.append("filter_mode", scanFilter);
          fd.append("page_size", pageSize);
          fallbackName = "documento_digitalizado.pdf";
          break;

        case "compress":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("level", compressLevel);
          fallbackName = "pdf_comprimido.pdf";
          break;

        case "repair":
          if (!files[0]) throw new Error("Selecione o arquivo PDF danificado.");
          fd.append("file", files[0]);
          fallbackName = "pdf_reparado.pdf";
          break;

        case "ocr": {
          if (!files[0]) throw new Error("Selecione um arquivo PDF digitalizado.");
          fd.append("file", files[0]);
          fd.append("lang", ocrLang);
          if (!capabilities?.tesseract) {
            const pCount = inspectData?.page_count || 1;
            const ocrPages = await runLocalBrowserOcr(files[0], pCount, ocrLang, (m, p) => {
              setProgressMsg(m);
              setProgressPct(p);
            });
            fd.append("client_ocr_pages", JSON.stringify(ocrPages));
          }
          fallbackName = "pdf_pesquisavel_ocr.pdf";
          break;
        }

        case "jpg-to-pdf":
          if (files.length === 0) throw new Error("Selecione uma ou mais imagens.");
          files.forEach((f) => fd.append("files", f));
          fd.append("page_size", pageSize);
          fd.append("orientation", orientation);
          fd.append("margin", imgMargin);
          fallbackName = "imagens_para_pdf.pdf";
          break;

        case "word-to-pdf":
        case "powerpoint-to-pdf":
        case "pdf-to-word":
          if (!files[0]) throw new Error("Selecione um arquivo.");
          fd.append("file", files[0]);
          fallbackName = tool.id === "pdf-to-word" ? "documento.docx" : "convertido.pdf";
          break;

        case "excel-to-pdf":
          if (!files[0]) throw new Error("Selecione uma planilha Excel (.xlsx).");
          fd.append("file", files[0]);
          fd.append("orientation", excelOrient);
          fallbackName = "planilha.pdf";
          break;

        case "html-to-pdf":
          if (files[0]) {
            fd.append("file", files[0]);
          } else {
            fd.append("html_content", htmlContent);
          }
          fd.append("page_size", pageSize);
          fd.append("orientation", orientation);
          fallbackName = "pagina_html.pdf";
          break;

        case "pdf-to-jpg":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("mode", pdfToJpgMode);
          fd.append("dpi", String(pdfToJpgDpi));
          fd.append("fmt", pdfToJpgFmt);
          fallbackName = "pdf_imagens.zip";
          break;

        case "pdf-to-powerpoint":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("mode", pptMode);
          fallbackName = "apresentacao.pptx";
          break;

        case "pdf-to-excel":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("single_sheet", String(excelSingleSheet));
          fallbackName = "planilha.xlsx";
          break;

        case "pdf-to-pdfa":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("conformance", pdfaConformance);
          fallbackName = `documento_PDFA-${pdfaConformance}.pdf`;
          break;

        case "rotate":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("angle", String(rotateAngle));
          if (Object.keys(perPageRotations).length > 0) {
            fd.append("per_page", JSON.stringify(perPageRotations));
          }
          fallbackName = "pdf_rotacionado.pdf";
          break;

        case "page-numbers":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("position", numPosition);
          fd.append("template", numTemplate);
          fd.append("start_number", String(numStart));
          fd.append("font_size", String(numFontSize));
          fd.append("color_hex", numColor);
          fallbackName = "pdf_numerado.pdf";
          break;

        case "watermark":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("wm_type", wmType);
          fd.append("text", wmText);
          if (wmType === "image" && wmImageFile) {
            fd.append("watermark_image", wmImageFile);
          }
          fd.append("position", wmPosition);
          fd.append("opacity", String(wmOpacity));
          fd.append("rotation", String(wmRotation));
          fd.append("font_size", String(wmFontSize));
          fd.append("color_hex", wmColor);
          fd.append("mosaic", String(wmMosaic));
          fallbackName = "pdf_marca_dagua.pdf";
          break;

        case "crop":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("x", String(cropRect.x));
          fd.append("y", String(cropRect.y));
          fd.append("width", String(cropRect.width));
          fd.append("height", String(cropRect.height));
          fd.append("apply_to", cropApplyTo);
          fd.append("target_page", String(currentPage));
          fallbackName = "pdf_recortado.pdf";
          break;

        case "edit":
          if (!files[0]) throw new Error("Selecione um arquivo PDF.");
          if (annotations.length === 0) throw new Error("Adicione pelo menos uma anotação na página antes de salvar.");
          fd.append("file", files[0]);
          fd.append("annotations", JSON.stringify(annotations));
          fallbackName = "pdf_editado.pdf";
          break;

        case "unlock":
          if (!files[0]) throw new Error("Selecione o arquivo PDF.");
          fd.append("file", files[0]);
          fd.append("password", password);
          fallbackName = "pdf_desbloqueado.pdf";
          break;

        case "protect":
          if (!files[0]) throw new Error("Selecione o arquivo PDF.");
          if (!password) throw new Error("Digite uma senha para proteger o documento.");
          if (confirmPassword && password !== confirmPassword) {
            throw new Error("A confirmação da senha não confere.");
          }
          fd.append("file", files[0]);
          fd.append("user_password", password);
          fd.append("allow_print", String(allowPrint));
          fd.append("allow_copy", String(allowCopy));
          fallbackName = "pdf_protegido.pdf";
          break;

        case "sign":
          if (!files[0]) throw new Error("Selecione o arquivo PDF.");
          if (signatures.length === 0) {
            throw new Error("Crie sua assinatura ao lado e clique na página do PDF para posicioná-la.");
          }
          fd.append("file", files[0]);
          fd.append("signatures", JSON.stringify(signatures));
          fallbackName = "pdf_assinado.pdf";
          break;

        case "redact": {
          if (!files[0]) throw new Error("Selecione o arquivo PDF.");
          const terms = redactTerms
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (redactBoxes.length === 0 && redactPatterns.length === 0 && terms.length === 0) {
            throw new Error("Desenhe uma tarja na página ou selecione ao menos um padrão automático LGPD.");
          }
          fd.append("file", files[0]);
          fd.append("boxes", JSON.stringify(redactBoxes));
          fd.append("auto_patterns", JSON.stringify(redactPatterns));
          fd.append("custom_terms", JSON.stringify(terms));
          fd.append("fill_color", redactColor);
          fallbackName = "pdf_tarjado_lgpd.pdf";
          break;
        }
      }

      const res = await runToolRequest(endpoint, fd, fallbackName);
      setResult(res);
      triggerBlobDownload(res.blob, res.filename);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro inesperado ao processar o arquivo.");
    } finally {
      setProcessing(false);
      setProgressMsg("");
      setProgressPct(0);
    }
  };

  const handleDownloadCompareReport = async () => {
    if (!files[0] || !compareRightFile[0]) return;
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append("file_left", files[0]);
      fd.append("file_right", compareRightFile[0]);
      const res = await runToolRequest("/api/tools/compare-report", fd, "relatorio_comparacao.pdf");
      triggerBlobDownload(res.blob, res.filename);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao gerar relatório.");
    } finally {
      setProcessing(false);
    }
  };

  const canProcess =
    tool.id === "html-to-pdf"
      ? Boolean(files[0] || htmlContent.trim())
      : tool.id === "compare"
      ? Boolean(files[0] && compareRightFile[0])
      : tool.id === "merge"
      ? files.length >= 2
      : files.length >= 1;

  const savedPercent =
    result?.originalSize && result.originalSize > 0
      ? Math.round((1 - result.outputSize / result.originalSize) * 100)
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Tool Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <ToolIcon icon={tool.icon} accent={tool.accent} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold text-[var(--text-primary)]">
                {tool.name}
              </h1>
              {tool.badge && (
                <span className="rounded-full bg-[var(--crimson-50)] px-2.5 py-0.5 text-xs font-bold text-[var(--crimson-600)] ring-1 ring-[var(--crimson-200)]">
                  {tool.badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{tool.description}</p>
          </div>
        </div>
        {files.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setFiles([]);
              setCompareRightFile([]);
              setResult(null);
              setCompareResult(null);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Novo arquivo
          </button>
        )}
      </div>

      {/* Main Two-Column Workspace */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: Input / Interactive Previews / Canvas */}
        <div className="lg:col-span-8 space-y-5">
          {/* Special: Scan to PDF includes live camera capture */}
          {tool.id === "scan-to-pdf" && (
            <CameraScanner onCaptured={(f) => setFiles((prev) => [...prev, f])} />
          )}

          {/* Special: HTML to PDF allows direct code editor OR .html upload */}
          {tool.id === "html-to-pdf" && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[var(--text-primary)]">
                  Código HTML (ou envie um arquivo .html abaixo)
                </label>
                <span className="text-xs text-[var(--text-muted)]">Suporta títulos, listas e tabelas</span>
              </div>
              <textarea
                rows={10}
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--teal-500)] focus:outline-none"
              />
            </div>
          )}

          {/* Special: Compare PDF dual upload */}
          {tool.id === "compare" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--teal-700)]">
                  1. Documento Original (A)
                </h3>
                <DropZone
                  files={files}
                  accept=".pdf,application/pdf"
                  label="Selecionar PDF A"
                  onChange={setFiles}
                />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--crimson-600)]">
                  2. Documento Revisado (B)
                </h3>
                <DropZone
                  files={compareRightFile}
                  accept=".pdf,application/pdf"
                  label="Selecionar PDF B"
                  onChange={setCompareRightFile}
                />
              </div>
            </div>
          ) : (
            <DropZone
              files={files}
              accept={tool.accept}
              multiple={tool.multiple}
              label={tool.multiple ? "Selecionar arquivos" : "Selecionar arquivo"}
              onChange={setFiles}
            />
          )}

          {/* Loading thumbnails indicator */}
          {inspectLoading && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-white p-8 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--teal-600)]" />
              Carregando visualização das páginas...
            </div>
          )}

          {/* VISUAL PAGE GRID: Remove / Extract / Rotate / Split preview */}
          {inspectData &&
            !inspectLoading &&
            ["remove-pages", "extract-pages", "rotate", "split"].includes(tool.id) && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      Prévia das Páginas ({inspectData.page_count})
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {tool.id === "remove-pages"
                        ? "Clique nas páginas que deseja REMOVER do documento."
                        : tool.id === "extract-pages"
                        ? "Clique nas páginas que deseja EXTRAIR."
                        : tool.id === "rotate"
                        ? "Clique no botão de girar em páginas individuais ou aplique rotação global ao lado."
                        : "Visualize a numeração exata das páginas para definir os intervalos."}
                    </p>
                  </div>
                  {(tool.id === "remove-pages" || tool.id === "extract-pages") && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPages(inspectData.pages.map((p) => p.number))}
                        className="rounded-lg bg-[var(--teal-50)] px-2.5 py-1 text-xs font-semibold text-[var(--teal-700)]"
                      >
                        Selecionar todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPages([])}
                        className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]"
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[540px] overflow-y-auto pr-1">
                  {inspectData.pages.map((p) => {
                    const isSelected = selectedPages.includes(p.number);
                    const rot = perPageRotations[p.index] || 0;
                    const selectable = tool.id === "remove-pages" || tool.id === "extract-pages";

                    return (
                      <div
                        key={p.index}
                        onClick={() => selectable && togglePageSelection(p.number)}
                        className={`relative rounded-xl border-2 p-2 transition-all bg-[var(--bg-canvas)] ${
                          selectable ? "cursor-pointer" : ""
                        } ${
                          isSelected
                            ? tool.id === "remove-pages"
                              ? "border-[var(--crimson-600)] bg-[var(--crimson-50)]"
                              : "border-[var(--teal-600)] bg-[var(--teal-50)]"
                            : "border-[var(--border-subtle)] hover:border-[var(--teal-200)]"
                        }`}
                      >
                        <div className="aspect-[3/4] overflow-hidden rounded-lg bg-white flex items-center justify-center border border-[var(--border-subtle)]">
                          {p.thumbnail ? (
                            <img
                              src={p.thumbnail}
                              alt={`Página ${p.number}`}
                              style={{ transform: `rotate(${rot}deg)` }}
                              className="max-h-full max-w-full object-contain transition-transform"
                            />
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">Pág. {p.number}</span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            Pág. {p.number}
                          </span>
                          {tool.id === "rotate" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPerPageRotations((prev) => ({
                                  ...prev,
                                  [p.index]: ((prev[p.index] || 0) + 90) % 360,
                                }));
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--teal-700)] ring-1 ring-[var(--teal-200)] hover:bg-[var(--teal-50)]"
                            >
                              <RotateCw className="h-3 w-3" /> {rot}°
                            </button>
                          )}
                          {isSelected && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                                tool.id === "remove-pages" ? "bg-[var(--crimson-600)]" : "bg-[var(--teal-600)]"
                              }`}
                            >
                              {tool.id === "remove-pages" ? "Excluir" : "Extrair"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* VISUAL ORGANIZE GRID (Reorder, Rotate, Duplicate, Delete) */}
          {tool.id === "organize" && organizeTiles.length > 0 && !inspectLoading && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-4 space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Organizar Páginas ({organizeTiles.length} páginas no documento final)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[560px] overflow-y-auto pr-1">
                {organizeTiles.map((tile, idx) => (
                  <div
                    key={tile.uid}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2 flex flex-col"
                  >
                    <div className="aspect-[3/4] overflow-hidden rounded-lg bg-white flex items-center justify-center border border-[var(--border-subtle)]">
                      {tile.thumbnail ? (
                        <img
                          src={tile.thumbnail}
                          alt={`Pág ${tile.pageNumber}`}
                          style={{ transform: `rotate(${tile.rotation}deg)` }}
                          className="max-h-full max-w-full object-contain transition-transform"
                        />
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">Pág {tile.pageNumber}</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-[var(--text-primary)]">
                      <span>#{idx + 1}</span>
                      <span className="truncate max-w-[90px] text-[var(--text-muted)] font-normal">
                        {tile.fileName}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-[var(--border-subtle)] pt-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const arr = [...organizeTiles];
                          [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                          setOrganizeTiles(arr);
                        }}
                        className="rounded p-1 hover:bg-white disabled:opacity-30"
                        title="Mover antes"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOrganizeTiles((prev) =>
                            prev.map((t, i) => (i === idx ? { ...t, rotation: (t.rotation + 90) % 360 } : t))
                          )
                        }
                        className="rounded p-1 hover:bg-white text-[var(--teal-700)]"
                        title="Girar 90°"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const copy = { ...tile, uid: `${tile.uid}-cp-${Date.now()}` };
                          const arr = [...organizeTiles];
                          arr.splice(idx + 1, 0, copy);
                          setOrganizeTiles(arr);
                        }}
                        className="rounded p-1 hover:bg-white text-[var(--text-secondary)]"
                        title="Duplicar página"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrganizeTiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded p-1 hover:bg-[var(--crimson-50)] text-[var(--crimson-600)]"
                        title="Remover página"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === organizeTiles.length - 1}
                        onClick={() => {
                          const arr = [...organizeTiles];
                          [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                          setOrganizeTiles(arr);
                        }}
                        className="rounded p-1 hover:bg-white disabled:opacity-30"
                        title="Mover depois"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INTERACTIVE VISUAL CANVAS: Crop / Edit / Sign / Redact */}
          {inspectData &&
            files[0] &&
            !inspectLoading &&
            ["crop", "edit", "sign", "redact"].includes(tool.id) && (
              <PageCanvasEditor
                file={files[0]}
                pageCount={inspectData.page_count}
                mode={tool.id as "crop" | "edit" | "sign" | "redact"}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                cropRect={cropRect}
                onCropChange={setCropRect}
                redactBoxes={redactBoxes}
                redactColor={redactColor}
                onRedactBoxesChange={setRedactBoxes}
                activeSignatureUrl={sigDataUrl}
                activeSignatureCaption={sigCaption}
                signatures={signatures}
                onSignaturesChange={setSignatures}
                editTool={editTool}
                editColor={editColor}
                editText={editText}
                editFontSize={editFontSize}
                editImageUrl={editImageUrl}
                annotations={annotations}
                onAnnotationsChange={setAnnotations}
              />
            )}

          {/* COMPARE RESULT VIEWER */}
          {compareResult && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                    Resultado da Comparação
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {compareResult.identical
                      ? "Os dois documentos são idênticos."
                      : `${compareResult.changed_pages} de ${compareResult.total_compared} página(s) possuem diferenças destacadas em carmesim.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadCompareReport}
                  className="btn-teal inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  <Download className="h-4 w-4" /> Baixar Relatório PDF
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {compareResult.pages.map((pg, idx) => (
                  <button
                    key={pg.page_number}
                    type="button"
                    onClick={() => setComparePageIdx(idx)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors shrink-0 ${
                      comparePageIdx === idx
                        ? "border-[var(--teal-600)] bg-[var(--teal-50)] text-[var(--teal-800)]"
                        : "border-[var(--border-subtle)] bg-white text-[var(--text-secondary)]"
                    }`}
                  >
                    Pág. {pg.page_number}{" "}
                    {pg.has_changes && (
                      <span className="ml-1 inline-block h-2 w-2 rounded-full bg-[var(--crimson-600)]" />
                    )}
                  </button>
                ))}
              </div>

              {compareResult.pages[comparePageIdx] && (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      { label: "Original (A)", src: compareResult.pages[comparePageIdx].img_left },
                      { label: "Revisado (B)", src: compareResult.pages[comparePageIdx].img_right },
                      {
                        label: `Diferenças (${compareResult.pages[comparePageIdx].visual_diff_percent}%)`,
                        src: compareResult.pages[comparePageIdx].img_diff,
                      },
                    ].map((col) => (
                      <div key={col.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2">
                        <div className="mb-1.5 text-xs font-bold text-[var(--text-secondary)]">{col.label}</div>
                        {col.src ? (
                          <img src={col.src} alt={col.label} className="w-full rounded border border-[var(--border-subtle)]" />
                        ) : (
                          <div className="flex h-48 items-center justify-center text-xs text-[var(--text-muted)]">
                            Página ausente
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {compareResult.pages[comparePageIdx].text_diff.length > 0 && (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-slate-900 p-3 text-xs font-mono text-slate-200 max-h-56 overflow-auto">
                      {compareResult.pages[comparePageIdx].text_diff.map((ln, i) => (
                        <div
                          key={i}
                          className={
                            ln.startsWith("+")
                              ? "text-emerald-300"
                              : ln.startsWith("-")
                              ? "text-rose-300"
                              : "text-slate-400"
                          }
                        >
                          {ln}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Controls Panel + Primary Crimson CTA */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-xs space-y-5">
            <h2 className="font-display text-base font-bold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-3">
              Opções da Ferramenta
            </h2>

            {/* SPLIT OPTIONS */}
            {tool.id === "split" && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "ranges" as const, label: "Intervalos" },
                    { id: "fixed" as const, label: "Fixo" },
                    { id: "all" as const, label: "Cada pág." },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSplitMode(m.id)}
                      className={`rounded-lg py-2 text-xs font-semibold border ${
                        splitMode === m.id
                          ? "border-[var(--teal-600)] bg-[var(--teal-50)] text-[var(--teal-800)]"
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {splitMode === "ranges" && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Intervalos de páginas (ex: 1-3, 4-6, 8)
                    </label>
                    <input
                      type="text"
                      value={splitRanges}
                      onChange={(e) => setSplitRanges(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm focus:border-[var(--teal-500)] focus:outline-none"
                    />
                  </div>
                )}
                {splitMode === "fixed" && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Dividir a cada quantas páginas?
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={splitFixedStep}
                      onChange={(e) => setSplitFixedStep(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={splitMerge}
                    onChange={(e) => setSplitMerge(e.target.checked)}
                    className="accent-[var(--teal-600)]"
                  />
                  Mesclar intervalos selecionados em um único PDF
                </label>
              </div>
            )}

            {/* REMOVE / EXTRACT INFO */}
            {(tool.id === "remove-pages" || tool.id === "extract-pages") && (
              <div className="space-y-3 text-xs text-[var(--text-secondary)]">
                <div className="rounded-xl bg-[var(--bg-surface-muted)] p-3">
                  <strong>Páginas selecionadas:</strong>{" "}
                  {selectedPages.length > 0 ? selectedPages.join(", ") : "Nenhuma ainda"}
                </div>
                {tool.id === "extract-pages" && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={extractSeparate}
                      onChange={(e) => setExtractSeparate(e.target.checked)}
                      className="accent-[var(--teal-600)]"
                    />
                    Gerar um PDF separado para cada página (ZIP)
                  </label>
                )}
              </div>
            )}

            {/* SCAN TO PDF OPTIONS */}
            {tool.id === "scan-to-pdf" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Filtro de nitidez do documento
                  </label>
                  <select
                    value={scanFilter}
                    onChange={(e) => setScanFilter(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="document">Documento Nítido (Recomendado)</option>
                    <option value="bw">Preto e Branco Alto Contraste</option>
                    <option value="grayscale">Escala de Cinza</option>
                    <option value="original">Foto Original</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Tamanho da página
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="A4">A4 (Padrão Brasil)</option>
                    <option value="LETTER">Carta (Letter)</option>
                  </select>
                </div>
              </div>
            )}

            {/* COMPRESS OPTIONS */}
            {tool.id === "compress" && (
              <div className="space-y-2">
                {[
                  {
                    id: "extreme" as const,
                    title: "Compressão Extrema",
                    desc: "Menor tamanho possível, ideal para envio rápido",
                  },
                  {
                    id: "recommended" as const,
                    title: "Compressão Recomendada",
                    desc: "Equilíbrio ideal entre qualidade de leitura e peso",
                  },
                  {
                    id: "low" as const,
                    title: "Baixa Compressão (Sem perdas)",
                    desc: "Preserva máxima resolução para exames e imagens",
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCompressLevel(opt.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${
                      compressLevel === opt.id
                        ? "border-[var(--teal-600)] bg-[var(--teal-50)]"
                        : "border-[var(--border-subtle)] hover:bg-[var(--bg-canvas)]"
                    }`}
                  >
                    <div className="text-xs font-bold text-[var(--text-primary)]">{opt.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* OCR OPTIONS */}
            {tool.id === "ocr" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Idioma do reconhecimento
                  </label>
                  <select
                    value={ocrLang}
                    onChange={(e) => setOcrLang(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="por+eng">Português + Inglês (Recomendado)</option>
                    <option value="por">Português (Brasil)</option>
                    <option value="eng">Inglês</option>
                  </select>
                </div>
                <p className="rounded-xl bg-[var(--teal-50)] p-3 text-xs text-[var(--teal-800)]">
                  O texto reconhecido é incorporado de forma invisível sobre o PDF original, tornando
                  prontuários digitalizados pesquisáveis com Ctrl+F.
                </p>
              </div>
            )}

            {/* JPG TO PDF OPTIONS */}
            {tool.id === "jpg-to-pdf" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Tamanho da página
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="LETTER">Carta (Letter)</option>
                    <option value="fit">Mesmo tamanho da imagem</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Orientação
                  </label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="portrait">Retrato (Vertical)</option>
                    <option value="landscape">Paisagem (Horizontal)</option>
                    <option value="auto">Automática por imagem</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Margens
                  </label>
                  <select
                    value={imgMargin}
                    onChange={(e) => setImgMargin(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="none">Sem margem</option>
                    <option value="small">Margem pequena</option>
                    <option value="large">Margem grande</option>
                  </select>
                </div>
              </div>
            )}

            {/* EXCEL / HTML TO PDF OPTIONS */}
            {(tool.id === "excel-to-pdf" || tool.id === "html-to-pdf") && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Orientação da página
                  </label>
                  <select
                    value={tool.id === "excel-to-pdf" ? excelOrient : orientation}
                    onChange={(e) =>
                      tool.id === "excel-to-pdf"
                        ? setExcelOrient(e.target.value)
                        : setOrientation(e.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="landscape">Paisagem (Ideal para tabelas)</option>
                    <option value="portrait">Retrato (Vertical)</option>
                  </select>
                </div>
              </div>
            )}

            {/* PDF TO JPG OPTIONS */}
            {tool.id === "pdf-to-jpg" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Modo de extração
                  </label>
                  <select
                    value={pdfToJpgMode}
                    onChange={(e) => setPdfToJpgMode(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="pages">Converter cada página em imagem</option>
                    <option value="extract_images">Extrair imagens incorporadas</option>
                  </select>
                </div>
                {pdfToJpgMode === "pages" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Resolução (DPI)
                      </label>
                      <select
                        value={pdfToJpgDpi}
                        onChange={(e) => setPdfToJpgDpi(Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--border-subtle)] px-2.5 py-2 text-sm"
                      >
                        <option value={100}>100 DPI (Leve)</option>
                        <option value={150}>150 DPI (Padrão)</option>
                        <option value={200}>200 DPI (Alta)</option>
                        <option value={300}>300 DPI (Máxima)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Formato
                      </label>
                      <select
                        value={pdfToJpgFmt}
                        onChange={(e) => setPdfToJpgFmt(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border-subtle)] px-2.5 py-2 text-sm"
                      >
                        <option value="jpg">JPG</option>
                        <option value="png">PNG</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PDF TO PPTX */}
            {tool.id === "pdf-to-powerpoint" && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Modo dos slides
                </label>
                <select
                  value={pptMode}
                  onChange={(e) => setPptMode(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                >
                  <option value="slides_image">Slides visuais alta fidelidade</option>
                  <option value="text">Slides de texto editável</option>
                </select>
              </div>
            )}

            {/* PDF TO EXCEL */}
            {tool.id === "pdf-to-excel" && (
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={excelSingleSheet}
                  onChange={(e) => setExcelSingleSheet(e.target.checked)}
                  className="accent-[var(--teal-600)]"
                />
                Consolidar todas as páginas em uma única aba do Excel
              </label>
            )}

            {/* PDF TO PDF/A */}
            {tool.id === "pdf-to-pdfa" && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Nível de conformidade ISO PDF/A
                </label>
                <select
                  value={pdfaConformance}
                  onChange={(e) => setPdfaConformance(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                >
                  <option value="2B">PDF/A-2b (Recomendado — Prontuários)</option>
                  <option value="1B">PDF/A-1b (Compatibilidade clássica)</option>
                  <option value="3B">PDF/A-3b (Permite anexos)</option>
                </select>
              </div>
            )}

            {/* ROTATE OPTIONS */}
            {tool.id === "rotate" && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Rotação global (todas as páginas)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => {
                        setRotateAngle(deg);
                        setPerPageRotations({});
                      }}
                      className={`rounded-xl border py-2 text-xs font-bold ${
                        rotateAngle === deg && Object.keys(perPageRotations).length === 0
                          ? "border-[var(--teal-600)] bg-[var(--teal-50)] text-[var(--teal-800)]"
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Ou gire páginas individuais clicando diretamente nas miniaturas ao lado.
                </p>
              </div>
            )}

            {/* PAGE NUMBERS OPTIONS */}
            {tool.id === "page-numbers" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Posição na página
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 w-36">
                    {POSITIONS_3X3.map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setNumPosition(pos)}
                        className={`h-8 rounded-lg border text-[10px] font-bold ${
                          numPosition === pos
                            ? "border-[var(--teal-600)] bg-[var(--teal-600)] text-white"
                            : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-muted)]"
                        }`}
                      >
                        •
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Formato do texto
                  </label>
                  <select
                    value={numTemplate}
                    onChange={(e) => setNumTemplate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="Página {n} de {total}">Página 1 de 10</option>
                    <option value="{n} / {total}">1 / 10</option>
                    <option value="{n}">Somente número (1)</option>
                    <option value="Prontuário — Fl. {n}/{total}">Prontuário — Fl. 1/10</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Início
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={numStart}
                      onChange={(e) => setNumStart(Number(e.target.value) || 1)}
                      className="w-full rounded-lg border border-[var(--border-subtle)] px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Fonte
                    </label>
                    <input
                      type="number"
                      min={7}
                      max={32}
                      value={numFontSize}
                      onChange={(e) => setNumFontSize(Number(e.target.value) || 11)}
                      className="w-full rounded-lg border border-[var(--border-subtle)] px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Cor
                    </label>
                    <input
                      type="color"
                      value={numColor}
                      onChange={(e) => setNumColor(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[var(--border-subtle)] p-0.5"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* WATERMARK OPTIONS */}
            {tool.id === "watermark" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "text" as const, label: "Texto" },
                    { id: "image" as const, label: "Logo / Imagem" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setWmType(m.id)}
                      className={`rounded-lg py-1.5 text-xs font-semibold border ${
                        wmType === m.id
                          ? "border-[var(--teal-600)] bg-[var(--teal-50)] text-[var(--teal-800)]"
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {wmType === "text" ? (
                  <>
                    <input
                      type="text"
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      placeholder="Texto da marca d'água"
                      className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-1">
                      {["CONFIDENCIAL", "CÓPIA CONTROLADA", "USO INTERNO", "RASCUNHO"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setWmText(preset)}
                          className="rounded-md bg-[var(--bg-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--teal-50)] hover:text-[var(--teal-700)]"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setWmImageFile(e.target.files?.[0] || null)}
                    className="w-full text-xs"
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                      Opacidade ({Math.round(wmOpacity * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0.08}
                      max={0.9}
                      step={0.02}
                      value={wmOpacity}
                      onChange={(e) => setWmOpacity(Number(e.target.value))}
                      className="w-full accent-[var(--teal-600)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                      Rotação ({wmRotation}°)
                    </label>
                    <input
                      type="range"
                      min={-90}
                      max={90}
                      step={5}
                      value={wmRotation}
                      onChange={(e) => setWmRotation(Number(e.target.value))}
                      className="w-full accent-[var(--teal-600)]"
                    />
                  </div>
                </div>

                {wmType === "text" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Tamanho fonte
                      </label>
                      <input
                        type="number"
                        min={12}
                        max={96}
                        value={wmFontSize}
                        onChange={(e) => setWmFontSize(Number(e.target.value) || 34)}
                        className="w-full rounded-lg border border-[var(--border-subtle)] px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Cor
                      </label>
                      <input
                        type="color"
                        value={wmColor}
                        onChange={(e) => setWmColor(e.target.value)}
                        className="h-9 w-full rounded-lg border border-[var(--border-subtle)] p-0.5"
                      />
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={wmMosaic}
                    onChange={(e) => setWmMosaic(e.target.checked)}
                    className="accent-[var(--teal-600)]"
                  />
                  Repetir em mosaico pela página inteira
                </label>

                {!wmMosaic && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Posição
                    </label>
                    <div className="grid grid-cols-3 gap-1 w-32">
                      {POSITIONS_3X3.map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setWmPosition(pos)}
                          className={`h-7 rounded border text-[10px] ${
                            wmPosition === pos
                              ? "border-[var(--teal-600)] bg-[var(--teal-600)] text-white"
                              : "border-[var(--border-subtle)] bg-[var(--bg-canvas)]"
                          }`}
                        >
                          •
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CROP OPTIONS */}
            {tool.id === "crop" && (
              <div className="space-y-3 text-xs">
                <div className="rounded-xl bg-[var(--bg-surface-muted)] p-3 space-y-1 text-[var(--text-secondary)]">
                  <div>Largura selecionada: {Math.round(cropRect.width * 100)}%</div>
                  <div>Altura selecionada: {Math.round(cropRect.height * 100)}%</div>
                </div>
                <select
                  value={cropApplyTo}
                  onChange={(e) => setCropApplyTo(e.target.value as "all" | "single")}
                  className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                >
                  <option value="all">Aplicar recorte em todas as páginas</option>
                  <option value="single">Aplicar somente na página atual ({currentPage + 1})</option>
                </select>
              </div>
            )}

            {/* EDIT PDF OPTIONS */}
            {tool.id === "edit" && (
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { id: "text" as const, icon: Type, label: "Texto" },
                    { id: "highlight" as const, icon: Highlighter, label: "Destaque" },
                    { id: "rect" as const, icon: Square, label: "Caixa" },
                    { id: "draw" as const, icon: Pen, label: "Livre" },
                    { id: "image" as const, icon: ImageIcon, label: "Img" },
                  ].map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setEditTool(it.id)}
                      className={`flex flex-col items-center justify-center rounded-lg border py-2 text-[10px] font-semibold ${
                        editTool === it.id
                          ? "border-[var(--teal-600)] bg-[var(--teal-50)] text-[var(--teal-800)]"
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <it.icon className="h-3.5 w-3.5 mb-0.5" />
                      {it.label}
                    </button>
                  ))}
                </div>

                {editTool === "text" && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="Texto a inserir ao clicar"
                      className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">Tamanho da fonte</span>
                      <input
                        type="number"
                        min={8}
                        max={48}
                        value={editFontSize}
                        onChange={(e) => setEditFontSize(Number(e.target.value) || 14)}
                        className="w-20 rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                )}

                {editTool === "image" && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => typeof r.result === "string" && setEditImageUrl(r.result);
                      r.readAsDataURL(f);
                    }}
                    className="w-full text-xs"
                  />
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">Cor</span>
                  <div className="flex items-center gap-1.5">
                    {["#C81E3A", "#0D9488", "#1E293B", "#FACC15", "#2563EB"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`h-5 w-5 rounded-full ring-2 ${
                          editColor === c ? "ring-slate-900 scale-110" : "ring-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {annotations.length} anotação(ões) pronta(s). Clique em qualquer marcação na página para excluí-la.
                </p>
              </div>
            )}

            {/* UNLOCK / PROTECT OPTIONS */}
            {tool.id === "unlock" && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Senha atual do PDF (se exigida para abrir)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Deixe em branco se só tiver bloqueio de cópia"
                  className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                />
              </div>
            )}

            {tool.id === "protect" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Definir senha de abertura (AES-256)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite a senha"
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Confirmar senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={allowPrint}
                    onChange={(e) => setAllowPrint(e.target.checked)}
                    className="accent-[var(--teal-600)]"
                  />
                  Permitir impressão do documento
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={allowCopy}
                    onChange={(e) => setAllowCopy(e.target.checked)}
                    className="accent-[var(--teal-600)]"
                  />
                  Permitir cópia de texto
                </label>
              </div>
            )}

            {/* SIGN PDF OPTIONS */}
            {tool.id === "sign" && (
              <div className="space-y-3">
                <SignaturePad onSignatureReady={setSigDataUrl} currentDataUrl={sigDataUrl} />
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Legenda / Carimbo abaixo da assinatura (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={sigCaption}
                    onChange={(e) => setSigCaption(e.target.value)}
                    placeholder="Ex: Dr. João Silva — CRM/SP 123456"
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs"
                  />
                </div>
                <div className="rounded-xl bg-[var(--teal-50)] px-3 py-2 text-xs text-[var(--teal-800)]">
                  Assinaturas posicionadas: <strong>{signatures.length}</strong>. Clique sobre a página ao lado para carimbar.
                </div>
              </div>
            )}

            {/* REDACT / LGPD OPTIONS */}
            {tool.id === "redact" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-[var(--crimson-200)] bg-[var(--crimson-50)] p-3 text-xs text-[var(--crimson-700)] flex gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Tarja Definitiva LGPD:</strong> o texto sob as áreas ocultadas é removido
                    fisicamente e não pode ser copiado ou recuperado.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Detecção automática de dados sensíveis
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "cpf", label: "CPF" },
                      { id: "cnpj", label: "CNPJ" },
                      { id: "phone", label: "Telefones" },
                      { id: "email", label: "E-mails" },
                      { id: "date", label: "Datas (DD/MM/AAAA)" },
                    ].map((pat) => (
                      <label
                        key={pat.id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={redactPatterns.includes(pat.id)}
                          onChange={() => toggleRedactPattern(pat.id)}
                          className="accent-[var(--crimson-600)]"
                        />
                        {pat.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Ocultar palavras/nomes específicos (separados por vírgula)
                  </label>
                  <textarea
                    rows={2}
                    value={redactTerms}
                    onChange={(e) => setRedactTerms(e.target.value)}
                    placeholder="Ex: Maria da Silva, Prontuário 44921, Convênio X"
                    className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Tarjas manuais desenhadas: <strong>{redactBoxes.length}</strong></span>
                  <div className="flex items-center gap-1.5">
                    <span>Cor:</span>
                    <input
                      type="color"
                      value={redactColor}
                      onChange={(e) => setRedactColor(e.target.value)}
                      className="h-6 w-8 rounded border border-[var(--border-subtle)]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SIMPLE INFO FOR TOOLS WITHOUT EXTRA CONFIG */}
            {["merge", "repair", "word-to-pdf", "powerpoint-to-pdf", "pdf-to-word", "organize", "compare"].includes(
              tool.id
            ) && (
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                {tool.id === "merge"
                  ? "Use as setas na lista de arquivos para definir a ordem exata antes de unificar."
                  : tool.id === "organize"
                  ? "Use os controles em cada miniatura para mover, girar, duplicar ou excluir páginas."
                  : tool.id === "compare"
                  ? "Envie as duas versões do documento para gerar o mapa visual de alterações e o diff textual."
                  : "Tudo pronto! Clique no botão abaixo para processar localmente com total privacidade."}
              </p>
            )}

            {/* ERROR ALERT */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-[var(--crimson-200)] bg-[var(--crimson-50)] p-3 text-xs text-[var(--crimson-700)]">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* PROGRESS BAR */}
            {processing && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-[var(--teal-700)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {progressMsg || "Processando..."}
                  </span>
                  {progressPct > 0 && <span>{progressPct}%</span>}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--teal-100)]">
                  <div
                    className="h-full rounded-full bg-[var(--teal-600)] transition-all duration-300"
                    style={{ width: `${Math.max(15, progressPct)}%` }}
                  />
                </div>
              </div>
            )}

            {/* PRIMARY CRIMSON CTA BUTTON */}
            <button
              type="button"
              disabled={!canProcess || processing}
              onClick={handleProcess}
              className="btn-primary-cta w-full rounded-xl py-3.5 px-5 text-sm font-bold flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  {tool.id === "compare" ? <Eye className="h-4 w-4" /> : null}
                  {tool.ctaLabel}
                </>
              )}
            </button>
          </div>

          {/* RESULT / DOWNLOAD CARD */}
          {result && (
            <div className="rounded-2xl border border-[var(--teal-200)] bg-[var(--teal-50)] p-5 space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-[var(--teal-700)] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--teal-950)]">Arquivo pronto!</h3>
                  <p className="text-xs text-[var(--teal-800)] mt-0.5">
                    {result.message || "Processamento local concluído com sucesso."}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white/90 px-3 py-2.5 text-xs text-[var(--text-secondary)] space-y-1 border border-[var(--teal-200)]/70">
                <div className="font-semibold text-[var(--text-primary)] truncate">{result.filename}</div>
                <div className="flex items-center justify-between">
                  <span>Tamanho final: <strong>{formatBytes(result.outputSize)}</strong></span>
                  {savedPercent !== null && savedPercent > 0 && tool.id === "compress" && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                      -{savedPercent}%
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => triggerBlobDownload(result.blob, result.filename)}
                className="btn-teal w-full rounded-xl py-2.5 px-4 text-xs font-bold inline-flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" /> Baixar novamente
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
