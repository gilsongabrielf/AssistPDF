import React, { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { formatBytes } from "../lib/api";

interface Props {
  files: File[];
  accept: string;
  multiple?: boolean;
  label?: string;
  sublabel?: string;
  onChange: (files: File[]) => void;
}

export const DropZone: React.FC<Props> = ({
  files,
  accept,
  multiple = false,
  label = "Selecionar arquivo",
  sublabel = "ou arraste e solte aqui",
  onChange,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleAdded = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    if (multiple) {
      onChange([...files, ...incoming]);
    } else {
      onChange([incoming[0]]);
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...files];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const removeAt = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const sortAlpha = () => {
    const next = [...files].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleAdded(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          dragging
            ? "border-[var(--crimson-500)] bg-[var(--crimson-50)]"
            : "border-[var(--teal-200)] bg-white hover:border-[var(--teal-500)] hover:bg-[var(--teal-50)]/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            handleAdded(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--teal-50)] text-[var(--teal-600)] ring-1 ring-[var(--teal-200)]">
          <UploadCloud className="h-7 w-7" />
        </div>
        <button
          type="button"
          className="btn-primary-cta inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          {label}
        </button>
        <p className="mt-2.5 text-sm text-[var(--text-secondary)]">{sublabel}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Processado localmente na máquina • Privacidade garantida (LGPD)
        </p>
      </div>

      {files.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {files.length} arquivo{files.length > 1 ? "s" : ""} selecionado{files.length > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              {multiple && files.length > 1 && (
                <button
                  type="button"
                  onClick={sortAlpha}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)]"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar A–Z
                </button>
              )}
              {multiple && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--teal-50)] px-2.5 py-1 text-xs font-semibold text-[var(--teal-700)] hover:bg-[var(--teal-100)]"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar mais
                </button>
              )}
            </div>
          </div>

          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {files.map((file, idx) => {
              const isImg = file.type.startsWith("image/");
              return (
                <li
                  key={`${file.name}-${idx}-${file.size}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--teal-50)] text-[var(--teal-700)]">
                      {isImg ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {file.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{formatBytes(file.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {multiple && files.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)] disabled:opacity-30"
                          title="Mover para cima"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(idx, 1)}
                          disabled={idx === files.length - 1}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)] disabled:opacity-30"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAt(idx)}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--crimson-50)] hover:text-[var(--crimson-600)]"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
