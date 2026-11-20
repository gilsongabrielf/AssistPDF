import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, HeartPulse, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { ToolIcon } from "./components/ToolIcon";
import { ToolWorkspace } from "./components/ToolWorkspace";
import { HOSPITAL_BRAND } from "./config/branding";
import {
  CATEGORIES,
  HOSPITAL_QUICK_WORKFLOWS,
  TOOLS,
  type ToolCategory,
  type ToolId,
} from "./data/tools";
import { type Capabilities, fetchCapabilities } from "./lib/api";

function getHashToolId(): ToolId | null {
  const raw = window.location.hash.replace(/^#\/?/, "").trim();
  if (!raw) return null;
  return TOOLS.some((t) => t.id === raw) ? (raw as ToolId) : null;
}

export const App: React.FC = () => {
  const [activeToolId, setActiveToolId] = useState<ToolId | null>(() => getHashToolId());
  const [category, setCategory] = useState<ToolCategory>("all");
  const [query, setQuery] = useState("");
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);

  useEffect(() => {
    fetchCapabilities().then(setCapabilities);
  }, []);

  useEffect(() => {
    const onHash = () => setActiveToolId(getHashToolId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openTool = (id: ToolId) => {
    setActiveToolId(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = () => {
    setActiveToolId(null);
    if (window.location.hash) {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeTool = useMemo(
    () => TOOLS.find((t) => t.id === activeToolId) || null,
    [activeToolId]
  );

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <Header activeToolId={activeToolId} onGoHome={goHome} onSelectTool={openTool} />

      <main className="flex-1">
        {activeTool ? (
          <ToolWorkspace tool={activeTool} capabilities={capabilities} />
        ) : (
          <>
            {/* HERO SECTION — Limpo, Asséptico, Hierarquia Verde-água + Carmesim pontual */}
            <section className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-white">
              {/* Detalhes cromáticos sutis da marca (turquesa + pêssego/carmesim suave) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
                style={{ background: "var(--brand-vital-gradient)" }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
                style={{ background: "var(--brand-care-gradient)" }}
              />

              <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal-50)] px-3.5 py-1.5 text-xs font-semibold text-[var(--teal-700)] ring-1 ring-[var(--teal-200)]">
                    <HeartPulse className="h-3.5 w-3.5 text-[var(--crimson-600)]" />
                    <span>{HOSPITAL_BRAND.subtitle} • 29 Ferramentas Completas</span>
                  </div>

                  <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15]">
                    Todas as ferramentas de PDF que o hospital precisa, com{" "}
                    <span className="text-[var(--teal-700)]">segurança total</span>
                  </h1>

                  <p className="mt-3.5 text-base leading-relaxed text-[var(--text-secondary)]">
                    Junte exames, divida prontuários, comprima laudos, aplique tarja definitiva LGPD,
                    assine documentos e converta arquivos Office — 100% processado localmente, sem
                    enviar dados de pacientes para fora da instituição.
                  </p>

                  {/* Search bar */}
                  <div className="mx-auto mt-7 max-w-xl">
                    <div className="relative flex items-center">
                      <Search className="pointer-events-none absolute left-4 h-5 w-5 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar ferramenta (ex: juntar, Word, comprimir, tarjar CPF, assinar)..."
                        className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] py-3.5 pl-12 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-xs focus:border-[var(--teal-600)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--teal-100)] transition-all"
                      />
                      {query && (
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className="absolute right-3 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Hospital Workflows Bar */}
                <div className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-warm)]/70 p-4">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--crimson-700)] mr-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      Rotinas Hospitalares:
                    </span>
                    {HOSPITAL_QUICK_WORKFLOWS.map((wf) => (
                      <button
                        key={wf.toolId}
                        type="button"
                        onClick={() => openTool(wf.toolId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-2xs hover:border-[var(--teal-500)] hover:text-[var(--teal-700)] transition-all"
                      >
                        <span>{wf.label}</span>
                        <span className="text-[11px] font-normal text-[var(--text-muted)]">
                          ({wf.hint})
                        </span>
                        <ArrowRight className="h-3 w-3 text-[var(--teal-600)]" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* CATEGORY TABS & 29-TOOL GRID */}
            <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {CATEGORIES.map((cat) => {
                    const isActive = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                          isActive
                            ? "bg-[var(--teal-600)] text-white shadow-sm"
                            : "border border-[var(--border-subtle)] bg-white text-[var(--text-secondary)] hover:border-[var(--teal-200)] hover:bg-[var(--teal-50)]/50 hover:text-[var(--teal-800)]"
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  Exibindo {filteredTools.length} ferramenta{filteredTools.length !== 1 ? "s" : ""}
                </span>
              </div>

              {filteredTools.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-12 text-center">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Nenhuma ferramenta encontrada para "{query}".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setCategory("all");
                    }}
                    className="mt-3 text-xs font-bold text-[var(--teal-700)] hover:underline"
                  >
                    Mostrar todas as 29 ferramentas
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredTools.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => openTool(tool.id)}
                      className="tool-card group relative flex flex-col items-start rounded-2xl p-5 text-left focus:outline-none focus:ring-2 focus:ring-[var(--teal-500)]"
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <ToolIcon icon={tool.icon} accent={tool.accent} />
                        {tool.badge && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              tool.badge === "LGPD"
                                ? "bg-[var(--crimson-50)] text-[var(--crimson-600)] ring-1 ring-[var(--crimson-200)]"
                                : "bg-[var(--teal-50)] text-[var(--teal-700)] ring-1 ring-[var(--teal-200)]"
                            }`}
                          >
                            {tool.badge}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 font-display text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--teal-700)] transition-colors">
                        {tool.name}
                      </h3>

                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {tool.description}
                      </p>

                      <div className="mt-auto pt-4 flex items-center gap-1 text-xs font-semibold text-[var(--teal-700)] opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                        <span>Abrir ferramenta</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* LGPD Trust Strip */}
              <div className="mt-12 rounded-2xl border border-[var(--teal-200)] bg-gradient-to-r from-[var(--teal-50)] via-white to-[var(--bg-surface-warm)] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--teal-600)] text-white shadow-sm">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                      Projetado para Privacidade Clínica e Intranet Hospitalar
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
                      Diferente de sites públicos na internet, esta plataforma roda inteiramente sob
                      controle da TI do hospital. Nenhum exame, laudo ou dado de paciente é enviado
                      para servidores de terceiros ou armazenado após o download.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openTool("redact")}
                  className="btn-primary-cta shrink-0 rounded-xl px-5 py-3 text-xs font-bold inline-flex items-center gap-2"
                >
                  Testar Tarja LGPD <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer capabilities={capabilities} />
    </div>
  );
};

export default App;
