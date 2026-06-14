"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { MapPin, X, Loader2, Check, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { setSelectedPharmacy } from "@/actions/pharmacy";

type Unit = { id: string; name: string };

/**
 * Seletor de unidade da loja (estilo iFood): o cliente informa o CEP — que
 * roteia para a unidade que atende a região — ou escolhe manualmente. A unidade
 * define o estoque/disponibilidade exibidos e para qual farmácia o pedido vai.
 */
export function PharmacySelector({
  current,
  pharmacies,
}: {
  current: Unit | null;
  pharmacies: Unit[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [cep, setCep] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function choose(input: { cep?: string; pharmacyId?: string }) {
    setError(null);
    start(async () => {
      const res = await setSelectedPharmacy(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setCep("");
      router.refresh();
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-10 max-w-[10rem] items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-sm font-semibold transition hover:border-brand-300 hover:bg-muted sm:max-w-[14rem] sm:px-3"
          aria-label="Escolher unidade"
        >
          <MapPin className="size-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <span className="truncate">{current?.name ?? "Escolher unidade"}</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_0.25s_ease-out]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-extrabold">
              Escolha sua unidade
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground transition active:scale-90"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            Informe seu CEP para encontrarmos a farmácia que atende sua região, ou
            escolha uma unidade.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              choose({ cep });
            }}
            className="flex gap-2"
          >
            <input
              inputMode="numeric"
              placeholder="CEP (ex.: 09010-000)"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />
            <Button type="submit" variant="primary" disabled={pending || !cep.trim()}>
              {pending ? <Loader2 className="size-5 animate-spin" /> : "Buscar"}
            </Button>
          </form>

          {error && (
            <p className="mt-2 text-sm font-medium text-danger-500">{error}</p>
          )}

          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Unidades
            </p>
            {pharmacies.map((p) => {
              const active = current?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={pending}
                  onClick={() => choose({ pharmacyId: p.id })}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition",
                    active
                      ? "border-brand-600 bg-brand-50 dark:bg-brand-600/10"
                      : "border-border bg-card hover:border-brand-300 hover:bg-muted"
                  )}
                >
                  <Store className="size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  <span className="flex-1 truncate">{p.name}</span>
                  {active && <Check className="size-4 text-brand-600 dark:text-brand-400" />}
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
