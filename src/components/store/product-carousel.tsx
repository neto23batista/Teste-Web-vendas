"use client";

import * as React from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { ProductCard } from "@/components/store/product-card";
import type { ProductCard as ProductCardData } from "@/lib/catalog";

const AUTOPLAY_MS = 3800;

/**
 * Carrossel das lanes de produto: desliza sozinho (autoplay), pausa no hover/
 * foco e PARA de vez quando a pessoa assume o controle (arrasto ou setas).
 * Arrasto/swipe nativo do embla + setas no desktop. Respeita reduced-motion.
 */
export function ProductCarousel({
  products,
  href,
}: {
  products: ProductCardData[];
  href?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    containScroll: "trimSnaps",
    duration: 30,
  });
  const paused = React.useRef(false);
  const [playing, setPlaying] = React.useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const autoplayActive = playing && !reduceMotion;

  // Autoplay (sem plugin): mesmo padrão do PromoCarousel.
  React.useEffect(() => {
    if (!emblaApi) return;
    if (reduceMotion) return;
    const id = setInterval(() => {
      if (!paused.current && playing) emblaApi.scrollNext();
    }, AUTOPLAY_MS);
    // Arrasto manual = a pessoa assumiu; o autoplay não volta a "brigar".
    const stop = () => setPlaying(false);
    emblaApi.on("pointerDown", stop);
    return () => {
      clearInterval(id);
      emblaApi.off("pointerDown", stop);
    };
  }, [emblaApi, playing, reduceMotion]);

  const manual = (dir: "prev" | "next") => {
    setPlaying(false);
    if (dir === "prev") emblaApi?.scrollPrev();
    else emblaApi?.scrollNext();
  };

  return (
    <div
      className="group/rail relative"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          aria-label={
            reduceMotion
              ? "Rotação desativada pela preferência de movimento reduzido"
              : autoplayActive
                ? "Pausar rotação de produtos"
                : "Retomar rotação de produtos"
          }
          aria-pressed={autoplayActive}
          disabled={!!reduceMotion}
          onClick={() => setPlaying((current) => !current)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {autoplayActive ? <Pause className="size-4" /> : <Play className="size-4" />}
          {reduceMotion ? "Movimento reduzido" : autoplayActive ? "Pausar" : "Retomar"}
        </button>
      </div>
      <div ref={emblaRef} className="-mx-4 overflow-hidden px-4 md:mx-0 md:px-0">
        <div className="flex touch-pan-y gap-3 pb-2 md:gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="w-[180px] shrink-0 grow-0 sm:w-[210px] md:w-[240px]"
            >
              <ProductCard product={p} className="h-full" />
            </div>
          ))}
          {/* Card final "Ver tudo" — convite a continuar (padrão de apps). */}
          {href && (
            <div className="w-[140px] shrink-0 grow-0 md:w-[160px]">
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
            </div>
          )}
        </div>
      </div>

      {/* Setas (desktop): aparecem ao passar o mouse na lane. */}
      <button
        type="button"
        aria-label="Produtos anteriores"
        onClick={() => manual("prev")}
        className="glass-surface press absolute -left-4 top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full text-foreground opacity-0 shadow-[var(--shadow-card)] transition-opacity duration-200 hover:text-brand-600 focus-visible:opacity-100 group-focus-within/rail:opacity-100 group-hover/rail:opacity-100 md:grid dark:hover:text-brand-400"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Próximos produtos"
        onClick={() => manual("next")}
        className="glass-surface press absolute -right-4 top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full text-foreground opacity-0 shadow-[var(--shadow-card)] transition-opacity duration-200 hover:text-brand-600 focus-visible:opacity-100 group-focus-within/rail:opacity-100 group-hover/rail:opacity-100 md:grid dark:hover:text-brand-400"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
