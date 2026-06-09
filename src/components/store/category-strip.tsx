import Link from "next/link";
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
import { RevealGroup, RevealItem } from "@/components/motion/motion";

const iconMap: Record<string, LucideIcon> = {
  Pill,
  HeartPulse,
  Sparkles,
  Baby,
  Sun,
  Stethoscope,
  Wand2,
  Activity,
};

type Cat = { id: string; name: string; slug: string; icon: string | null };

export function CategoryStrip({ categories }: { categories: Cat[] }) {
  return (
    <RevealGroup className="grid grid-cols-4 gap-2 sm:gap-3 md:grid-cols-8">
      {categories.map((c) => {
        const Icon = (c.icon && iconMap[c.icon]) || Pill;
        return (
          <RevealItem key={c.id}>
            <Link
              href={`/catalogo?cat=${c.slug}`}
              className="group flex h-full flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-soft)] transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-brand-300 active:scale-95"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-600/15 dark:text-brand-300 md:size-14">
                <Icon className="size-5 transition-transform duration-300 group-hover:scale-110 md:size-6" />
              </span>
              <span className="text-[0.7rem] font-semibold leading-tight md:text-xs">
                {c.name}
              </span>
            </Link>
          </RevealItem>
        );
      })}
    </RevealGroup>
  );
}
