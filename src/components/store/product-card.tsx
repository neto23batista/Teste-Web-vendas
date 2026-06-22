import Link from "next/link";
import { FileText, Leaf } from "lucide-react";
import { formatBRL, discountPercent, cn } from "@/lib/utils";
import { ProductImage } from "@/components/store/product-image";
import { StarRating } from "@/components/store/star-rating";
import { AddToCartButton } from "@/components/store/add-to-cart-button";
import { FavoriteButton } from "@/components/store/favorite-button";
import type { ProductCard as ProductCardData } from "@/lib/products";

export function ProductCard({
  product,
  className,
}: {
  product: ProductCardData;
  className?: string;
}) {
  const price = product.promoPrice ?? product.price;
  const off = discountPercent(product.price, product.promoPrice);
  const out = product.stock <= 0;
  const low = !out && product.stock <= 5;
  const href = `/produto/${product.slug}`;

  return (
    // Server Component: hover/tap só em CSS (transform/opacity = compositor,
    // sem JS por card). A entrada animada vem do <RevealItem> que o envolve.
    <article
      className={cn(
        "group gradient-border relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 hover:border-brand-300/70 hover:shadow-[var(--shadow-card)] active:scale-[0.99] dark:hover:border-brand-400/40",
        className
      )}
    >
      {/* Selos */}
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
        {off > 0 && (
          <span className="rounded-full bg-promo-500 px-2.5 py-1 text-xs font-bold text-white shadow">
            -{off}%
          </span>
        )}
        {product.requiresPrescription && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            <FileText className="size-3" /> Receita
          </span>
        )}
        {product.isGeneric && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            <Leaf className="size-3" /> Genérico
          </span>
        )}
      </div>

      {/* Favoritar (fica acima da imagem/link) */}
      <FavoriteButton
        productId={product.id}
        name={product.name}
        className="absolute right-3 top-3 z-10"
      />

      <Link href={href} className="block overflow-hidden" aria-label={product.name}>
        <ProductImage
          src={product.images[0]?.url}
          emoji={product.emoji}
          name={product.name}
          className="aspect-square w-full transition-transform duration-500 ease-out group-hover:scale-110"
          emojiClassName="text-6xl md:text-7xl transition-transform duration-500 group-hover:-rotate-6"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {product.brand?.name ?? product.category.name}
        </p>
        <Link href={href}>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
            {product.name}
          </h3>
        </Link>

        <StarRating rating={product.rating} count={product.ratingCount} />

        <div className="mt-1 flex items-end justify-between gap-2">
          <div>
            {product.promoPrice != null && (
              <p className="text-xs text-muted-foreground line-through">
                {formatBRL(product.price)}
              </p>
            )}
            <p className="text-xl font-extrabold tracking-tight text-brand-700 dark:text-brand-400">
              {formatBRL(price)}
            </p>
          </div>
          {low && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              Últimas
            </span>
          )}
        </div>

        <div className="mt-2">
          {out ? (
            <button
              disabled
              className="h-11 w-full rounded-xl bg-muted text-sm font-semibold text-muted-foreground"
            >
              Sem estoque
            </button>
          ) : (
            <AddToCartButton
              productId={product.id}
              name={product.name}
              className="w-full"
            />
          )}
        </div>
      </div>
    </article>
  );
}
