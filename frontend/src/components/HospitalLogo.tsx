import React from "react";
import { HOSPITAL_BRAND } from "../config/branding";

interface Props {
  size?: number;
  inverted?: boolean;
}

/**
 * Emblema inspirado na identidade visual do hospital:
 * - Arco dinâmico e círculo central em Carmesim -> Pêssego/Rosé (vitalidade, cuidado ativo)
 * - Forma acolhedora em Verde-água / Turquesa na base (mão acolhedora, saúde, confiança)
 * Caso HOSPITAL_BRAND.customLogoUrl esteja preenchido, exibe a imagem oficial do hospital.
 */
export const HospitalLogo: React.FC<Props> = ({ size = 40, inverted = false }) => {
  if (HOSPITAL_BRAND.customLogoUrl) {
    return (
      <img
        src={HOSPITAL_BRAND.customLogoUrl}
        alt={HOSPITAL_BRAND.institutionName}
        style={{ height: size, width: "auto" }}
        className="object-contain"
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="vitalArcGrad" x1="12" y1="8" x2="54" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C81E3A" />
          <stop offset="65%" stopColor="#E95A65" />
          <stop offset="100%" stopColor="#F9B5A8" />
        </linearGradient>
        <linearGradient id="careHandGrad" x1="10" y1="36" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={inverted ? "#2DD4BF" : "#0F766E"} />
          <stop offset="100%" stopColor={inverted ? "#5EEAD4" : "#14B8A6"} />
        </linearGradient>
      </defs>

      {/* Fundo suave asséptico */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="16"
        fill={inverted ? "rgba(255,255,255,0.08)" : "#FFFFFF"}
        stroke={inverted ? "rgba(255,255,255,0.16)" : "#E2EBEB"}
        strokeWidth="1.5"
      />

      {/* Arco dinâmico Carmesim -> Pêssego (energia e vitalidade) */}
      <path
        d="M14 29C15.5 17 26.5 10.5 39 12.5C45.5 13.5 50 17.2 52 21.8C47.5 18.8 42 17.5 36.2 18.2C26.5 19.3 20 25 18.2 31.5C15.8 31 14.3 30.2 14 29Z"
        fill="url(#vitalArcGrad)"
      />

      {/* Círculo vital central */}
      <circle cx="34.5" cy="28" r="6.8" fill="url(#vitalArcGrad)" />

      {/* Mão / base acolhedora em Verde-água / Turquesa */}
      <path
        d="M12 37.5C16.5 35.5 22.8 38.2 29.8 39.8C36.8 41.4 44.2 39.5 51.5 34.5C50.2 42.2 44 49.2 34.2 50.8C24.5 52.3 15.8 47.4 12 37.5Z"
        fill="url(#careHandGrad)"
      />
      <path
        d="M19 46.8C24.5 50.2 33 51 40.8 47.8C35.2 52.4 26.5 53.2 19 46.8Z"
        fill={inverted ? "#99F6E4" : "#0D9488"}
        opacity="0.7"
      />
    </svg>
  );
};
