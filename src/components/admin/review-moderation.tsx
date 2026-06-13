"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { approveReview, rejectReview } from "@/actions/admin-reviews";
import { Button } from "@/components/ui/button";

export function ReviewModeration({
  id,
  approved,
}: {
  id: string;
  approved: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function approve() {
    start(async () => {
      const res = await approveReview(id);
      if (res.ok) {
        toast.success("Avaliação aprovada");
        router.refresh();
      } else {
        toast.error("Não foi possível aprovar.");
      }
    });
  }

  function reject() {
    if (!window.confirm("Excluir esta avaliação? O cliente poderá reenviar outra."))
      return;
    start(async () => {
      const res = await rejectReview(id);
      if (res.ok) {
        toast.success("Avaliação excluída");
        router.refresh();
      } else {
        toast.error("Não foi possível excluir.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
