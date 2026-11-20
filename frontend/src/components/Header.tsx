import React from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { HOSPITAL_BRAND } from "../config/branding";
import type { ToolId } from "../data/tools";
import { HospitalLogo } from "./HospitalLogo";

interface Props {
  activeToolId: ToolId | null;
  onGoHome: () => void;
  onSelectTool: (id: ToolId) => void;
}

const QUICK_NAV: { label: string; id: ToolId }[] = [
  { label: "Juntar PDF", id: "merge" },
  { label: "Dividir PDF", id: "split" },
  { label: "Comprimir", id: "compress" },
  { label: "Tarjar LGPD", id: "redact" },
  { label: "Assinar PDF", id: "sign" },
];

export const Header: React.FC<Props> = ({ activeToolId, onGoHome, onSelectTool }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-3 text-left focus:outline-none group"
          >
            <HospitalLogo size={40} />
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-lg font-extrabold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--teal-700)] transition-colors">
                  {HOSPITAL_BRAND.appName}
                </span>
                <span className="rounded-full bg-[var(--teal-50)] px-2 py-0.5 text-[11px] font-semibold text-[var(--teal-700)] ring-1 ring-[var(--teal-200)]">
                  Hospitalar
                </span>
              </div>
              <p className="hidden text-xs text-[var(--text-muted)] sm:block">
                {HOSPITAL_BRAND.institutionName}
              </p>
            </div>
          </button>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {QUICK_NAV.map((item) => {
            const active = activeToolId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTool(item.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--teal-50)] text-[var(--teal-700)] font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          {activeToolId && (
            <button
              type="button"
              onClick={onGoHome}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Todas as ferramentas
            </button>
          )}

          <div
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[var(--teal-50)] px-3 py-1 text-xs font-semibold text-[var(--teal-700)] ring-1 ring-[var(--teal-200)]"
            title="Processamento 100% local, sem envio para nuvem externa"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--teal-600)]" />
            <span>{HOSPITAL_BRAND.lgpdBadge}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
