"use client";

import { Check, X, Loader2 } from "lucide-react";
import { approveReview, rejectReview } from "@/client/api/admin";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { Button } from "@/components/ui/button";

export function ReviewModeration({
  id,
  approved,
}: {
  id: string;
  approved: boolean;
}) {
  const { pending, run, confirm, dialog } = useConfirmAction();

  function approve() {
    void run({
      action: () => approveReview(id),
      successMessage: "Avaliação aprovada.",
    });
  }

  function reject() {
    confirm({
      title: "Remover avaliação",
      confirmLabel: "Remover avaliação",
      destructive: true,
      confirmMessage: "Esta avaliação será removida e deixará de aparecer na loja. O cliente poderá enviar uma nova avaliação.",
      action: () => rejectReview(id),
      successMessage: "Avaliação removida.",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dialog}
      {!approved && (
        <Button size="sm" variant="success" disabled={pending} onClick={approve}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Aprovar
        </Button>
      )}
      <Button size="sm" variant="danger" disabled={pending} onClick={reject}>
        <X className="size-4" /> {approved ? "Remover" : "Recusar"}
      </Button>
    </div>
  );
}
