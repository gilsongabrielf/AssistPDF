import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CircleDot } from "lucide-react";

interface Props {
  onCaptured: (file: File) => void;
}

export const CameraScanner: React.FC<Props> = ({ onCaptured }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setErr("Câmera indisponível ou permissão negada. Você pode enviar fotos diretamente abaixo.");
    }
  };

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(
      (blob) => {
        if (blob) {
          const f = new File([blob], `digitalizacao_${Date.now()}.jpg`, { type: "image/jpeg" });
          onCaptured(f);
        }
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-primary)]">Captura via Câmera / Webcam</h4>
          <p className="text-xs text-[var(--text-muted)]">
            Digitalize receitas, pedidos médicos ou documentos direto pelo navegador
          </p>
        </div>
        {!active ? (
          <button
            type="button"
            onClick={startCamera}
            className="btn-teal inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
          >
            <Camera className="h-4 w-4" /> Abrir câmera
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)]"
          >
            <CameraOff className="h-4 w-4" /> Fechar câmera
          </button>
        )}
      </div>

      {err && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{err}</p>}

      {active && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl bg-slate-900">
            <video ref={videoRef} playsInline muted className="w-full max-h-80 object-contain" />
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={snap}
              className="btn-primary-cta inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              <CircleDot className="h-4 w-4" /> Capturar página
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
