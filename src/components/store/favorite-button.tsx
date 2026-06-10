"use client";

import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useFavorites } from "@/lib/use-favorites";
import { cn } from "@/lib/utils";

/**
 * Botão de favoritar (coração). Em cards usa o modo ícone flutuante; nas páginas
 * de detalhe usa `withLabel` para virar um botão com texto.
 */
export function FavoriteButton({
  productId,
  name,
  withLabel = false,
  className,
}: {
  productId: string;
  name?: string;
  withLabel?: boolean;
  className?: string;
}) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(productId);

  function onClick(e: React.MouseEvent) {
    // Em cards o coração fica sobre um <Link> — evita navegar ao favoritar.
    e.preventDefault();
    e.stopPropagation();
    const nowFav = toggle(productId);
    toast.success(
      nowFav ? "Adicionado aos favoritos" : "Removido dos favoritos",
      name ? { description: name } : undefined
    );
  }

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={fav}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition active:scale-[0.97]",
          fav
            ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            : "border-border bg-card text-foreground hover:border-brand-300 hover:bg-muted",
          className
        )}
      >
        <Heart className={cn("size-[1.15em]", fav && "fill-current")} />
        {fav ? "Salvo nos favoritos" : "Salvar nos favoritos"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={fav}
      aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={cn(
        "grid size-9 place-items-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-[var(--shadow-soft)] backdrop-blur transition hover:scale-110 hover:text-rose-500 active:scale-95",
        fav && "text-rose-500",
        className
      )}
    >
      <Heart className={cn("size-4.5 transition", fav && "fill-current")} />
    </button>
  );
}
