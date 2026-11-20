import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, Undo2 } from "lucide-react";
import { renderPdfPageUrl } from "../lib/api";

export interface NormRect {
  page_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditAnnotation {
  id: string;
  page_index: number;
  type: "text" | "rect" | "highlight" | "draw" | "image";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  bold?: boolean;
  color: string;
  opacity?: number;
  strokeWidth?: number;
  points?: Array<{ x: number; y: number }>;
  dataUrl?: string;
}

export interface PlacedSignature {
  id: string;
  page_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  caption?: string;
}

interface Props {
  file: File;
  pageCount: number;
  mode: "crop" | "redact" | "sign" | "edit";
  currentPage: number;
  onPageChange: (p: number) => void;
  // Crop state
  cropRect?: NormRect;
  onCropChange?: (r: NormRect) => void;
  // Redact state
  redactBoxes?: NormRect[];
  redactColor?: string;
  onRedactBoxesChange?: (boxes: NormRect[]) => void;
  // Sign state
  activeSignatureUrl?: string | null;
  activeSignatureCaption?: string;
  signatures?: PlacedSignature[];
  onSignaturesChange?: (sigs: PlacedSignature[]) => void;
  // Edit state
  editTool?: "text" | "highlight" | "rect" | "draw" | "image";
  editColor?: string;
  editText?: string;
  editFontSize?: number;
  editImageUrl?: string | null;
  annotations?: EditAnnotation[];
  onAnnotationsChange?: (anns: EditAnnotation[]) => void;
}

export const PageCanvasEditor: React.FC<Props> = ({
  file,
  pageCount,
  mode,
  currentPage,
  onPageChange,
  cropRect,
  onCropChange,
  redactBoxes = [],
  redactColor = "#000000",
  onRedactBoxesChange,
  activeSignatureUrl,
  activeSignatureCaption,
  signatures = [],
  onSignaturesChange,
  editTool = "text",
  editColor = "#C81E3A",
  editText = "Anotação hospitalar",
  editFontSize = 15,
  editImageUrl,
  annotations = [],
  onAnnotationsChange,
}) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCur, setDragCur] = useState<{ x: number; y: number } | null>(null);
  const [freePoints, setFreePoints] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    let alive = true;
    let urlToRevoke: string | null = null;
    setLoading(true);
    renderPdfPageUrl(file, currentPage, 1.55)
      .then((u) => {
        if (!alive) {
          URL.revokeObjectURL(u);
          return;
        }
        urlToRevoke = u;
        setImgUrl(u);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [file, currentPage]);

  const normCoords = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.noDraw === "true") return;
    const pt = normCoords(e);

    if (mode === "sign") {
      if (!activeSignatureUrl || !onSignaturesChange) return;
      const w = 0.28;
      const h = 0.095;
      const placed: PlacedSignature = {
        id: `sig_${Date.now()}`,
        page_index: currentPage,
        x: Math.max(0, Math.min(1 - w, pt.x - w / 2)),
        y: Math.max(0, Math.min(1 - h, pt.y - h / 2)),
        width: w,
        height: h,
        dataUrl: activeSignatureUrl,
        caption: activeSignatureCaption,
      };
      onSignaturesChange([...signatures, placed]);
      return;
    }

    if (mode === "edit" && editTool === "text" && onAnnotationsChange) {
      if (!editText.trim()) return;
      onAnnotationsChange([
        ...annotations,
        {
          id: `ann_${Date.now()}`,
          page_index: currentPage,
          type: "text",
          x: pt.x,
          y: pt.y,
          text: editText,
          fontSize: editFontSize,
          color: editColor,
          opacity: 1,
        },
      ]);
      return;
    }

    if (mode === "edit" && editTool === "image" && onAnnotationsChange) {
      if (!editImageUrl) return;
      onAnnotationsChange([
        ...annotations,
        {
          id: `ann_${Date.now()}`,
          page_index: currentPage,
          type: "image",
          x: Math.max(0, pt.x - 0.12),
          y: Math.max(0, pt.y - 0.08),
          width: 0.24,
          height: 0.16,
          color: editColor,
          dataUrl: editImageUrl,
        },
      ]);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    if (mode === "edit" && editTool === "draw") {
      setFreePoints([pt]);
    } else {
      setDragStart(pt);
      setDragCur(pt);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode === "edit" && editTool === "draw" && freePoints.length > 0) {
      setFreePoints((prev) => [...prev, normCoords(e)]);
      return;
    }
    if (!dragStart) return;
    setDragCur(normCoords(e));
  };

  const handlePointerUp = () => {
    if (mode === "edit" && editTool === "draw" && freePoints.length >= 2 && onAnnotationsChange) {
      onAnnotationsChange([
        ...annotations,
        {
          id: `ann_${Date.now()}`,
          page_index: currentPage,
          type: "draw",
          color: editColor,
          strokeWidth: 2.5,
          opacity: 1,
          points: freePoints,
        },
      ]);
      setFreePoints([]);
      return;
    }
    setFreePoints([]);

    if (!dragStart || !dragCur) {
      setDragStart(null);
      setDragCur(null);
      return;
    }
    const x = Math.min(dragStart.x, dragCur.x);
    const y = Math.min(dragStart.y, dragCur.y);
    const width = Math.abs(dragCur.x - dragStart.x);
    const height = Math.abs(dragCur.y - dragStart.y);

    if (width > 0.012 && height > 0.01) {
      if (mode === "crop" && onCropChange) {
        onCropChange({ page_index: currentPage, x, y, width, height });
      } else if (mode === "redact" && onRedactBoxesChange) {
        onRedactBoxesChange([...redactBoxes, { page_index: currentPage, x, y, width, height }]);
      } else if (mode === "edit" && (editTool === "rect" || editTool === "highlight") && onAnnotationsChange) {
        onAnnotationsChange([
          ...annotations,
          {
            id: `ann_${Date.now()}`,
            page_index: currentPage,
            type: editTool,
            x,
            y,
            width,
            height,
            color: editColor,
            opacity: editTool === "highlight" ? 0.35 : 1,
            strokeWidth: 2,
          },
        ]);
      }
    }
    setDragStart(null);
    setDragCur(null);
  };

  const draftRect =
    dragStart && dragCur
      ? {
          x: Math.min(dragStart.x, dragCur.x),
          y: Math.min(dragStart.y, dragCur.y),
          width: Math.abs(dragCur.x - dragStart.x),
          height: Math.abs(dragCur.y - dragStart.y),
        }
      : null;

  const pageRedacts = redactBoxes
    .map((b, idx) => ({ ...b, globalIdx: idx }))
    .filter((b) => b.page_index === currentPage);
  const pageSigs = signatures.filter((s) => s.page_index === currentPage);
  const pageAnns = annotations.filter((a) => a.page_index === currentPage);

  const hintText =
    mode === "crop"
      ? "Clique e arraste sobre a página para definir a área de recorte."
      : mode === "redact"
      ? "Clique e arraste sobre qualquer dado sensível (CPF, nome, exame) para aplicar tarja definitiva."
      : mode === "sign"
      ? "Clique no local da página onde deseja posicionar sua assinatura/carimbo."
      : editTool === "text"
      ? "Clique no local desejado da página para inserir o texto digitado ao lado."
      : editTool === "image"
      ? "Clique na página para posicionar a imagem/carimbo selecionado."
      : "Clique e arraste na página para desenhar a marcação.";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-white px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 0}
            onClick={() => onPageChange(currentPage - 1)}
            className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Página {currentPage + 1} de {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage >= pageCount - 1}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {mode === "redact" && pageRedacts.length > 0 && onRedactBoxesChange && (
            <button
              type="button"
              onClick={() => onRedactBoxesChange(redactBoxes.filter((b) => b.page_index !== currentPage))}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--crimson-50)] px-2.5 py-1 text-xs font-semibold text-[var(--crimson-600)]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Limpar tarjas da página
            </button>
          )}
          {mode === "edit" && pageAnns.length > 0 && onAnnotationsChange && (
            <button
              type="button"
              onClick={() => {
                const last = pageAnns[pageAnns.length - 1];
                onAnnotationsChange(annotations.filter((a) => a.id !== last.id));
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)]"
            >
              <Undo2 className="h-3.5 w-3.5" /> Desfazer última
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--teal-700)] bg-[var(--teal-50)] border border-[var(--teal-200)] rounded-xl px-3 py-2 font-medium">
        {hintText}
      </p>

      <div className="flex justify-center rounded-2xl border border-[var(--border-subtle)] bg-slate-200/70 p-4 overflow-auto">
        <div
          ref={stageRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative inline-block select-none touch-none shadow-lg bg-white cursor-crosshair max-w-full"
        >
          {loading || !imgUrl ? (
            <div className="flex h-[540px] w-[390px] items-center justify-center text-sm text-[var(--text-muted)]">
              Renderizando página...
            </div>
          ) : (
            <img
              src={imgUrl}
              alt={`Página ${currentPage + 1}`}
              draggable={false}
              className="block max-h-[640px] w-auto pointer-events-none"
            />
          )}

          {/* CROP OVERLAY */}
          {mode === "crop" && cropRect && (
            <div
              className="absolute border-2 border-[var(--crimson-600)] bg-[var(--teal-500)]/15 pointer-events-none"
              style={{
                left: `${cropRect.x * 100}%`,
                top: `${cropRect.y * 100}%`,
                width: `${cropRect.width * 100}%`,
                height: `${cropRect.height * 100}%`,
                boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.42)",
              }}
            />
          )}

          {/* REDACT BOXES */}
          {mode === "redact" &&
            pageRedacts.map((b) => (
              <div
                key={b.globalIdx}
                data-no-draw="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onRedactBoxesChange?.(redactBoxes.filter((_, i) => i !== b.globalIdx));
                }}
                title="Clique para remover esta tarja"
                className="absolute cursor-pointer group border border-white/40"
                style={{
                  left: `${b.x * 100}%`,
                  top: `${b.y * 100}%`,
                  width: `${b.width * 100}%`,
                  height: `${b.height * 100}%`,
                  backgroundColor: redactColor,
                }}
              >
                <span className="hidden group-hover:flex absolute -top-5 left-0 rounded bg-[var(--crimson-600)] px-1.5 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
                  Remover
                </span>
              </div>
            ))}

          {/* SIGNATURES */}
          {mode === "sign" &&
            pageSigs.map((s) => (
              <div
                key={s.id}
                data-no-draw="true"
                className="absolute border border-dashed border-[var(--teal-600)] bg-white/75 p-1 rounded group"
                style={{
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  width: `${s.width * 100}%`,
                }}
              >
                <img src={s.dataUrl} alt="Assinatura" className="w-full h-auto object-contain pointer-events-none" />
                {s.caption && (
                  <div className="border-t border-[var(--teal-600)] pt-0.5 text-[9px] leading-tight text-slate-700 whitespace-pre-line">
                    {s.caption}
                  </div>
                )}
                <button
                  type="button"
                  data-no-draw="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSignaturesChange?.(signatures.filter((item) => item.id !== s.id));
                  }}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--crimson-600)] text-white shadow text-[10px]"
                  title="Remover assinatura"
                >
                  ×
                </button>
              </div>
            ))}

          {/* EDIT ANNOTATIONS */}
          {mode === "edit" && (
            <>
              <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {pageAnns
                  .filter((a) => a.type === "draw" && a.points && a.points.length >= 2)
                  .map((a) => (
                    <polyline
                      key={a.id}
                      fill="none"
                      stroke={a.color}
                      strokeWidth="0.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={a.points!.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
                    />
                  ))}
                {freePoints.length >= 2 && (
                  <polyline
                    fill="none"
                    stroke={editColor}
                    strokeWidth="0.6"
                    strokeLinecap="round"
                    points={freePoints.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
                  />
                )}
              </svg>

              {pageAnns.map((a) => {
                if (a.type === "text") {
                  return (
                    <div
                      key={a.id}
                      data-no-draw="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnnotationsChange?.(annotations.filter((it) => it.id !== a.id));
                      }}
                      title="Clique para remover"
                      className="absolute cursor-pointer whitespace-pre-wrap font-medium hover:ring-1 hover:ring-[var(--crimson-500)] rounded px-0.5"
                      style={{
                        left: `${(a.x || 0) * 100}%`,
                        top: `${(a.y || 0) * 100}%`,
                        color: a.color,
                        fontSize: `${Math.max(10, (a.fontSize || 14) * 0.85)}px`,
                      }}
                    >
                      {a.text}
                    </div>
                  );
                }
                if (a.type === "rect" || a.type === "highlight") {
                  return (
                    <div
                      key={a.id}
                      data-no-draw="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnnotationsChange?.(annotations.filter((it) => it.id !== a.id));
                      }}
                      title="Clique para remover"
                      className="absolute cursor-pointer"
                      style={{
                        left: `${(a.x || 0) * 100}%`,
                        top: `${(a.y || 0) * 100}%`,
                        width: `${(a.width || 0) * 100}%`,
                        height: `${(a.height || 0) * 100}%`,
                        backgroundColor: a.type === "highlight" ? a.color : "transparent",
                        opacity: a.type === "highlight" ? 0.35 : 1,
                        border: a.type === "rect" ? `2px solid ${a.color}` : "none",
                      }}
                    />
                  );
                }
                if (a.type === "image" && a.dataUrl) {
                  return (
                    <img
                      key={a.id}
                      src={a.dataUrl}
                      alt="Imagem inserida"
                      data-no-draw="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnnotationsChange?.(annotations.filter((it) => it.id !== a.id));
                      }}
                      title="Clique para remover"
                      className="absolute cursor-pointer object-contain hover:ring-2 hover:ring-[var(--crimson-500)]"
                      style={{
                        left: `${(a.x || 0) * 100}%`,
                        top: `${(a.y || 0) * 100}%`,
                        width: `${(a.width || 0.24) * 100}%`,
                        height: `${(a.height || 0.16) * 100}%`,
                      }}
                    />
                  );
                }
                return null;
              })}
            </>
          )}

          {/* LIVE DRAG PREVIEW */}
          {draftRect && (
            <div
              className="absolute border-2 border-dashed border-[var(--crimson-600)] bg-[var(--crimson-500)]/20 pointer-events-none"
              style={{
                left: `${draftRect.x * 100}%`,
                top: `${draftRect.y * 100}%`,
                width: `${draftRect.width * 100}%`,
                height: `${draftRect.height * 100}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
