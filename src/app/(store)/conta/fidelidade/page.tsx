import type { Metadata } from "next";
import { Gift, TrendingUp, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getLoyalty } from "@/lib/account";

export const metadata: Metadata = { title: "Fidelidade" };

export default async function LoyaltyPage() {
  const user = await requireUser();
  const loyalty = await getLoyalty(user.id);
  const points = loyalty?.points ?? 0;
  const txs = loyalty?.transactions ?? [];

  return (
    <div className="space-y-6">
      {/* Saldo */}
      <div className="relative overflow-hidden rounded-3xl gradient-brand p-8 text-white shadow-[var(--shadow-glow)]">
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/15 glass">
            <Gift className="size-7" />
          </span>
          <div>
            <p className="text-sm text-white/80">Seu saldo de pontos</p>
            <p className="text-4xl font-extrabold">{points.toLocaleString("pt-BR")}</p>
          </div>
        </div>
        <p className="relative mt-4 max-w-md text-sm text-white/85">
          Você ganha <strong>1 ponto a cada R$ 1</strong> em compras aprovadas.
          Acumule e troque por descontos exclusivos.
        </p>
      </div>

      {/* Extrato */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <TrendingUp className="size-5 text-brand-600 dark:text-brand-400" /> Extrato de pontos
        </h2>

        {txs.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
            <Sparkles className="size-8 text-muted-foreground" />
            <p className="font-semibold">Sem movimentações ainda</p>
            <p className="text-sm text-muted-foreground">
              Faça seu primeiro pedido para começar a acumular pontos.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-semibold">{t.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span
                  className={`text-sm font-extrabold ${
                    t.points >= 0 ? "text-success-600" : "text-danger-500"
                  }`}
                >
                  {t.points >= 0 ? "+" : ""}
                  {t.points} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
