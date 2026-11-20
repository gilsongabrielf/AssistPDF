export interface PdfPageInfo {
  index: number;
  number: number;
  width: number;
  height: number;
  rotation: number;
  thumbnail: string | null;
}

export interface PdfInspectResult {
  is_encrypted: boolean;
  needs_password: boolean;
  page_count: number;
  size_bytes: number;
  title: string;
  author: string;
  pages: PdfPageInfo[];
}

export interface Capabilities {
  pypdf: boolean;
  pypdfium2: boolean;
  reportlab: boolean;
  pillow: boolean;
  libreoffice: boolean;
  ghostscript: boolean;
  tesseract: boolean;
  lgpd_local_only: boolean;
}

export interface ToolDownloadResult {
  blob: Blob;
  filename: string;
  originalSize?: number;
  outputSize: number;
  message?: string;
}

export interface ComparePageResult {
  page_number: number;
  has_changes: boolean;
  visual_diff_percent: number;
  img_left: string | null;
  img_right: string | null;
  img_diff: string | null;
  text_diff: string[];
}

export interface CompareResult {
  pages_left: number;
  pages_right: number;
  total_compared: number;
  changed_pages: number;
  identical: boolean;
  pages: ComparePageResult[];
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function parseFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

async function extractError(res: Response): Promise<string> {
  if (res.status === 413) {
    return "Arquivo excede o limite de 4,5 MB do modo Serverless (Vercel). Para PDFs maiores, utilize o deploy Docker/Intranet.";
  }
  try {
    const data = await res.json();
    if (data?.detail) return String(data.detail);
  } catch {
    // ignore
  }
  return `Erro ao processar arquivo (HTTP ${res.status}).`;
}

export async function fetchCapabilities(): Promise<Capabilities | null> {
  try {
    const res = await fetch("/api/capabilities");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function inspectPdfFile(
  file: File,
  password?: string,
  includeThumbnails = true
): Promise<PdfInspectResult> {
  const fd = new FormData();
  fd.append("file", file);
  if (password) fd.append("password", password);
  fd.append("include_thumbnails", String(includeThumbnails));

  const res = await fetch("/api/inspect", { method: "POST", body: fd });
  if (!res.ok) throw new Error(await extractError(res));
  return await res.json();
}

export async function renderPdfPageUrl(
  file: File,
  pageIndex: number,
  scale = 1.6,
  password?: string
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("page_index", String(pageIndex));
  fd.append("scale", String(scale));
  if (password) fd.append("password", password);

  const res = await fetch("/api/render-page", { method: "POST", body: fd });
  if (!res.ok) throw new Error(await extractError(res));
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function runToolRequest(
  endpoint: string,
  formData: FormData,
  fallbackFilename = "resultado.pdf"
): Promise<ToolDownloadResult> {
  const res = await fetch(endpoint, { method: "POST", body: formData });
  if (!res.ok) throw new Error(await extractError(res));
  const blob = await res.blob();
  const filename = parseFilename(res.headers.get("Content-Disposition"), fallbackFilename);
  const orig = res.headers.get("X-Original-Size");
  const out = res.headers.get("X-Output-Size");
  const msg = res.headers.get("X-Tool-Message") || undefined;

  return {
    blob,
    filename,
    originalSize: orig ? Number(orig) : undefined,
    outputSize: out ? Number(out) : blob.size,
    message: msg,
  };
}

export async function runCompareRequest(left: File, right: File): Promise<CompareResult> {
  const fd = new FormData();
  fd.append("file_left", left);
  fd.append("file_right", right);
  const res = await fetch("/api/tools/compare", { method: "POST", body: fd });
  if (!res.ok) throw new Error(await extractError(res));
  return await res.json();
}

/**
 * Local browser OCR using Tesseract.js when native server Tesseract CLI is unavailable.
 * Renders each page via backend /api/render-page and extracts word bounding boxes locally.
 */
export async function runLocalBrowserOcr(
  file: File,
  pageCount: number,
  lang: string,
  onProgress: (msg: string, pct: number) => void
): Promise<
  Array<{
    page_index: number;
    image_width: number;
    image_height: number;
    words: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>;
  }>
> {
  onProgress("Carregando motor OCR local no navegador...", 5);
  const Tesseract = await import("tesseract.js");
  const tessLang = lang === "eng" ? "eng" : lang === "por" ? "por" : "por+eng";
  const worker = await Tesseract.createWorker(tessLang);
  const pagesOut: Array<{
    page_index: number;
    image_width: number;
    image_height: number;
    words: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>;
  }> = [];

  try {
    for (let i = 0; i < pageCount; i++) {
      onProgress(`Reconhecendo texto da página ${i + 1} de ${pageCount}...`, Math.round(((i + 0.2) / pageCount) * 85) + 10);
      const imgUrl = await renderPdfPageUrl(file, i, 2.0);
      try {
        // Measure natural dimensions
        const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
          im.onerror = reject;
          im.src = imgUrl;
        });

        const result = await worker.recognize(imgUrl, {}, { blocks: true });
        const words: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }> = [];
        const blocks = result.data.blocks || [];
        for (const blk of blocks) {
          for (const para of blk.paragraphs || []) {
            for (const line of para.lines || []) {
              for (const w of line.words || []) {
                if (w.text && w.text.trim() && w.bbox) {
                  words.push({
                    text: w.text.trim(),
                    x0: w.bbox.x0,
                    y0: w.bbox.y0,
                    x1: w.bbox.x1,
                    y1: w.bbox.y1,
                  });
                }
              }
            }
          }
        }
        pagesOut.push({
          page_index: i,
          image_width: dims.w,
          image_height: dims.h,
          words,
        });
      } finally {
        URL.revokeObjectURL(imgUrl);
      }
    }
  } finally {
    await worker.terminate();
  }

  onProgress("Incorporando camada de texto pesquisável no PDF...", 96);
  return pagesOut;
}
