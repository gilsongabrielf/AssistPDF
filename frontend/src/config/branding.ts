/**
 * Configuração central da identidade do hospital.
 * Para personalizar com o nome e logo oficial, edite apenas este arquivo
 * e/ou ajuste os tokens de cores em src/styles/tokens.css.
 */
export const HOSPITAL_BRAND = {
  appName: "VidaPDF",
  institutionName: "Rede Integrada de Saúde",
  subtitle: "Central Hospitalar de Documentos PDF",
  /**
   * Se quiser usar a imagem PNG/SVG oficial do logo do hospital,
   * coloque o arquivo em frontend/public/logo-hospital.png e defina:
   * customLogoUrl: "/logo-hospital.png"
   */
  customLogoUrl: "" as string,
  supportLabel: "TI & Prontuário Digital",
  supportInfo: "Ramal Interno TI • Uso exclusivo na rede institucional",
  lgpdBadge: "100% Local • Conformidade LGPD",
  footerNotice:
    "Todos os arquivos são processados localmente na infraestrutura da instituição, sem envio para servidores externos e sem retenção de dados de pacientes.",
};
