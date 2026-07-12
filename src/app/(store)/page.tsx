import Link from "next/link";
import {
  Truck,
  ShieldCheck,
  Clock,
  Stethoscope,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryStrip } from "@/components/store/category-strip";
import { ProductRow } from "@/components/store/product-row";
import { RecentlyViewedRail } from "@/components/store/recently-viewed";
import { HomeHero } from "@/components/store/home-hero";
import { PromoCarousel } from "@/components/store/promo-carousel";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/motion";
import {
  getCategories,
  getFeaturedProducts,
  getPromoProducts,
  getProductsByCategory,
} from "@/lib/products";
import { getShippingConfig } from "@/lib/settings";
import { getSelectedPharmacyId } from "@/lib/pharmacy";
import { jsonLdScript } from "@/lib/utils";

const benefits = [
  { icon: Truck, title: "Entrega expressa", text: "Receba em casa com rastreio em tempo real." },
  { icon: ShieldCheck, title: "100% seguro", text: "Pagamento criptografado e dados protegidos por LGPD." },
  { icon: Stethoscope, title: "Receita validada", text: "Envio e conferência farmacêutica direto no app." },
  { icon: Clock, title: "Atendimento 24h", text: "Suporte e orientação farmacêutica quando precisar." },
];

export default async function HomePage() {
  const pharmacyId = await getSelectedPharmacyId();
  const [categories, promos, featured, vitaminas, shipping] = await Promise.all([
    getCategories(),
    getPromoProducts(10, pharmacyId),
    getFeaturedProducts(10, pharmacyId),
    getProductsByCategory("vitaminas", 10, pharmacyId),
    getShippingConfig(pharmacyId),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Pharmacy",
    name: "FarmaVida",
    description:
      "Farmácia online com entrega rápida, compra segura e atendimento farmacêutico.",
    url: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      addressCountry: "BR",
      addressLocality: "São Paulo",
      addressRegion: "SP",
    },
  };

  return (
    <div className="aurora">
      <div className="container-page space-y-12 py-6 md:space-y-16 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      {/* HERO */}
      <HomeHero />

      {/* BANNERS PROMOCIONAIS */}
      <PromoCarousel freeShippingMin={shipping.freeMin} />

      {/* CATEGORIAS */}
      <section className="space-y-5">
        <Reveal className="flex items-center justify-between">
          <h2 className="text-xl font-bold md:text-2xl">Categorias</h2>
          <Link
            href="/catalogo"
            className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Ver tudo{" "}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
        <CategoryStrip categories={categories} />
      </section>

      {/* OFERTAS */}
      <ProductRow
        title="Ofertas da semana"
        subtitle="Descontos que cuidam do seu bolso"
        href="/catalogo?promo=1"
        products={promos}
        tone="promo"
      />

      {/* BENEFÍCIOS */}
      <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map(({ icon: Icon, title, text }) => (
          <RevealItem
            key={title}
            whileHover={{ y: -4 }}
            className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-card)]"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:scale-110 dark:bg-brand-600/15 dark:text-brand-300">
              <Icon className="size-5" />
            </span>
            <p className="mt-3 font-bold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </RevealItem>
        ))}
      </RevealGroup>

      {/* DESTAQUES */}
      <ProductRow
        title="Mais vendidos"
        subtitle="Os queridinhos da FarmaVida"
        href="/catalogo"
        products={featured}
      />

      {/* VITAMINAS */}
      <ProductRow
        title="Vitaminas & Suplementos"
        subtitle="Energia e imunidade para a rotina"
        href="/catalogo?cat=vitaminas"
        products={vitaminas}
      />

      {/* VISTOS RECENTEMENTE (localStorage — só aparece com histórico) */}
      <RecentlyViewedRail />

      {/* CTA */}
      <Reveal className="gradient-brand-soft overflow-hidden rounded-3xl border border-border p-8 text-center md:p-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">
          Tudo o que sua saúde precisa,{" "}
          <span className="text-gradient-vivid">em um só lugar</span>
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
          Mais de {categories.length} categorias com entrega rápida e
          atendimento farmacêutico.
        </p>
        <Button asChild variant="primary" size="lg" className="group mt-6">
          <Link href="/catalogo">
            Explorar catálogo completo{" "}
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </Reveal>
      </div>
    </div>
  );
}
