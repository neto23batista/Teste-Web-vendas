import Link from "next/link";
import type { Metadata } from "next";
import { Repeat, BellRing } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getUserSubscriptions } from "@/lib/subscriptions";
import {
  SubscriptionCard,
  type SubscriptionCardData,
} from "@/components/account/subscription-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Minhas assinaturas" };

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const subs = await getUserSubscriptions(user.id);

  const cards: SubscriptionCardData[] = subs.map((s) => ({
    id: s.id,
    qty: s.qty,
    intervalDays: s.intervalDays,
    status: s.status,
    nextDueLabel: s.nextDueAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    }),
    product: {
      name: s.product.name,
      slug: s.product.slug,
      emoji: s.product.emoji,
      image: s.product.images[0]?.url ?? null,
      price: s.product.promoPrice ?? s.product.price,
      active: s.product.active,
    },
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Assinaturas de reposição</h2>
        <p className="text-sm text-muted-foreground">
          Seus itens de uso contínuo, repostos no ritmo certo.
        </p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-500/25 dark:bg-brand-600/10 dark:text-brand-200">
        <BellRing className="size-5 shrink-0" />
        <p>
          <strong>Sem cobrança automática.</strong> No dia da reposição a gente
          te avisa por e-mail e você confirma o pedido em 1 clique — pausando ou
          cancelando quando quiser.
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
            <Repeat className="size-7" />
          </span>
          <div>
            <p className="font-semibold">Nenhuma assinatura ainda</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Nas páginas de produto, ative “Assine a reposição” para itens que
              você usa todo mês — vitaminas, dermocosméticos, fraldas…
            </p>
          </div>
          <Button asChild variant="primary">
            <Link href="/catalogo">Explorar produtos</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {cards.map((sub) => (
            <SubscriptionCard key={sub.id} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}
