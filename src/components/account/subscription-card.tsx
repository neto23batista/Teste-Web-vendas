"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pause, Play, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  updateSubscriptionInterval,
  refillNow,
} from "@/actions/subscriptions";
import { SUBSCRIPTION_INTERVALS, intervalLabel } from "@/lib/subscriptions";
import { cn, formatBRL } from "@/lib/utils";

export type SubscriptionCardData = {
  id: string;
  qty: number;
  intervalDays: number;
  status: string;
  /** Data da próxima reposição já formatada no servidor (pt-BR). */
  nextDueLabel: string;
  product: {
    name: string;
    slug: string;
    emoji: string | null;
    image: string | null;
    price: number;
    active: boolean;
  };
};

export function SubscriptionCard({ sub }: { sub: SubscriptionCardData }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const paused = sub.status === "PAUSED";

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
    after?: () => void
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        after?.();
        router.refresh();
      } else {
        toast.error(res.error ?? "Algo deu errado. Tente novamente.");
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 transition",
        paused && "opacity-80"
      )}
    >
      <div className="flex items-start gap-3">
        <Link
          href={`/produto/${sub.product.slug}`}
          className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-3xl"
        >
          {sub.product.image ? (
            <Image
              src={sub.product.image}
              alt=""
              width={56}
              height={56}
              className="size-14 object-cover"
            />
          ) : (
            <span aria-hidden>{sub.product.emoji ?? "💊"}</span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/produto/${sub.product.slug}`}
            className="line-clamp-2 text-sm font-bold hover:underline"
          >
            {sub.product.name}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sub.qty} un. · {formatBRL(sub.product.price)} ·{" "}
            {paused ? "pausada" : `próxima em ${sub.nextDueLabel}`}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
            paused
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              : "bg-success-500/10 text-success-600"
          )}
        >
          {paused ? "Pausada" : "Ativa"}
        </span>
      </div>

      {/* Frequência */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {SUBSCRIPTION_INTERVALS.map((days) => (
          <button
            key={days}
            type="button"
            disabled={pending || days === sub.intervalDays}
            onClick={() =>
              run(
                () => updateSubscriptionInterval(sub.id, days),
                `Frequência alterada: ${intervalLabel(days).toLowerCase()}.`
              )
            }
            aria-pressed={days === sub.intervalDays}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-default",
              days === sub.intervalDays
                ? "border-brand-500 bg-brand-600 text-white"
                : "border-border text-muted-foreground hover:border-brand-300 hover:text-foreground disabled:opacity-50"
            )}
          >
            {intervalLabel(days)}
          </button>
        ))}
      </div>

      {/* Ações */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !sub.product.active}
          onClick={() =>
            run(() => refillNow(sub.id), "Item na sacola! Ciclo reiniciado.", () =>
              router.push("/sacola")
            )
          }
          className="press inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <ShoppingBag className="size-3.5" /> Repor agora
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            paused
              ? run(() => resumeSubscription(sub.id), "Assinatura retomada.")
              : run(() => pauseSubscription(sub.id), "Assinatura pausada.")
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-xs font-semibold transition hover:bg-muted disabled:opacity-60"
        >
          {paused ? (
            <>
              <Play className="size-3.5" /> Retomar
            </>
          ) : (
            <>
              <Pause className="size-3.5" /> Pausar
            </>
          )}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Cancelar esta assinatura de reposição?")) {
              run(() => cancelSubscription(sub.id), "Assinatura cancelada.");
            }
          }}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-60"
        >
          <Trash2 className="size-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}
