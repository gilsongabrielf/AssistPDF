# AGENTS.md — AssistPDF / VidaPDF Hospitalar

Guia para agentes de IA e desenvolvedores. **Leia inteiro antes de qualquer alteração.** Em caso de conflito entre um pedido e as regras da seção 4 (LGPD), as regras prevalecem — avise o usuário em vez de violá-las.

## 1. Visão Geral

Suíte web open-source de manipulação de PDFs (**29 ferramentas**, equivalente ao iLovePDF PT) para ambiente hospitalar.

- **100% local e stateless (LGPD):** sem banco de dados, sem storage persistente, sem envio de documentos a APIs/nuvens externas.
- **Implantação dual:** web (Render/Railway via Docker; Vercel só para protótipos leves) e intranet hospitalar via `docker compose`, sem mudar código.
- **Idioma:** interface, textos, mensagens de erro e comentários em **português do Brasil**. Responda ao usuário em português.

## 2. Mapa de Arquivos

```text
.
├── AGENTS.md                  # Este guia
├── README.md                  # Documentação pública
├── Dockerfile                 # Multi-stage: React + Python + LibreOffice + Ghostscript + Tesseract PT-BR
├── docker-compose.yml         # Servidor/intranet hospitalar
├── render.yaml / railway.toml # Deploy automático (Docker)
├── vercel.json                # Vercel serverless opcional (limite ~4,5 MB, maxDuration 60s)
├── requirements.txt           # Dependências Python da raiz (usadas pelo Vercel)
├── start-local.bat            # Inicializador local Windows (porta 8000)
├── .dockerignore / .gitignore / .vercelignore
├── api/
│   ├── index.py               # Entrypoint ASGI para Vercel
│   └── requirements.txt
├── backend/
│   ├── main.py                # FastAPI, CORS, headers no-store, serve frontend/dist
│   ├── engine_core.py         # Inspeção, render de páginas, Organizar (6), Otimizar (3), get_capabilities()
│   ├── engine_convert.py      # Converter PARA PDF (5) e DE PDF (5)
│   ├── engine_edit_sec.py     # Editar (5) e Segurança/LGPD/Comparar (5)
│   ├── requirements.txt       # Dependências do backend (inclui uvicorn)
│   └── test_all_tools.py      # Testa as 29 ferramentas + LGPD
└── frontend/
    ├── index.html, package.json, tsconfig.json, vite.config.ts (proxy /api -> 127.0.0.1:8000)
    └── src/
        ├── main.tsx, index.css
        ├── App.tsx            # Dashboard, busca, categorias, rotinas hospitalares, roteamento por hash
        ├── config/branding.ts # Nome do app/hospital, ramal de TI, customLogoUrl
        ├── styles/tokens.css  # Tokens de cor oficiais
        ├── data/tools.ts      # Catálogo tipado das 29 ferramentas e rotinas rápidas
        ├── lib/api.ts         # Cliente HTTP (/api/*), download de Blob, OCR local (tesseract.js)
        └── components/        # Header, Footer, HospitalLogo, ToolIcon, DropZone,
                               # PageCanvasEditor, SignaturePad, CameraScanner, ToolWorkspace
```

Não versionar/editar: `node_modules/`, `frontend/dist/`, `backend/.venv/`, `__pycache__/`, `tsconfig.tsbuildinfo`.

## 3. Stack

- **Frontend:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, lucide-react, pdfjs-dist, tesseract.js (OCR no navegador quando não há Tesseract CLI no servidor).
- **Backend:** Python 3.12+ (Docker) / 3.13 (Windows), FastAPI, Uvicorn, pypdf, pycryptodome (AES-256), pypdfium2, reportlab, Pillow, python-docx, openpyxl, python-pptx, beautifulsoup4, lxml.
- **Binários opcionais** (detectados em `engine_core.get_capabilities()`, inclusos no Dockerfile; sempre manter fallback Python puro):
  - `soffice` (LibreOffice) → Word/Excel/PowerPoint para PDF.
  - `gs` (Ghostscript) → compressão avançada e PDF/A.
  - `tesseract` (por+eng) → OCR no servidor (fallback: tesseract.js).

### Rotas da API (`backend/main.py`)

- Utilitárias: `GET /api/health`, `GET /api/capabilities`, `POST /api/inspect`, `POST /api/render-page`.
- Ferramentas (`POST /api/tools/<id>`): merge, split, remove-pages, extract-pages, organize, scan-to-pdf, compress, repair, ocr, jpg-to-pdf, word-to-pdf, powerpoint-to-pdf, excel-to-pdf, html-to-pdf, pdf-to-jpg, pdf-to-word, pdf-to-powerpoint, pdf-to-excel, pdf-to-pdfa, rotate, page-numbers, watermark, crop, edit, unlock, protect, sign, redact, compare (+ `compare-report`, rota auxiliar de relatório, não conta como ferramenta).
- `GET /{full_path:path}` serve o SPA de `frontend/dist` — **deve ficar por último**, depois de todas as rotas `/api`.

## 4. Regras Inegociáveis: Privacidade, Segurança e LGPD

1. **Zero retenção:** nunca salvar uploads/resultados em banco, pasta `uploads/` ou buckets. Processar em memória (`bytes`/`io.BytesIO`) ou `tempfile.TemporaryDirectory()` destruído ao fim da operação.
2. **Zero vazamento em logs:** nunca `print`/log de conteúdo de PDFs, nomes de pacientes, CPFs ou texto extraído. Erros devolvidos ao usuário não devem incluir conteúdo do documento.
3. **Zero chamadas externas com documentos:** nenhuma ferramenta envia arquivos/texto a APIs de terceiros. Sem CDN/telemetria/analytics que receba dados do documento. Fontes/assets externos devem ser evitados em favor de assets locais quando possível (intranet pode não ter internet).
4. **Tarja LGPD definitiva (`redact_pdf`):** deve destruir fisicamente o texto sob as áreas tarjadas (aplicar tarja sólida e rasterizar as páginas afetadas a 200 DPI). Nunca trocar por um retângulo sobre texto selecionável.
5. **Sem cache:** manter `Cache-Control: no-store, max-age=0` em todas as respostas de arquivos processados (`backend/main.py`).
6. **Sem persistência no cliente:** não gravar conteúdo de documentos em `localStorage`/`IndexedDB`/cookies.

## 5. Identidade Visual

Definida em `frontend/src/styles/tokens.css` e `frontend/src/config/branding.ts`. Use os tokens CSS, não cores soltas.

| Uso | Token / HEX |
|---|---|
| Fundo principal | `--bg-canvas` `#F7FAFA` / `#FFFFFF` |
| Institucional / cuidado | `--teal-*` `#0D9488` / `#0F766E` |
| Destaque / CTA / alerta LGPD | `--crimson-*` `#C81E3A` → `--peach-300` (usar com parcimônia) |
| Superfícies neutras | `#F0F5F5`, `#FFF7F5` |
| Texto | `#1E293B` / `#475569` (evitar `#000`) |
| Rodapé | `#0F2E2E` (alto contraste) |

- Fontes: Inter + Plus Jakarta Sans. Ícones: lucide-react.
- Interface limpa, asséptica, com bom contraste e foco visível (acessibilidade importa: usuários são profissionais de saúde).
- Para trocar nome, textos institucionais ou logo, altere **apenas** `branding.ts` (imagem em `frontend/public/`).

## 6. Armadilhas Técnicas (não quebrar)

- **pypdf ≥ 7:** nunca chamar `page.merge_page(...)` antes de adicionar a página ao writer:
  ```python
  added = writer.add_page(page)
  added.merge_page(overlay_page)
  ```
  Atenção: os `requirements.txt` atuais declaram `pypdf>=5.1.0`; ao mexer em dependências, alinhe com `>=7.0` se o código depender disso.
- **URLs da API:** sempre relativas (`/api/...`) em `lib/api.ts`; nunca `http://localhost:8000`.
- **Dockerfile:** o `CMD` deve respeitar `${PORT:-8000}` e usar `--proxy-headers` (exigido por Render/Railway).
- **Windows 32-bit local:** não adicionar pacotes Python sem wheel binária para Windows (ex.: `cryptography`, `pymupdf` compilando da fonte) sem validar antes.
- **Dependências duplicadas:** `requirements.txt` (raiz), `api/requirements.txt` e `backend/requirements.txt` existem separados; ao adicionar/remover pacote, atualize todos os que se aplicam (Vercel usa raiz/api; Docker usa backend).
- **Vercel:** limite de corpo ~4,5 MB e sem binários (soffice/gs/tesseract). Não projetar funcionalidade que dependa disso exclusivamente.
- **Rota catch-all** do SPA sempre após as rotas `/api`.

## 7. Como Adicionar ou Alterar uma Ferramenta

Checklist — conclua **todos** os passos:

1. **Backend:** lógica em `engine_core.py`, `engine_convert.py` ou `engine_edit_sec.py` (retornar `bytes`, sem gravar em disco); rota em `backend/main.py` sob `/api/tools/<id>` com `Cache-Control: no-store, max-age=0`.
2. **Catálogo:** metadados em `frontend/src/data/tools.ts` (id idêntico ao da rota); ícone/acento em `ToolIcon.tsx`.
3. **Interface:** controles e envio `FormData` em `ToolWorkspace.tsx`, usando funções de `lib/api.ts`.
4. **Testes:** caso em `backend/test_all_tools.py`.
5. **Docs:** se mudar a contagem de ferramentas, atualizar este arquivo e o `README.md`.
6. **Validar** (seção 8) antes de dizer que terminou.

## 8. Comandos (PowerShell, a partir da raiz)

```powershell
# Setup inicial (uma vez)
python -m venv backend\.venv
backend\.venv\Scripts\pip install -r backend\requirements.txt
cd frontend; npm install; cd ..

# Testar backend (29 ferramentas + LGPD)
backend\.venv\Scripts\python.exe backend\test_all_tools.py

# Build do frontend (tsc + vite) — deve passar sem erros de TypeScript
cd frontend; npm run build; cd ..

# Dev: backend (8000) e frontend com proxy (outro terminal)
backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload --port 8000
cd frontend; npm run dev

# Rodar compilado localmente
.\start-local.bat

# Docker / intranet
docker compose up -d --build
```

Deploy (Render/Railway via GitHub) — **só quando o usuário pedir**: `git add . && git commit -m "mensagem" && git push origin main`.

## 9. Fluxo de Trabalho do Agente

1. Leia os arquivos relevantes antes de editar; mudanças mínimas e focadas, seguindo o estilo existente.
2. Frontend alterado → rodar `npm run build`. Backend alterado → rodar `test_all_tools.py`. Informe se não foi possível executar.
3. Nunca commitar/dar push sem pedido explícito. Nunca incluir PDFs reais ou dados de pacientes em testes, fixtures ou commits (gerar PDFs sintéticos).
4. Não adicionar dependências pesadas ou serviços externos sem justificar (ver seção 6).
5. Ao concluir, resuma o que mudou, o que foi testado e eventuais pendências, de forma concisa.
