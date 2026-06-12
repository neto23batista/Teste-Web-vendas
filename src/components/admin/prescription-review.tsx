"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setPrescriptionStatus } from "@/actions/admin-prescriptions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PrescriptionStatus } from "@prisma/client";

const badge: Record<PrescriptionStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Em análise",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
  APPROVED: {
    label: "Aprovada",
    className: "bg-success-500/10 text-success-600",
  },
  REJECTED: {
    label: "Recusada",
    className: "bg-danger-500/10 text-danger-500",
  },
};

export function PrescriptionReview({
  id,
  status,
}: {
  id: string;
  status: PrescriptionStatus;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function set(next: PrescriptionStatus) {
    // Na recusa, o motivo segue no e-mail ao cliente (cancelar aborta a ação).
    let reason: string | undefined;
    if (next === "REJECTED") {
      const input = window.prompt(
        "Motivo da recusa (enviado ao cliente por e-mail):",
        ""
      );
      if (input === null) return;
      reason = input.trim() || undefined;
    }
    start(async () => {
      const res = await setPrescriptionStatus(id, next, reason);
      if (res.ok) {
        toast.success(next === "APPROVED" ? "Receita aprovada" : "Receita recusada");
        router.refresh();
      } else {
        toast.error("Não foi possível atualizar a receita.");
      }
    });
  }

  const b = badge[status];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
          b.className
        )}
      >
        {b.label}
      </span>
      {status !== "APPROVED" && (
        <Button
          size="sm"
          variant="success"
          disabled={pending}
          onClick={() => set("APPROVED")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Aprovar
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => set("REJECTED")}
        >
          <X className="size-4" /> Recusar
        </Button>
      )}
    </div>
  );
}
