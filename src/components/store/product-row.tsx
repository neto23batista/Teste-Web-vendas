import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { ProductCarousel } from "@/components/store/product-carousel";
import { Reveal } from "@/components/motion/motion";
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
            <h2 className="text-xl font-bold md:text-2xl">
              {tone === "promo" ? (
                <span className="gradient-promo bg-clip-text text-transparent">
                  {title}
                </span>
              ) : (
                title
              )}
            </h2>
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

      {/* Carrossel: autoplay + arrasto/setas manuais (para ao interagir). */}
      <Reveal>
        <ProductCarousel products={products} href={href} />
      </Reveal>
    </section>
  );
}
