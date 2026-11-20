export type ToolCategory =
  | "all"
  | "organize"
  | "optimize"
  | "to-pdf"
  | "from-pdf"
  | "edit"
  | "security";

export type ToolId =
  | "merge"
  | "split"
  | "remove-pages"
  | "extract-pages"
  | "organize"
  | "scan-to-pdf"
  | "compress"
  | "repair"
  | "ocr"
  | "jpg-to-pdf"
  | "word-to-pdf"
  | "powerpoint-to-pdf"
  | "excel-to-pdf"
  | "html-to-pdf"
  | "pdf-to-jpg"
  | "pdf-to-word"
  | "pdf-to-powerpoint"
  | "pdf-to-excel"
  | "pdf-to-pdfa"
  | "rotate"
  | "page-numbers"
  | "watermark"
  | "crop"
  | "edit"
  | "unlock"
  | "protect"
  | "sign"
  | "redact"
  | "compare";

export interface ToolDef {
  id: ToolId;
  name: string;
  description: string;
  category: Exclude<ToolCategory, "all">;
  accept: string;
  multiple?: boolean;
  badge?: string;
  accent: "teal" | "crimson" | "warm" | "emerald" | "indigo" | "amber";
  icon: string;
  ctaLabel: string;
}

export const CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: "all", label: "Todas (29)" },
  { id: "organize", label: "Organizar PDF" },
  { id: "optimize", label: "Otimizar PDF" },
  { id: "to-pdf", label: "Converter para PDF" },
  { id: "from-pdf", label: "Converter de PDF" },
  { id: "edit", label: "Editar PDF" },
  { id: "security", label: "Segurança & LGPD" },
];

export const TOOLS: ToolDef[] = [
  // ==================== ORGANIZAR PDF (6) ====================
  {
    id: "merge",
    name: "Juntar PDF",
    description: "Combine prontuários, laudos e exames em um único PDF na ordem desejada.",
    category: "organize",
    accept: ".pdf,application/pdf",
    multiple: true,
    accent: "teal",
    icon: "Combine",
    ctaLabel: "Juntar PDF",
  },
  {
    id: "split",
    name: "Dividir PDF",
    description: "Separe páginas específicas ou divida um documento extenso em vários PDFs.",
    category: "organize",
    accept: ".pdf,application/pdf",
    accent: "teal",
    icon: "Scissors",
    ctaLabel: "Dividir PDF",
  },
  {
    id: "remove-pages",
    name: "Remover páginas",
    description: "Clique nas miniaturas das páginas que deseja excluir e salve um novo PDF.",
    category: "organize",
    accept: ".pdf,application/pdf",
    accent: "crimson",
    icon: "FileMinus2",
    ctaLabel: "Remover páginas",
  },
  {
    id: "extract-pages",
    name: "Extrair páginas",
    description: "Selecione visualmente páginas específicas para gerar um PDF avulso ou ZIP.",
    category: "organize",
    accept: ".pdf,application/pdf",
    accent: "teal",
    icon: "FileOutput",
    ctaLabel: "Extrair páginas",
  },
  {
    id: "organize",
    name: "Organizar PDF",
    description: "Reordene, gire, duplique ou exclua páginas de um ou mais PDFs visualmente.",
    category: "organize",
    accept: ".pdf,application/pdf",
    multiple: true,
    accent: "teal",
    icon: "LayoutGrid",
    ctaLabel: "Salvar organização",
  },
  {
    id: "scan-to-pdf",
    name: "Digitalizar para PDF",
    description: "Capture pela câmera ou envie fotos de receitas e guias com melhoria de nitidez.",
    category: "organize",
    accept: "image/*",
    multiple: true,
    accent: "emerald",
    icon: "ScanLine",
    ctaLabel: "Gerar PDF digitalizado",
  },

  // ==================== OTIMIZAR PDF (3) ====================
  {
    id: "compress",
    name: "Comprimir PDF",
    description: "Reduza o tamanho de arquivos PDF pesados mantendo ótima legibilidade.",
    category: "optimize",
    accept: ".pdf,application/pdf",
    accent: "emerald",
    icon: "Minimize2",
    ctaLabel: "Comprimir PDF",
  },
  {
    id: "repair",
    name: "Reparar PDF",
    description: "Recupere e reconstrua a estrutura de arquivos PDF corrompidos ou danificados.",
    category: "optimize",
    accept: ".pdf,application/pdf",
    accent: "amber",
    icon: "Wrench",
    ctaLabel: "Reparar PDF",
  },
  {
    id: "ocr",
    name: "OCR PDF",
    description: "Torne documentos digitalizados pesquisáveis e com texto selecionável (PT/EN).",
    category: "optimize",
    accept: ".pdf,application/pdf",
    badge: "PT-BR",
    accent: "teal",
    icon: "ScanText",
    ctaLabel: "Aplicar OCR",
  },

  // ==================== CONVERTER PARA PDF (5) ====================
  {
    id: "jpg-to-pdf",
    name: "JPG para PDF",
    description: "Converta imagens JPG, PNG ou WebP para PDF com controle de margens e orientação.",
    category: "to-pdf",
    accept: "image/*",
    multiple: true,
    accent: "warm",
    icon: "ImagePlus",
    ctaLabel: "Converter para PDF",
  },
  {
    id: "word-to-pdf",
    name: "Word para PDF",
    description: "Transforme documentos DOCX/DOC em arquivos PDF padronizados e prontos para envio.",
    category: "to-pdf",
    accept: ".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword",
    accent: "indigo",
    icon: "FileText",
    ctaLabel: "Converter Word em PDF",
  },
  {
    id: "powerpoint-to-pdf",
    name: "PowerPoint para PDF",
    description: "Converta apresentações PPTX/PPT de treinamentos e reuniões clínicas em PDF.",
    category: "to-pdf",
    accept: ".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation",
    accent: "warm",
    icon: "Presentation",
    ctaLabel: "Converter Slides em PDF",
  },
  {
    id: "excel-to-pdf",
    name: "Excel para PDF",
    description: "Transforme planilhas XLSX/XLS de escalas, faturamento e indicadores em PDF.",
    category: "to-pdf",
    accept: ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    accent: "emerald",
    icon: "FileSpreadsheet",
    ctaLabel: "Converter Planilha em PDF",
  },
  {
    id: "html-to-pdf",
    name: "HTML para PDF",
    description: "Converta código HTML ou arquivos .html de relatórios internos diretamente em PDF.",
    category: "to-pdf",
    accept: ".html,.htm,text/html",
    accent: "teal",
    icon: "Code2",
    ctaLabel: "Converter HTML em PDF",
  },

  // ==================== CONVERTER DE PDF (5) ====================
  {
    id: "pdf-to-jpg",
    name: "PDF para JPG",
    description: "Converta cada página em imagem JPG/PNG de alta definição ou extraia as fotos do PDF.",
    category: "from-pdf",
    accept: ".pdf,application/pdf",
    accent: "warm",
    icon: "Images",
    ctaLabel: "Converter para JPG",
  },
  {
    id: "pdf-to-word",
    name: "PDF para Word",
    description: "Converta arquivos PDF em documentos Word (.docx) fáceis de editar.",
    category: "from-pdf",
    accept: ".pdf,application/pdf",
    accent: "indigo",
    icon: "FileType2",
    ctaLabel: "Converter para Word",
  },
  {
    id: "pdf-to-powerpoint",
    name: "PDF para PowerPoint",
    description: "Transforme páginas de um PDF em slides PowerPoint (.pptx) prontos para apresentar.",
    category: "from-pdf",
    accept: ".pdf,application/pdf",
    accent: "warm",
    icon: "MonitorPlay",
    ctaLabel: "Converter para PPTX",
  },
  {
    id: "pdf-to-excel",
    name: "PDF para Excel",
    description: "Extraia tabelas e listas estruturadas de PDFs diretamente para planilhas Excel (.xlsx).",
    category: "from-pdf",
    accept: ".pdf,application/pdf",
    accent: "emerald",
    icon: "Table2",
    ctaLabel: "Converter para Excel",
  },
  {
    id: "pdf-to-pdfa",
    name: "PDF para PDF/A",
    description: "Converta documentos para o padrão ISO PDF/A de arquivamento permanente de prontuários.",
    category: "from-pdf",
    accept: ".pdf,application/pdf",
    badge: "Arquivo ISO",
    accent: "teal",
    icon: "Archive",
    ctaLabel: "Converter para PDF/A",
  },

  // ==================== EDITAR PDF (5) ====================
  {
    id: "rotate",
    name: "Rodar PDF",
    description: "Gire todas as páginas ou ajuste individualmente páginas digitalizadas de cabeça para baixo.",
    category: "edit",
    accept: ".pdf,application/pdf",
    accent: "teal",
    icon: "RotateCw",
    ctaLabel: "Rodar PDF",
  },
  {
    id: "page-numbers",
    name: "Números de página",
    description: "Insira numeração padronizada (ex: Página 1 de 10) na posição e fonte desejadas.",
    category: "edit",
    accept: ".pdf,application/pdf",
    accent: "teal",
    icon: "Hash",
    ctaLabel: "Inserir numeração",
  },
  {
    id: "watermark",
    name: "Marca d'água",
    description: "Adicione carimbo de texto ou logo institucional (ex: CONFIDENCIAL, CÓPIA CONTROLADA).",
    category: "edit",
    accept: ".pdf,application/pdf",
    accent: "teal",
    icon: "Stamp",
    ctaLabel: "Aplicar marca d'água",
  },
  {
    id: "crop",
    name: "Recortar PDF",
    description: "Selecione visualmente a área útil para remover margens excessivas ou cabeçalhos.",
    category: "edit",
    accept: ".pdf,application/pdf",
    accent: "amber",
    icon: "Crop",
    ctaLabel: "Recortar PDF",
  },
  {
    id: "edit",
    name: "Editar PDF",
    description: "Adicione textos, marcações, retângulos, imagens ou anotações à mão livre no documento.",
    category: "edit",
    accept: ".pdf,application/pdf",
    accent: "indigo",
    icon: "PenTool",
    ctaLabel: "Salvar PDF editado",
  },

  // ==================== SEGURANÇA & LGPD (5) ====================
  {
    id: "unlock",
    name: "Desbloquear PDF",
    description: "Remova senha e restrições de impressão ou cópia de documentos autorizados.",
    category: "security",
    accept: ".pdf,application/pdf",
    accent: "amber",
    icon: "Unlock",
    ctaLabel: "Desbloquear PDF",
  },
  {
    id: "protect",
    name: "Proteger PDF",
    description: "Criptografe documentos sensíveis com senha forte AES-256 e controle de permissões.",
    category: "security",
    accept: ".pdf,application/pdf",
    accent: "crimson",
    icon: "Lock",
    ctaLabel: "Proteger com senha",
  },
  {
    id: "sign",
    name: "Assinar PDF",
    description: "Desenhe, digite ou envie sua assinatura/carimbo (CRM/COREN) e posicione no documento.",
    category: "security",
    accept: ".pdf,application/pdf",
    accent: "teal",
    icon: "FileSignature",
    ctaLabel: "Assinar PDF",
  },
  {
    id: "redact",
    name: "Ocultar PDF (Tarjar)",
    description: "Oculte permanentemente CPF, nome de paciente ou áreas sensíveis com tarja definitiva LGPD.",
    category: "security",
    accept: ".pdf,application/pdf",
    badge: "LGPD",
    accent: "crimson",
    icon: "EyeOff",
    ctaLabel: "Aplicar tarja definitiva",
  },
  {
    id: "compare",
    name: "Comparar PDF",
    description: "Compare duas versões de protocolos ou contratos lado a lado com destaque visual de diferenças.",
    category: "security",
    accept: ".pdf,application/pdf",
    accent: "crimson",
    icon: "GitCompareArrows",
    ctaLabel: "Comparar documentos",
  },
];

export const HOSPITAL_QUICK_WORKFLOWS: { label: string; toolId: ToolId; hint: string }[] = [
  { label: "Tarjar dados LGPD", toolId: "redact", hint: "Ocultar CPF/paciente" },
  { label: "Unir exames e laudos", toolId: "merge", hint: "Juntar PDFs" },
  { label: "Assinar com carimbo", toolId: "sign", hint: "CRM / COREN" },
  { label: "Arquivar PDF/A", toolId: "pdf-to-pdfa", hint: "Prontuário ISO" },
  { label: "Digitalizar receita", toolId: "scan-to-pdf", hint: "Câmera ou foto" },
];
