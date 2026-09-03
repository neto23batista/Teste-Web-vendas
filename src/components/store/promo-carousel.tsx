"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  BadgePercent,
  Leaf,
  Truck,
  ArrowRight,
  Pause,
  Play,
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
      badge: "Na sua unidade",
      title: "Ofertas para o seu dia",
      text: "Confira produtos selecionados e os preços disponíveis agora.",
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
      bg: "bg-sky-900",
    },
    {
      badge: "Entrega",
      title: freeShippingMin > 0 ? `Frete grátis a partir de ${formatBRL(freeShippingMin)}` : "Entrega conforme seu CEP",
      text: "Prazo e disponibilidade calculados conforme seu CEP e a unidade selecionada.",
      cta: "Começar a comprar",
      href: "/catalogo",
      icon: Truck,
      bg: "bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600",
    },
  ];

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selected, setSelected] = useState(0);
  const paused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const autoplayActive = playing && !reduceMotion;

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
    if (reduceMotion) return;
    const id = setInterval(() => {
      if (!paused.current && playing) emblaApi.scrollNext();
    }, AUTOPLAY_MS);
    const stop = () => setPlaying(false);
    emblaApi.on("pointerDown", stop);
    return () => {
      clearInterval(id);
      emblaApi.off("pointerDown", stop);
    };
  }, [emblaApi, playing, reduceMotion]);

  const goTo = (i: number) => {
    setPlaying(false);
    emblaApi?.scrollTo(i);
  };

  return (
    <section
      aria-label="Promoções"
      className="relative"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <div ref={emblaRef} className="overflow-hidden rounded-3xl shadow-[var(--shadow-glow)]">
        <div className="flex touch-pan-y">
          {slides.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="min-w-0 shrink-0 grow-0 basis-full">
                <Link
                  href={s.href}
                  className={cn(
                    "group relative block h-full overflow-hidden rounded-3xl px-6 py-8 text-white grain md:px-10 md:py-10",
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
                    <span className="sheen mt-1 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition-transform duration-200 hover:scale-[1.03] active:scale-95">
                      {s.cta} <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        aria-label={
          reduceMotion
            ? "Banners automáticos desativados pela preferência de movimento reduzido"
            : autoplayActive
              ? "Pausar banners"
              : "Retomar banners"
        }
        aria-pressed={autoplayActive}
        disabled={!!reduceMotion}
        onClick={() => setPlaying((current) => !current)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed"
      >
        {autoplayActive ? <Pause className="size-4" /> : <Play className="size-4" />}
        {reduceMotion ? "Movimento reduzido" : autoplayActive ? "Pausar" : "Retomar"}
      </button>

      {/* dots */}
      <div className="flex gap-2" aria-label="Selecionar promoção">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Ir para o banner ${i + 1}`}
            aria-current={selected === i}
            onClick={() => goTo(i)}
            className={cn(
              "grid size-11 place-items-center rounded-xl border text-sm font-bold transition-colors",
              selected === i ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >{i + 1}</button>
        ))}
      </div>
      </div>
    </section>
  );
}
