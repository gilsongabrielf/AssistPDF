import React from "react";
import {
  Archive,
  Code2,
  Combine,
  Crop,
  EyeOff,
  FileMinus2,
  FileOutput,
  FileSignature,
  FileSpreadsheet,
  FileText,
  FileType2,
  GitCompareArrows,
  Hash,
  ImagePlus,
  Images,
  LayoutGrid,
  Lock,
  Minimize2,
  MonitorPlay,
  PenTool,
  Presentation,
  RotateCw,
  ScanLine,
  ScanText,
  Scissors,
  Stamp,
  Table2,
  Unlock,
  Wrench,
} from "lucide-react";
import type { ToolDef } from "../data/tools";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Combine,
  Scissors,
  FileMinus2,
  FileOutput,
  LayoutGrid,
  ScanLine,
  Minimize2,
  Wrench,
  ScanText,
  ImagePlus,
  FileText,
  Presentation,
  FileSpreadsheet,
  Code2,
  Images,
  FileType2,
  MonitorPlay,
  Table2,
  Archive,
  RotateCw,
  Hash,
  Stamp,
  Crop,
  PenTool,
  Unlock,
  Lock,
  FileSignature,
  EyeOff,
  GitCompareArrows,
};

const ACCENT_STYLES: Record<ToolDef["accent"], { bg: string; text: string; ring: string }> = {
  teal: {
    bg: "bg-[#E8F8F5]",
    text: "text-[#0F766E]",
    ring: "ring-[#B7EDE4]",
  },
  crimson: {
    bg: "bg-[#FFF1F2]",
    text: "text-[#C81E3A]",
    ring: "ring-[#FECDD3]",
  },
  warm: {
    bg: "bg-[#FFF5F0]",
    text: "text-[#C2410C]",
    ring: "ring-[#FED7AA]",
  },
  emerald: {
    bg: "bg-[#ECFDF5]",
    text: "text-[#047857]",
    ring: "ring-[#A7F3D0]",
  },
  indigo: {
    bg: "bg-[#EEF4FF]",
    text: "text-[#1D4ED8]",
    ring: "ring-[#BFDBFE]",
  },
  amber: {
    bg: "bg-[#FFFBEB]",
    text: "text-[#B45309]",
    ring: "ring-[#FDE68A]",
  },
};

export const ToolIcon: React.FC<{
  icon: string;
  accent: ToolDef["accent"];
  size?: "sm" | "md" | "lg";
}> = ({ icon, accent, size = "md" }) => {
  const IconComp = ICON_MAP[icon] || FileText;
  const style = ACCENT_STYLES[accent] || ACCENT_STYLES.teal;
  const dims =
    size === "sm"
      ? "h-9 w-9 rounded-lg"
      : size === "lg"
      ? "h-12 w-12 rounded-2xl"
      : "h-11 w-11 rounded-xl";
  const iconDims = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";

  return (
    <div className={`${dims} ${style.bg} ${style.text} ring-1 ${style.ring} flex items-center justify-center shrink-0`}>
      <IconComp className={iconDims} />
    </div>
  );
};
