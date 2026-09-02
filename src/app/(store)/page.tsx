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
import { getShippingConfig, getStoreSettings } from "@/lib/settings";
import { getSelectedPharmacyId } from "@/lib/pharmacy";
import { jsonLdScript } from "@/lib/utils";
import type { Metadata } from "next";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "FarmaVida";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} — Farmácia online` },
  description:
    "Medicamentos isentos de prescrição, dermocosméticos, vitaminas e cuidados diários com estoque e entrega conforme a unidade selecionada.",
  alternates: { canonical: "/" },
};

const benefits = [
  { icon: Truck, title: "Acompanhamento do pedido", text: "Consulte o andamento na sua conta." },
  { icon: ShieldCheck, title: "Controles de segurança", text: "Acesso protegido em camadas e confirmação clara antes do pedido." },
  { icon: Stethoscope, title: "Somente venda livre", text: "O canal não vende medicamentos sujeitos a prescrição." },
  { icon: Clock, title: "Atendimento transparente", text: "Canais e horários ficam publicados no rodapé." },
];

export default async function HomePage() {
  const pharmacyId = await getSelectedPharmacyId();
  const [categories, promos, featured, vitaminas, shipping, store] = await Promise.all([
    getCategories(),
    getPromoProducts(10, pharmacyId),
    getFeaturedProducts(10, pharmacyId),
    getProductsByCategory("vitaminas", 10, pharmacyId),
    getShippingConfig(pharmacyId),
    getStoreSettings(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Pharmacy",
    name: process.env.NEXT_PUBLIC_APP_NAME ?? "FarmaVida",
    description:
      "Farmácia online de medicamentos isentos de prescrição, com catálogo e dados operacionais publicados.",
    url: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
    priceRange: "$$",
    ...(store.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: store.address,
            addressCountry: "BR",
          },
        }
      : {}),
  };

  return (
    <div className="aurora">
      <div className="container-page space-y-12 py-6 md:space-y-16 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      {/* HERO */}
      <HomeHero
        storeName={store.legalName || APP_NAME}
        freeShippingMin={shipping.freeMin}
      />

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
          Mais de {categories.length} categorias, com prazo calculado para sua
          região e canais de atendimento publicados.
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
