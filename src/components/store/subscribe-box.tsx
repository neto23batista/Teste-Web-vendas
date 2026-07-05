"use client";

import * as React from "react";
import Link from "next/link";
import { Repeat, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { subscribeToProduct } from "@/actions/subscriptions";
import { intervalLabel } from "@/lib/subscriptions";
import { IntervalPicker } from "@/components/store/interval-picker";

/**
 * Bloco "assine e nunca fique sem" da página de produto. Sem cobrança
 * automática: no vencimento o cliente recebe um lembrete e repõe em 1 clique.
 */
export function SubscribeBox({
  productId,
  loggedIn,
  existing,
}: {
  productId: string;
  loggedIn: boolean;
  /** Assinatura já existente do usuário para este produto (estado inicial). */
  existing: { intervalDays: number; status: string } | null;
}) {
  const [interval, setInterval] = React.useState<number>(
    existing?.intervalDays ?? 30
  );
  // "Ativa" só quando o status é ACTIVE — uma assinatura PAUSADA cai no ramo de
  // ativação (o cliente pode religá-la aqui), não no selo verde "ativa".
  const [active, setActive] = React.useState(existing?.status === "ACTIVE");
  const [pending, startTransition] = React.useTransition();

  function activate() {
    startTransition(async () => {
      try {
        const res = await subscribeToProduct(productId, interval);
        if (res.ok) {
          setActive(true);
          toast.success("Reposição ativada!", {
            description: `Vamos te lembrar ${intervalLabel(interval).toLowerCase()}. Gerencie em Minha conta → Assinaturas.`,
          });
        } else {
          toast.error(res.error ?? "Não foi possível ativar a reposição.");
        }
      } catch {
        toast.error("Não foi possível ativar a reposição agora. Tente novamente.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4">
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
          <Repeat className="size-4" />
        </span>
        Assine a reposição e nunca fique sem
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Sem cobrança automática: no dia certo a gente te avisa e você repõe em 1
        clique.
      </p>

      {active ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-success-600">
          <CheckCircle2 className="size-4" /> Reposição ativa
          <Link
            href="/conta/assinaturas"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Gerenciar
          </Link>
        </div>
      ) : loggedIn ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntervalPicker value={interval} onSelect={setInterval} disabled={pending} />
          <button
            type="button"
            onClick={activate}
            disabled={pending}
            className="press ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            <Repeat className="size-3.5" />
            {pending ? "Ativando…" : "Ativar reposição"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm">
          <Link
            href="/login"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Entre na sua conta
          </Link>{" "}
          <span className="text-muted-foreground">para ativar a reposição.</span>
        </p>
      )}
    </div>
  );
}
