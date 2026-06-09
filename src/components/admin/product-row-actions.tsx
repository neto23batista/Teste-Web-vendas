"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleProductActive, deleteProduct } from "@/actions/admin-products";

export function ProductRowActions({
  id,
  active,
  name,
}: {
  id: string;
  active: boolean;
  name: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const toggle = () =>
    start(async () => {
      await toggleProductActive(id);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
      await deleteProduct(id);
      toast.success("Produto excluído");
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
          <Eye className="size-4" />
        ) : (
          <EyeOff className="size-4" />
        )}
      </button>
      <Link
        href={`/admin/produtos/${id}`}
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
