import Link from "next/link";
import { ArrowUpRight, Search, Truck, ShieldCheck, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";

export function HomeHero({ storeName, freeShippingMin }: { storeName: string; freeShippingMin: number }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6 p-6 sm:p-10 lg:p-12">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-700 dark:text-brand-300">
            <Pill aria-hidden="true" className="size-5" /> {storeName} · sua farmácia online
          </p>
          <h1 className="max-w-2xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Cuidado para o seu dia. <span className="text-brand-700 dark:text-brand-300">Perto de você.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Medicamentos isentos de prescrição, dermocosméticos e cuidados diários.
            Consulte disponibilidade, preços e entrega na sua unidade.
          </p>
          <form action="/catalogo" method="get" role="search" aria-label="Busca na loja"
            className="flex max-w-xl flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
            <div className="relative min-w-0 flex-[1_1_12rem]">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input name="q" placeholder="O que você precisa hoje?" aria-label="Buscar produtos"
                className="h-12 w-full rounded-xl bg-transparent pl-10 pr-2 text-base text-foreground placeholder:text-muted-foreground" />
            </div>
            <Button type="submit" variant="primary" className="min-h-12 flex-1 sm:flex-none">Buscar</Button>
          </form>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm leading-relaxed text-muted-foreground">
            <span className="inline-flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-info" /> Total confirmado antes da compra</span>
            <span className="inline-flex items-center gap-2"><Truck aria-hidden="true" className="size-5 shrink-0 text-info" />
              {freeShippingMin > 0 ? `Frete grátis a partir de ${formatBRL(freeShippingMin)}` : "Entrega conforme seu CEP"}
            </span>
          </div>
        </div>
        <aside className="flex flex-col justify-center gap-6 border-t border-border bg-info-surface p-6 text-info sm:p-10 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-current/20"><Truck aria-hidden="true" className="size-6" /></span><p className="text-sm font-semibold">Da sua unidade<br />até a sua porta</p></div>
          <h2 className="text-2xl font-bold leading-tight">Escolha com calma.<br />Receba com praticidade.</h2>
          <p className="text-base leading-relaxed">Informe seu CEP no checkout para conferir as opções e os prazos disponíveis. Acompanhe cada etapa pela sua conta.</p>
          <Link href="/catalogo?promo=1" className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg font-bold underline underline-offset-4">
            Explorar ofertas <ArrowUpRight aria-hidden="true" className="size-5" />
          </Link>
        </aside>
      </div>
    </section>
  );
}
