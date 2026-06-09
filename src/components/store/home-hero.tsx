"use client";

import { Search, Truck, ShieldCheck, Star, Sparkles, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, EASE_OUT, SPRING_SOFT } from "@/components/motion/motion";

const containerV = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const upV = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

export function HomeHero() {
  return (
    <section className="gradient-brand relative overflow-hidden rounded-3xl px-6 py-12 text-white shadow-[var(--shadow-glow)] md:px-12 md:py-16">
      {/* Brilhos decorativos ESTÁTICOS (sem animação contínua = sem repaint por frame) */}
      <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-accent-400/20 blur-2xl" />

      <div className="relative grid items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          variants={containerV}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          <motion.span
            variants={upV}
            className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold glass"
          >
            <Sparkles className="size-4" /> Sua farmácia, com cara de app
          </motion.span>

          <motion.h1
            variants={upV}
            className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl"
          >
            Saúde e bem-estar entregues na sua porta
          </motion.h1>

          <motion.p
            variants={upV}
            className="max-w-md text-base text-white/85 md:text-lg"
          >
            Medicamentos, dermocosméticos e cuidados diários com preço justo,
            entrega rápida e atendimento farmacêutico de verdade.
          </motion.p>

          <motion.form
            variants={upV}
            action="/catalogo"
            method="get"
            role="search"
            className="flex max-w-md gap-2 rounded-2xl bg-white p-2 shadow-lg"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                placeholder="O que você precisa hoje?"
                aria-label="Buscar produtos"
                className="h-11 w-full rounded-xl bg-transparent pl-10 pr-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <Button type="submit" variant="solid" className="shrink-0">
              Buscar
            </Button>
          </motion.form>

          <motion.div
            variants={upV}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80"
          >
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-4 fill-amber-300 text-amber-300" /> 4,9 de
              satisfação
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="size-4" /> Entrega no mesmo dia
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4" /> Compra protegida
            </span>
          </motion.div>
        </motion.div>

        {/* Card de destaque: só anima a ENTRADA (uma vez), sem loop contínuo. */}
        <div className="relative hidden md:block">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING_SOFT, delay: 0.35 }}
            className="rounded-3xl bg-white/10 p-5 glass"
          >
            <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <Pill className="size-6" />
                </span>
                <div>
                  <p className="text-sm font-bold">Kit Imunidade</p>
                  <p className="text-xs text-slate-500">Vitamina C + Zinco</p>
                </div>
                <span className="ml-auto rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-bold text-success-600">
                  -25%
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-400 line-through">R$ 79,90</p>
                  <p className="text-2xl font-extrabold text-brand-700">
                    R$ 59,90
                  </p>
                </div>
                <Button size="sm" variant="primary">
                  Adicionar
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
