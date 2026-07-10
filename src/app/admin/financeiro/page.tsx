import type { Metadata } from "next";
import Link from "next/link";
import { Wallet, ChevronLeft, ChevronRight, Landmark, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireArea } from "@/lib/session";
import { getFinanceReport } from "@/lib/admin-reports";
import { EXPENSE_LABEL } from "@/lib/management";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { formatBRL, cn } from "@/lib/utils";
import { ExpenseManager, type ExpenseRow } from "@/components/admin/expense-manager";
import { StatementImport } from "@/components/admin/statement-import";

export const metadata: Metadata = { title: "Financeiro" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const shiftMonth = (mes: string, delta: number) => {
  const [y, m] = mes.split("-").map(Number);
  return monthKey(new Date(y, (m - 1) + delta, 1));
};

const money = (raw: number, highlight = false) => {
  const v = raw === 0 ? 0 : raw; // normaliza -0 (senão sai "-R$ 0,00")
  return (
    <span
      className={cn(
        "font-bold tabular-nums",
        highlight && (v >= 0 ? "text-success-600" : "text-danger-500")
      )}
    >
      {formatBRL(v)}
    </span>
  );
};

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireArea("financeiro");
  const sp = await searchParams;
  const unit = one(sp.unit) || undefined;
  const mesRaw = one(sp.mes) ?? "";
  const mes = /^\d{4}-\d{2}$/.test(mesRaw) ? mesRaw : monthKey(new Date());

  const report = await getFinanceReport(mes, unit);
  const { dre, cashFlow, expensesByCategory, itemsWithoutCost, from, to } = report;

  const [expenses, bankTx, unmatchedTotal, pharmacies] = await Promise.all([
    prisma.expense.findMany({
      where: { paidAt: { gte: from, lt: to } },
      orderBy: { paidAt: "desc" },
      include: { pharmacy: { select: { name: true } } },
    }),
    prisma.bankTransaction.findMany({
      where: { date: { gte: from, lt: to } },
      orderBy: { date: "desc" },
      take: 100,
      include: { payment: { select: { order: { select: { number: true } } } } },
    }),
    prisma.bankTransaction.count({ where: { paymentId: null, amount: { gt: 0 } } }),
    listPharmaciesSafe(),
  ]);

  const expenseRows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    category: e.category,
    amount: e.amount,
    paidAt: e.paidAt.toLocaleDateString("pt-BR"),
    pharmacyName: e.pharmacy?.name ?? null,
  }));

  const monthLabel = from.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const mesHref = (m: string) =>
    `/admin/financeiro?mes=${m}${unit ? `&unit=${unit}` : ""}`;

  const dreLines: { label: string; value: number; strong?: boolean; sign?: string }[] = [
    { label: "Receita bruta (pedidos pagos)", value: dre.grossRevenue },
    { label: "Descontos (cupons)", value: -dre.discounts, sign: "(-)" },
    { label: "Receita líquida", value: dre.netRevenue, strong: true },
    { label: "CMV — custo das mercadorias", value: -dre.cogs, sign: "(-)" },
    { label: "Lucro bruto", value: dre.grossProfit, strong: true },
    { label: "Despesas operacionais", value: -dre.expenses, sign: "(-)" },
  ];

  const conciliados = bankTx.filter((t) => t.paymentId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <Wallet className="size-6 text-brand-600 dark:text-brand-400" /> Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            DRE, fluxo de caixa e conciliação bancária do mês.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
          <Link
            href={mesHref(shiftMonth(mes, -1))}
            aria-label="Mês anterior"
            className="inline-grid size-8 place-items-center rounded-lg transition hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-bold capitalize">
            {monthLabel}
          </span>
          <Link
            href={mesHref(shiftMonth(mes, 1))}
            aria-label="Próximo mês"
            className="inline-grid size-8 place-items-center rounded-lg transition hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* DRE */}
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-bold">DRE gerencial</h2>
          <div className="divide-y divide-border text-sm">
            {dreLines.map((l) => (
              <div
                key={l.label}
                className={cn(
                  "flex items-center justify-between py-2.5",
                  l.strong && "font-semibold"
                )}
              >
                <span className={l.strong ? "" : "text-muted-foreground"}>
                  {l.sign ? `${l.sign} ` : ""}
                  {l.label}
                </span>
                {money(l.value)}
              </div>
            ))}
            <div className="flex items-center justify-between py-3 text-base">
              <span className="font-extrabold">Resultado do mês</span>
              {money(dre.result, true)}
            </div>
            {dre.margin !== null && (
              <p className="pt-2 text-xs text-muted-foreground">
                Margem líquida: {(dre.margin * 100).toFixed(1).replace(".", ",")}%
              </p>
            )}
          </div>
          {itemsWithoutCost > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {itemsWithoutCost} {itemsWithoutCost === 1 ? "item vendido" : "itens vendidos"} sem
              custo cadastrado — o CMV está subestimado. Preencha o custo de
              aquisição nos produtos.
            </p>
          )}
        </section>

        {/* DFC */}
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-bold">Fluxo de caixa (DFC)</h2>
          {cashFlow.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma movimentação neste mês.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Dia</th>
                    <th className="py-2 pr-3 text-right font-semibold">Entradas</th>
                    <th className="py-2 pr-3 text-right font-semibold">Saídas</th>
                    <th className="py-2 text-right font-semibold">Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cashFlow.map((r) => (
                    <tr key={r.date}>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {new Date(`${r.date}T12:00:00`).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-success-600">
                        {r.inflow > 0 ? formatBRL(r.inflow) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-danger-500">
                        {r.outflow > 0 ? formatBRL(r.outflow) : "—"}
                      </td>
                      <td
                        className={cn(
                          "py-2 text-right font-bold tabular-nums",
                          r.balance < 0 && "text-danger-500"
                        )}
                      >
                        {formatBRL(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {expensesByCategory.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Despesas por categoria
              </p>
              <div className="space-y-1.5 text-sm">
                {expensesByCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {EXPENSE_LABEL[c.category]}
                    </span>
                    <span className="font-semibold tabular-nums">{formatBRL(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <ExpenseManager
        expenses={expenseRows}
        pharmacies={pharmacies.map((p) => ({ id: p.id, name: p.name }))}
      />

      {/* Conciliação bancária */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold">
            <Landmark className="size-5 text-brand-600 dark:text-brand-400" /> Conciliação
            bancária
          </h2>
          <StatementImport />
        </div>
        <p className="text-xs text-muted-foreground">
          Importe o extrato do banco (OFX ou CSV). Cada crédito com mesmo valor e
          data próxima de um pagamento aprovado é conciliado automaticamente.
          {unmatchedTotal > 0 && (
            <strong className="text-amber-600 dark:text-amber-400">
              {" "}
              {unmatchedTotal} {unmatchedTotal === 1 ? "crédito aguarda" : "créditos aguardam"}{" "}
              conciliação.
            </strong>
          )}
        </p>

        <div className="divide-y divide-border">
          {bankTx.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum lançamento importado neste mês.
            </p>
          )}
          {bankTx.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {t.date.toLocaleDateString("pt-BR")}
                  {t.payment?.order ? ` · pedido ${t.payment.order.number}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    t.amount >= 0 ? "text-success-600" : "text-danger-500"
                  )}
                >
                  {formatBRL(t.amount)}
                </span>
                {t.amount > 0 && (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                      t.paymentId
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                    )}
                  >
                    {t.paymentId ? "Conciliado" : "Pendente"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {bankTx.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {conciliados} de {bankTx.length} lançamentos do mês conciliados.
          </p>
        )}
      </section>
    </div>
  );
}
