import {
  Pill,
  HeartPulse,
  Sun,
  Baby,
  Dumbbell,
  Droplets,
  Scissors,
  SprayCan,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  Wand2,
  Activity,
  type LucideIcon,
} from "lucide-react";

/** Ícone Lucide por nome salvo no banco (Category.icon). */
export const categoryIconMap: Record<string, LucideIcon> = {
  Pill,
  HeartPulse,
  Sun,
  Baby,
  Dumbbell,
  Droplets,
  Scissors,
  SprayCan,
  ShoppingBasket,
  // Compatibilidade com ícones antigos ainda referenciados em dados/seed.
  Sparkles,
  Stethoscope,
  Wand2,
  Activity,
};

export function categoryIcon(icon?: string | null): LucideIcon {
  return (icon && categoryIconMap[icon]) || Pill;
}

/** Cor própria por categoria (disco colorido, estilo app de delivery). */
export const categoryColorMap: Record<string, string> = {
  perfumaria: "bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300",
  "protecao-solar": "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  medicamentos: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  saude: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  infantil: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  vitaminas: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  higiene: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  cabelo: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  "equip-conv": "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

export const categoryColorFallback =
  "bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300";

export function categoryColor(slug: string): string {
  return categoryColorMap[slug] ?? categoryColorFallback;
}
