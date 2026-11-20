import React from "react";
import { Cpu, Lock, Server } from "lucide-react";
import { HOSPITAL_BRAND } from "../config/branding";
import type { Capabilities } from "../lib/api";
import { HospitalLogo } from "./HospitalLogo";

interface Props {
  capabilities: Capabilities | null;
}

export const Footer: React.FC<Props> = ({ capabilities }) => {
  return (
    <footer className="mt-16 bg-[var(--teal-950)] text-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <HospitalLogo size={38} inverted />
              <div>
                <div className="font-display text-base font-bold text-white">
                  {HOSPITAL_BRAND.appName} — {HOSPITAL_BRAND.institutionName}
                </div>
                <div className="text-xs text-teal-200/80">{HOSPITAL_BRAND.subtitle}</div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-300/90">
              {HOSPITAL_BRAND.footerNotice}
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300">
              Segurança & Conformidade
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                Zero retenção de prontuários e exames no servidor
              </li>
              <li className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                Pronto para implantação na intranet hospitalar (Docker / Local)
              </li>
              <li className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                29 ferramentas PDF open-source sem dependência externa
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300">
              {HOSPITAL_BRAND.supportLabel}
            </h4>
            <p className="text-xs text-slate-300">{HOSPITAL_BRAND.supportInfo}</p>
            {capabilities && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-teal-200">
                  PyPDF + PDFium ✓
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-teal-200">
                  OCR {capabilities.tesseract ? "Servidor ✓" : "Local Navegador ✓"}
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-teal-200">
                  Office {capabilities.libreoffice ? "LibreOffice ✓" : "Motor Python ✓"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} {HOSPITAL_BRAND.institutionName} • Uso Institucional</span>
          <span>Desenvolvido com software aberto • Privacidade de Dados (LGPD)</span>
        </div>
      </div>
    </footer>
  );
};
