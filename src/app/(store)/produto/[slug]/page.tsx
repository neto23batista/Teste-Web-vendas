import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ChevronRight,
  FileText,
  Leaf,
  Truck,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/products";
import { getUserSubscriptionFor } from "@/lib/subscriptions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSelectedPharmacyId } from "@/lib/pharmacy";
import { formatBRL, discountPercent } from "@/lib/utils";
import { ProductGallery } from "@/components/store/product-gallery";
import { StarRating } from "@/components/store/star-rating";
import { ProductPurchase } from "@/components/store/product-purchase";
import { SubscribeBox } from "@/components/store/subscribe-box";
import { StickyBuyBar } from "@/components/store/sticky-buy-bar";
import { TrackRecentView } from "@/components/store/recently-viewed";
import { FavoriteButton } from "@/components/store/favorite-button";
import { ProductRow } from "@/components/store/product-row";
import { ReviewForm } from "@/components/store/review-form";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/motion";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };
  return {
    title: product.name,
    description: product.shortDescription ?? undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pharmacyId = await getSelectedPharmacyId();
  const product = await getProductBySlug(slug, pharmacyId);
  if (!product) notFound();

  const price = product.promoPrice ?? product.price;
  const off = discountPercent(product.price, product.promoPrice);
  const out = product.stock <= 0;
  const related = await getRelatedProducts(product.categoryId, product.id, 10, pharmacyId);

  const user = await getCurrentUser();
  const myReview = user
    ? await prisma.review.findUnique({
        where: { productId_userId: { productId: product.id, userId: user.id } },
        select: { rating: true, comment: true },
      })
    : null;
  // Assinatura de reposição: só para produtos sem receita.
  const mySubscription =
    user && !product.requiresPrescription
      ? await getUserSubscriptionFor(user.id, product.id)
      : null;

  // Ficha técnica: só as linhas com valor preenchido no cadastro.
  const specs: [string, string][] = [];
  if (product.activeIngredient) specs.push(["Princípio ativo", product.activeIngredient]);
  if (product.brand) specs.push(["Marca", product.brand.name]);
  specs.push(["Categoria", product.category.name]);
  if (product.ean) specs.push(["Código de barras (EAN)", product.ean]);
  if (product.sku) specs.push(["Código interno (SKU)", product.sku]);
  if (product.isGeneric) specs.push(["Medicamento genérico", "Sim"]);
  if (product.requiresPrescription) specs.push(["Venda sob prescrição", "Sim"]);

  // Rich snippet de produto (Google Shopping/busca orgânica).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description,
    ...(product.images.length > 0
      ? { image: product.images.map((i) => i.url) }
      : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.ean ? { gtin13: product.ean } : {}),
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand.name } }
      : {}),
    offers: {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "BRL",
      availability: out
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  return (
    <div className="aurora">
      <div className="container-page space-y-12 py-6 pb-28 md:py-8 md:pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Registra no "vistos recentemente" (localStorage, sem servidor). */}
      <TrackRecentView
        product={{
          slug: product.slug,
          name: product.name,
          emoji: product.emoji,
          image: product.images[0]?.url ?? null,
          price,
        }}
      />
      {/* CTA fixo no mobile (acima do bottom-nav) */}
      <StickyBuyBar
        productId={product.id}
        name={product.name}
        price={price}
        oldPrice={product.promoPrice != null ? product.price : null}
        disabled={out}
      />
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Início</Link>
        <ChevronRight className="size-4" />
        <Link href="/catalogo" className="hover:text-foreground">Catálogo</Link>
        <ChevronRight className="size-4" />
        <Link
          href={`/catalogo?cat=${product.category.slug}`}
          className="hover:text-foreground"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        {/* Imagem */}
        <Reveal className="relative">
          <div className="sticky top-24">
            {off > 0 && (
              <span className="absolute left-4 top-4 z-10 rounded-full bg-promo-500 px-3 py-1.5 text-sm font-bold text-white shadow">
                -{off}% OFF
              </span>
            )}
            <ProductGallery
              images={product.images}
              emoji={product.emoji}
              name={product.name}
            />
          </div>
        </Reveal>

        {/* Detalhes */}
        <Reveal className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {product.brand && (
              <span className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                {product.brand.name}
              </span>
            )}
            {product.requiresPrescription && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                <FileText className="size-3" /> Exige receita
              </span>
            )}
            {product.isGeneric && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <Leaf className="size-3" /> Genérico
              </span>
            )}
          </div>

          <h1 className="text-2xl font-extrabold leading-tight md:text-3xl">
            {product.name}
          </h1>

          <StarRating
            rating={product.rating}
            count={product.ratingCount}
            size="md"
          />

          <div className="gradient-border-on relative overflow-hidden rounded-2xl border border-border gradient-brand-soft p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-end gap-3">
              {product.promoPrice != null && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatBRL(product.price)}
                </span>
              )}
              <span className="text-4xl font-extrabold text-brand-700 dark:text-brand-400">
                {formatBRL(price)}
              </span>
              {off > 0 && (
                <span className="mb-1 rounded-full bg-promo-100 px-2 py-0.5 text-sm font-bold text-promo-700 dark:bg-promo-500/15 dark:text-promo-400">
                  Economize {formatBRL(product.price - price)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              ou em até 3x sem juros · à vista no Pix
            </p>

            <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
              {out ? (
                <span className="inline-flex items-center gap-1.5 text-danger-500">
                  <AlertCircle className="size-4" /> Indisponível no momento
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-success-600">
                  <CheckCircle2 className="size-4" /> Em estoque · pronto para
                  envio
                </span>
              )}
            </div>

            <div className="mt-5 space-y-3">
              <ProductPurchase
                productId={product.id}
                name={product.name}
                maxStock={product.stock}
                disabled={out}
              />
              <FavoriteButton
                productId={product.id}
                name={product.name}
                withLabel
                className="w-full sm:w-auto"
              />
            </div>
          </div>

          {/* Assinatura de reposição (uso contínuo, sem receita) */}
          {!product.requiresPrescription && (
            <SubscribeBox
              productId={product.id}
              loggedIn={!!user}
              existing={
                mySubscription
                  ? {
                      intervalDays: mySubscription.intervalDays,
                      status: mySubscription.status,
                    }
                  : null
              }
            />
          )}

          {/* Garantias */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Truck, label: "Entrega rápida" },
              { icon: ShieldCheck, label: "Compra segura" },
              { icon: RefreshCw, label: "Troca fácil" },
            ].map(({ icon: Icon, label }) => (
              <RevealItem
                key={label}
                whileHover={{ y: -4 }}
                className="group flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-3 text-center text-xs font-medium text-muted-foreground transition-colors hover:border-brand-300"
              >
                <Icon className="size-5 text-brand-600 transition-transform duration-300 group-hover:scale-110 dark:text-brand-400" />
                {label}
              </RevealItem>
            ))}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Descrição</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          </div>

          {/* Ficha técnica */}
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Ficha técnica</h2>
            <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card text-sm">
              {specs.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[10rem_1fr] gap-3 px-4 py-2.5 sm:grid-cols-[12rem_1fr]"
                >
                  <dt className="font-medium text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {product.requiresPrescription && (
            <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <FileText className="size-5 shrink-0" />
              <p>
                Este medicamento exige <strong>receita médica</strong>. Você
                poderá enviar o documento no checkout para validação
                farmacêutica antes do envio.
              </p>
            </div>
          )}
        </Reveal>
      </div>

      {/* Avaliações */}
      <section className="space-y-4">
        <Reveal>
          <h2 className="text-xl font-bold md:text-2xl">
            Avaliações{" "}
            <span className="text-base font-semibold text-muted-foreground">
              ({product.ratingCount})
            </span>
          </h2>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0">
            {product.reviews.length > 0 ? (
              <RevealGroup className="grid gap-4 sm:grid-cols-2">
                {product.reviews.map((r) => (
                  <RevealItem
                    key={r.id}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{r.user.name}</p>
                      <StarRating rating={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        “{r.comment}”
                      </p>
                    )}
                  </RevealItem>
                ))}
              </RevealGroup>
            ) : (
              <div className="grid place-items-center gap-1 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
                <p className="font-semibold">Ainda sem avaliações</p>
                <p className="text-sm text-muted-foreground">
                  Seja o primeiro a avaliar este produto.
                </p>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-24 lg:h-fit">
            {user ? (
              <ReviewForm
                productId={product.id}
                slug={product.slug}
                existing={myReview}
              />
            ) : (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
                <p className="font-bold">Avaliar este produto</p>
                <p className="text-muted-foreground">
                  <Link
                    href="/login"
                    className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Entre na sua conta
                  </Link>{" "}
                  para deixar sua avaliação.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Relacionados */}
      <ProductRow
        title="Quem viu, também levou"
        href={`/catalogo?cat=${product.category.slug}`}
        products={related}
      />
      </div>
    </div>
  );
}
