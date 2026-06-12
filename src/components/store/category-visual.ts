import {
  Pill,
  HeartPulse,
  Sparkles,
  Baby,
  Sun,
  Stethoscope,
  Wand2,
  Activity,
  type LucideIcon,
} from "lucide-react";

/** Ícone Lucide por nome salvo no banco (Category.icon). */
export const categoryIconMap: Record<string, LucideIcon> = {
  Pill,
  HeartPulse,
  Sparkles,
  Baby,
  Sun,
  Stethoscope,
  Wand2,
  Activity,
};

export function categoryIcon(icon?: string | null): LucideIcon {
  return (icon && categoryIconMap[icon]) || Pill;
}

/** Cor própria por categoria (disco colorido, estilo app de delivery). */
export const categoryColorMap: Record<string, string> = {
  medicamentos: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  saude: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  dermo: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  bebe: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  vitaminas: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  cuidados: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  beleza: "bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300",
  equipamentos: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export const categoryColorFallback =
  "bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300";

export function categoryColor(slug: string): string {
  return categoryColorMap[slug] ?? categoryColorFallback;
}
