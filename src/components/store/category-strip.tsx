import Link from "next/link";
import { cn } from "@/lib/utils";
import { categoryIcon, categoryColor } from "@/components/store/category-visual";
import { RevealGroup, RevealItem } from "@/components/motion/motion";

type Cat = { id: string; name: string; slug: string; icon: string | null };

export function CategoryStrip({ categories }: { categories: Cat[] }) {
  return (
    <RevealGroup className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-8 md:gap-3 md:overflow-visible md:px-0">
      {categories.map((c) => {
        const Icon = categoryIcon(c.icon);
        return (
          <RevealItem key={c.id} className="w-[4.75rem] shrink-0 snap-start md:w-auto">
            <Link
              href={`/catalogo?cat=${c.slug}`}
              className="group flex h-full flex-col items-center gap-2 py-1 text-center transition-transform duration-200 active:scale-95"
            >
              <span
                className={cn(
                  "grid size-14 place-items-center rounded-full shadow-[var(--shadow-soft)] ring-1 ring-black/[0.04] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105 dark:ring-white/[0.06] md:size-16",
                  categoryColor(c.slug)
                )}
              >
                <Icon className="size-6 md:size-7" strokeWidth={2.1} />
              </span>
              <span className="line-clamp-2 text-[0.7rem] font-semibold leading-tight text-foreground/90 md:text-xs">
                {c.name}
              </span>
            </Link>
          </RevealItem>
        );
      })}
    </RevealGroup>
  );
}
