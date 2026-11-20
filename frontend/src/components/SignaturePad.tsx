import React, { useEffect, useRef, useState } from "react";
import { Eraser, Pen, Type, Upload } from "lucide-react";

interface Props {
  onSignatureReady: (dataUrl: string) => void;
  currentDataUrl: string | null;
}

export const SignaturePad: React.FC<Props> = ({ onSignatureReady, currentDataUrl }) => {
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [typedName, setTypedName] = useState("Dr(a). Nome Sobrenome");
  const [inkColor, setInkColor] = useState("#0F172A");

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  };

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = c.getContext("2d")!;
    const p = getPos(e);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const onUp = () => {
    if (!drawingRef.current || !canvasRef.current) return;
    drawingRef.current = false;
    onSignatureReady(canvasRef.current.toDataURL("image/png"));
  };

  // Render typed signature to PNG
  useEffect(() => {
    if (tab !== "type") return;
    const c = document.createElement("canvas");
    c.width = 520;
    c.height = 150;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = inkColor;
    ctx.font = "italic 52px 'Brush Script MT', 'Segoe Script', Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName || "Assinatura", c.width / 2, c.height / 2);
    onSignatureReady(c.toDataURL("image/png"));
  }, [tab, typedName, inkColor]);

  const handleUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onSignatureReady(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
      <div className="flex items-center gap-1 rounded-lg bg-white p-1 border border-[var(--border-subtle)]">
        {[
          { id: "draw" as const, label: "Desenhar", icon: Pen },
          { id: "type" as const, label: "Digitar", icon: Type },
          { id: "upload" as const, label: "Imagem", icon: Upload },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "bg-[var(--teal-600)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)]"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "draw" && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-[var(--border-strong)] bg-white">
            <canvas
              ref={canvasRef}
              width={480}
              height={150}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              className="w-full h-32 touch-none cursor-crosshair block"
            />
            <button
              type="button"
              onClick={clearCanvas}
              className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)] hover:text-[var(--crimson-600)] inline-flex items-center gap-1"
            >
              <Eraser className="h-3 w-3" /> Limpar
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Desenhe acima com mouse ou toque</span>
            <div className="flex items-center gap-1.5">
              {["#0F172A", "#0F766E", "#1D4ED8"].map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setInkColor(col)}
                  className={`h-4 w-4 rounded-full ring-2 ${
                    inkColor === col ? "ring-[var(--crimson-500)] scale-110" : "ring-transparent"
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "type" && (
        <div className="space-y-2">
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Digite seu nome"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm focus:border-[var(--teal-500)] focus:outline-none"
          />
          {currentDataUrl && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-2 flex justify-center">
              <img src={currentDataUrl} alt="Prévia da assinatura" className="h-16 object-contain" />
            </div>
          )}
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-2">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--teal-200)] bg-white p-4 text-center hover:bg-[var(--teal-50)]/40">
            <Upload className="h-5 w-5 text-[var(--teal-600)] mb-1" />
            <span className="text-xs font-medium text-[var(--text-primary)]">
              Enviar PNG/JPG da assinatura ou carimbo
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
          </label>
          {currentDataUrl && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-2 flex justify-center">
              <img src={currentDataUrl} alt="Carimbo carregado" className="h-16 object-contain" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
