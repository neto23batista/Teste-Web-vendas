import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/store/product-card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/motion";
import type { ProductCard as ProductCardData } from "@/lib/products";

export function ProductRow({
  title,
  subtitle,
  href,
  products,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="space-y-4">
      <Reveal className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold md:text-2xl">{title}</h2>
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

      <RevealGroup className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {products.map((p) => (
          <RevealItem
            key={p.id}
            className="w-[210px] shrink-0 snap-start md:w-[240px]"
          >
            <ProductCard product={p} className="h-full" />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
