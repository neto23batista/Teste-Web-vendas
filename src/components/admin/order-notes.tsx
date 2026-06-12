"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { saveOrderNotes } from "@/actions/admin-orders";
import { Button } from "@/components/ui/button";

export function OrderNotes({
  orderId,
  initialNotes,
}: {
  orderId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveOrderNotes(orderId, notes);
      if (res.ok) toast.success("Observações salvas.");
      else toast.error(res.error ?? "Não foi possível salvar.");
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm print:hidden">
      <p className="flex items-center gap-2 font-bold">
        <StickyNote className="size-4 text-brand-600 dark:text-brand-400" />{" "}
        Observações
      </p>
      <p className="text-xs text-muted-foreground">
        Recado do cliente no checkout + anotações internas da equipe.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        maxLength={1000}
        placeholder="Sem observações."
        className="w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
      />
      <Button size="sm" variant="soft" onClick={save} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        Salvar observações
      </Button>
    </div>
  );
}
