"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Power, PowerOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleCoupon, deleteCoupon } from "@/actions/admin-coupons";

export function CouponRowActions({
  id,
  active,
  code,
}: {
  id: string;
  active: boolean;
  code: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const toggle = () =>
    start(async () => {
      await toggleCoupon(id);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!confirm(`Excluir o cupom "${code}"?`)) return;
      const res = await deleteCoupon(id);
      if (res.ok) toast.success("Cupom excluído");
      else toast.error("Não foi possível excluir o cupom. Tente novamente.");
      router.refresh();
    });

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={toggle}
        disabled={pending}
        title={active ? "Desativar" : "Ativar"}
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : active ? (
          <Power className="size-4" />
        ) : (
          <PowerOff className="size-4" />
        )}
      </button>
      <Link
        href={`/admin/cupons/${id}`}
        title="Editar"
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-brand-600"
      >
        <Pencil className="size-4" />
      </Link>
      <button
        onClick={remove}
        disabled={pending}
        title="Excluir"
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
