# VidaPDF Hospitalar — Suíte Completa de Ferramentas PDF (100% Local / LGPD)

Aplicação web open-source criada sob medida para ambiente hospitalar, reunindo **todas as 29 ferramentas de PDF** (Organizar, Otimizar, Converter para PDF, Converter de PDF, Editar e Segurança/LGPD), com processamento **100% local**, zero retenção de arquivos em disco e pronta para transição **Web → Intranet**.

## Funcionalidades Incluídas (29 ferramentas)

- **Organizar PDF (6):** Juntar PDF, Dividir PDF, Remover páginas, Extrair páginas, Organizar PDF (reordenar/girar/duplicar/excluir), Digitalizar para PDF (câmera/webcam + filtros de nitidez).
- **Otimizar PDF (3):** Comprimir PDF (Extrema/Recomendada/Baixa), Reparar PDF, OCR PDF (texto pesquisável em PT/EN).
- **Converter para PDF (5):** JPG/PNG para PDF, Word para PDF, PowerPoint para PDF, Excel para PDF, HTML para PDF.
- **Converter de PDF (5):** PDF para JPG/PNG (ou extrair imagens), PDF para Word (.docx), PDF para PowerPoint (.pptx), PDF para Excel (.xlsx), PDF para PDF/A (ISO 1b/2b/3b para arquivamento de prontuários).
- **Editar PDF (5):** Rodar PDF, Números de página, Marca d'água (texto/mosaico/logo), Recortar PDF visualmente, Editar PDF (texto, marca-texto, caixa, desenho livre, imagem).
- **Segurança & LGPD (5):** Desbloquear PDF, Proteger PDF (AES-256 + permissões), Assinar PDF (desenho/texto/imagem + carimbo CRM/COREN), **Ocultar/Tarjar PDF (LGPD definitiva + detecção automática de CPF, CNPJ, telefone, e-mail e termos)**, Comparar PDF (mapa visual de diferenças + diff textual + relatório PDF).

## Como Personalizar com a Marca Oficial do Hospital

1. **Cores (tokens HEX):** edite `frontend/src/styles/tokens.css` (já estruturado com a paleta **Verde-água/Turquesa**, **Carmesim → Pêssego**, **Branco off-white**, **Cinza-chumbo** e **Rodapé turquesa profundo**).
2. **Nome e Logotipo oficial:** coloque o arquivo do logo em `frontend/public/logo-hospital.png` e edite `frontend/src/config/branding.ts`.

## Como Rodar Localmente (Windows)

Execute o script:
```bat
start-local.bat
```
Ou manualmente:
```powershell
cd frontend
npm run build
cd ..\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```
Acesse: **http://localhost:8000**

## Como Publicar na Web (Render ou Railway — Sem limite de 4,5 MB)

O projeto já inclui [Dockerfile](Dockerfile), [render.yaml](render.yaml) e [railway.toml](railway.toml) prontos para deploy automático via GitHub com **LibreOffice + Ghostscript + Tesseract PT-BR** embarcados:

1. Envie este projeto para um repositório no seu GitHub (`git remote add origin <URL>` e `git push -u origin main`).
2. **No Render (grátis para testes):** clique em **New → Blueprint** (ou **New → Web Service**), selecione o repositório e clique em **Deploy**. O `render.yaml` já configura Docker, porta dinâmica e health check `/api/health`.
3. **No Railway (sem hibernação):** clique em **New Project → Deploy from GitHub Repo**, selecione o repositório e gere o domínio público em **Settings → Networking**.

> **Atenção LGPD:** enquanto estiver na web pública, use apenas arquivos fictícios de teste. Para documentos reais de pacientes, utilize a implantação na intranet abaixo.

## Como Implantar na Intranet do Hospital (Docker — Recomendado)

O `Dockerfile` já empacota a interface web + backend Python + **LibreOffice** (conversão Office com fidelidade máxima) + **Ghostscript** (compressão avançada e PDF/A nativo) + **Tesseract OCR PT-BR/EN**:

```bash
docker compose up -d --build
```
Qualquer estação na rede interna do hospital acessa via `http://<IP-DO-SERVIDOR>:8000` (ou atrás do proxy reverso/HTTPS da intranet).
