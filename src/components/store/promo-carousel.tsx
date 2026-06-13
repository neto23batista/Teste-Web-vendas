"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import {
  BadgePercent,
  Leaf,
  Truck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/utils";

type Slide = {
  badge: string;
  title: string;
  text: string;
  cta: string;
  href: string;
  icon: LucideIcon;
  /** classes de fundo (gradiente) do slide */
  bg: string;
};

const AUTOPLAY_MS = 5000;

/**
 * Carrossel de banners promocionais (estilo app de delivery): autoplay,
 * arrasto, dots. Pausa no hover/foco e respeita prefers-reduced-motion.
 */
export function PromoCarousel({ freeShippingMin }: { freeShippingMin: number }) {
  const slides: Slide[] = [
    {
      badge: "Só esta semana",
      title: "Ofertas com até 40% OFF",
      text: "Medicamentos, vitaminas e dermocosméticos com desconto de verdade.",
      cta: "Ver ofertas",
      href: "/catalogo?promo=1",
      icon: BadgePercent,
      bg: "gradient-brand",
    },
    {
      badge: "Economia inteligente",
      title: "Genéricos com qualidade",
      text: "O mesmo princípio ativo por um preço que cabe no bolso.",
      cta: "Ver genéricos",
      href: "/catalogo?generic=1",
      icon: Leaf,
      bg: "bg-gradient-to-br from-brand-700 via-brand-600 to-rose-500",
    },
    {
      badge: "Entrega",
      title: `Frete grátis acima de ${formatBRL(freeShippingMin)}`,
      text: "Receba em casa rapidinho, com rastreio em tempo real.",
      cta: "Começar a comprar",
      href: "/catalogo",
      icon: Truck,
      bg: "bg-gradient-to-br from-orange-700 via-orange-600 to-amber-500",
    },
  ];

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selected, setSelected] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Autoplay manual (sem plugin): respeita reduced-motion e pausa em interação.
  useEffect(() => {
    if (!emblaApi) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!paused.current) emblaApi.scrollNext();
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [emblaApi]);

  const goTo = useCallback(
    (i: number) => emblaApi?.scrollTo(i),
    [emblaApi]
  );

  return (
    <section
      aria-label="Promoções"
      className="relative"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <div ref={emblaRef} className="overflow-hidden rounded-3xl">
        <div className="flex touch-pan-y">
          {slides.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="min-w-0 shrink-0 grow-0 basis-full">
                <Link
                  href={s.href}
                  className={cn(
                    "relative block overflow-hidden rounded-3xl px-6 py-8 text-white md:px-10 md:py-10",
                    s.bg
                  )}
                >
                  {/* decoração */}
                  <Icon
                    aria-hidden
                    className="pointer-events-none absolute -right-6 -top-6 size-40 rotate-12 text-white/15 md:-right-2 md:top-1/2 md:size-44 md:-translate-y-1/2"
                    strokeWidth={1.2}
                  />
                  <div className="relative max-w-md space-y-2.5">
                    <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur-sm">
                      {s.badge}
                    </span>
                    <h2 className="text-2xl font-extrabold leading-tight md:text-3xl">
                      {s.title}
                    </h2>
                    <p className="text-sm text-white/85 md:text-base">{s.text}</p>
                    <span className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition-transform duration-200 hover:scale-[1.03] active:scale-95">
                      {s.cta} <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* dots */}
      <div className="absolute bottom-3 right-4 flex gap-1.5 md:bottom-4 md:right-6">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Ir para o banner ${i + 1}`}
            aria-current={selected === i}
            onClick={() => goTo(i)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              selected === i ? "w-6 bg-white" : "w-2 bg-white/45 hover:bg-white/70"
            )}
          />
        ))}
      </div>
    </section>
  );
}
