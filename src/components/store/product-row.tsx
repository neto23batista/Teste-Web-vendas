import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { ProductCard } from "@/components/store/product-card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/motion";
import type { ProductCard as ProductCardData } from "@/lib/products";

export function ProductRow({
  title,
  subtitle,
  href,
  products,
  tone,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  products: ProductCardData[];
  /** "promo" liga o visual quente de ofertas no cabeçalho da lane. */
  tone?: "promo";
}) {
  if (products.length === 0) return null;
  return (
    <section className="space-y-4">
      <Reveal className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {tone === "promo" && (
              <span className="grid size-7 place-items-center rounded-lg bg-promo-100 text-promo-600 dark:bg-promo-500/15 dark:text-promo-400">
                <Flame className="size-4" />
              </span>
            )}
            <h2 className="text-xl font-bold md:text-2xl">{title}</h2>
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Ver tudo{" "}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </Reveal>

      <RevealGroup className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:gap-4 md:px-0">
        {products.map((p) => (
          <RevealItem
            key={p.id}
            className="w-[180px] shrink-0 snap-start sm:w-[210px] md:w-[240px]"
          >
            <ProductCard product={p} className="h-full" />
          </RevealItem>
        ))}
        {/* Card final "Ver tudo" — convite a continuar (padrão de apps). */}
        {href && (
          <RevealItem className="w-[140px] shrink-0 snap-start md:w-[160px]">
            <Link
              href={href}
              className="group relative gradient-border hover-glow flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card/60 p-4 text-center transition-colors hover:border-brand-400 hover:bg-card"
            >
              <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105 dark:bg-brand-600/15 dark:text-brand-300">
                <ArrowRight className="size-5" />
              </span>
              <span className="text-sm font-bold text-brand-700 dark:text-brand-300">
                Ver tudo
              </span>
            </Link>
          </RevealItem>
        )}
      </RevealGroup>
    </section>
  );
}
