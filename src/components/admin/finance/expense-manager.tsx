"use client";

import * as React from "react";
import { Loader2, Plus, Trash2, Receipt } from "lucide-react";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import type { ExpenseCategory } from "@/contracts/domain";
import { createExpense, deleteExpense } from "@/client/api/admin";
import { EXPENSE_LABEL } from "@/lib/admin/management";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

const CATEGORIES = Object.keys(EXPENSE_LABEL) as ExpenseCategory[];

export type ExpenseRow = {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  paidAt: string;
  pharmacyName: string | null;
};

export function ExpenseManager({
  expenses,
  pharmacies,
}: {
  expenses: ExpenseRow[];
  pharmacies: { id: string; name: string }[];
}) {
  const { pending, run, confirm, dialog } = useConfirmAction();
  const formRef = React.useRef<HTMLFormElement>(null);

  function onCreate(fd: FormData) {
    void run({
      action: () => createExpense(fd),
      successMessage: "Despesa lançada.",
      onSuccess: () => formRef.current?.reset(),
    });
  }

  function onDelete(id: string, description: string) {
    confirm({
      title: "Remover lançamento de despesa",
      confirmLabel: "Remover despesa",
      destructive: true,
      confirmMessage: `Remover “${description}”? O lançamento deixará de compor os totais financeiros. Esta ação não desfaz uma transferência bancária já realizada.`,
      action: () => deleteExpense(id),
      successMessage: "Despesa removida.",
    });
  }

  const selectCls =
    "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400";

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      {dialog}
      <h2 className="flex items-center gap-2 font-bold">
        <Receipt className="size-5 text-brand-600 dark:text-brand-400" /> Despesas do mês
      </h2>

      <form ref={formRef} onSubmit={(event) => { event.preventDefault(); onCreate(new FormData(event.currentTarget)); }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-busy={pending}>
        <Field label="Descrição" htmlFor="description">
          <Input id="description" name="description" placeholder="Aluguel da loja" required />
        </Field>
        <Field label="Valor (R$)" htmlFor="amount">
          <Input id="amount" name="amount" inputMode="decimal" placeholder="1.500,00" required />
        </Field>
        <Field label="Categoria" htmlFor="category">
          <select id="category" name="category" defaultValue="OTHER" className={selectCls}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data" htmlFor="paidAt">
          <Input
            id="paidAt"
            name="paidAt"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </Field>
        <Field label="Unidade" htmlFor="pharmacyId">
          <select id="pharmacyId" name="pharmacyId" className={selectCls}>
            <option value="">— geral —</option>
            {pharmacies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2 lg:col-span-5">
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Lançar despesa
          </Button>
        </div>
      </form>

      <div className="divide-y divide-border">
        {expenses.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma despesa lançada neste mês.
          </p>
        )}
        {expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{e.description}</p>
              <p className="text-xs text-muted-foreground">
                {EXPENSE_LABEL[e.category]} · {e.paidAt}
                {e.pharmacyName ? ` · ${e.pharmacyName}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-bold tabular-nums">{formatBRL(e.amount)}</span>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Remover despesa ${e.description}`}
                disabled={pending}
                onClick={() => onDelete(e.id, e.description)}
              >
                <Trash2 className="size-4 text-danger-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
