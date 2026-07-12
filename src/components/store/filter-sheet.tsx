"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal, Leaf, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Bottom-sheet de filtros (mobile, estilo app): os ajustes ficam em rascunho
 * e só aplicam na URL ao tocar "Ver resultados" — sem recarregar a cada toque.
 */
export function FilterSheet({
  brands = [],
}: {
  brands?: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [open, setOpen] = React.useState(false);

  // Rascunho local — sincronizado com a URL quando o sheet abre.
  const [promo, setPromo] = React.useState(false);
  const [generic, setGeneric] = React.useState(false);
  const [marca, setMarca] = React.useState("");
  const [pmin, setPmin] = React.useState("");
  const [pmax, setPmax] = React.useState("");

  function syncFromUrl() {
    setPromo(!!params.get("promo"));
    setGeneric(!!params.get("generic"));
    setMarca(params.get("marca") ?? "");
    setPmin(params.get("pmin") ?? "");
    setPmax(params.get("pmax") ?? "");
  }

  const activeCount =
    (params.get("promo") ? 1 : 0) +
    (params.get("generic") ? 1 : 0) +
    (params.get("marca") ? 1 : 0) +
    (params.get("pmin") || params.get("pmax") ? 1 : 0);

  function apply() {
    const next = new URLSearchParams(params.toString());
    const setOrDel = (key: string, value: string | null) => {
      if (value) next.set(key, value);
      else next.delete(key);
    };
    setOrDel("promo", promo ? "1" : null);
    setOrDel("generic", generic ? "1" : null);
    setOrDel("marca", marca || null);
    setOrDel("pmin", pmin || null);
    setOrDel("pmax", pmax || null);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
    setOpen(false);
  }

  function clearAll() {
    setPromo(false);
    setGeneric(false);
    setMarca("");
    setPmin("");
    setPmax("");
  }

  const toggleCls = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-95",
      active
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-border bg-card"
    );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) syncFromUrl();
        setOpen(o);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-semibold transition active:scale-95"
        >
          <SlidersHorizontal className="size-4" /> Filtros
          {activeCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-promo-500 text-[0.65rem] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_0.25s_ease-out]" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none data-[state=open]:animate-[sheet-up_0.3s_cubic-bezier(0.22,1,0.36,1)]"
          aria-describedby={undefined}
        >
          {/* alça do sheet */}
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />

          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-extrabold">
              Filtros
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar filtros"
                className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground transition active:scale-90"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPromo(!promo)} className={toggleCls(promo)}>
                <Tag className="size-4" /> Ofertas
              </button>
              <button type="button" onClick={() => setGeneric(!generic)} className={toggleCls(generic)}>
                <Leaf className="size-4" /> Genéricos
              </button>
            </div>

            {brands.length > 0 && (
              <div className="space-y-1.5">
                <label htmlFor="sheet-marca" className="text-sm font-semibold">
                  Marca
                </label>
                <select
                  id="sheet-marca"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-border bg-card px-4 text-sm font-semibold outline-none transition focus:border-brand-400"
                >
                  <option value="">Todas as marcas</option>
                  {brands.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Faixa de preço</p>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Preço mínimo"
                  inputMode="decimal"
                  placeholder="R$ mín"
                  value={pmin}
                  onChange={(e) => setPmin(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-center text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-muted-foreground focus:border-brand-400"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <input
                  aria-label="Preço máximo"
                  inputMode="decimal"
                  placeholder="R$ máx"
                  value={pmax}
                  onChange={(e) => setPmax(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-center text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-muted-foreground focus:border-brand-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={clearAll}
            >
              Limpar
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-[2]"
              onClick={apply}
            >
              Ver resultados
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
