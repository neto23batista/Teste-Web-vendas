"use client";

import * as React from "react";
import { useActionState } from "react";
import { Star, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitReview, type ReviewState } from "@/actions/reviews";
import { cn } from "@/lib/utils";

export function ReviewForm({
  productId,
  slug,
  existing,
}: {
  productId: string;
  slug: string;
  existing?: { rating: number; comment: string | null } | null;
}) {
  const action = submitReview.bind(null, productId, slug);
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(
    action,
    undefined
  );
  const [rating, setRating] = React.useState(existing?.rating ?? 0);
  const [hover, setHover] = React.useState(0);
  const shown = hover || rating;

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-border bg-card p-5"
    >
      <h3 className="font-bold">
        {existing ? "Editar sua avaliação" : "Avaliar este produto"}
      </h3>

      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-2.5 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="flex items-center gap-2 rounded-xl bg-success-500/10 px-4 py-2.5 text-sm font-medium text-success-600">
          <CheckCircle2 className="size-4 shrink-0" /> Avaliação enviada. Obrigado!
        </div>
      )}

      <input type="hidden" name="rating" value={rating} />
      <div
        className="flex gap-0.5"
        role="radiogroup"
        aria-label="Nota de 1 a 5 estrelas"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            aria-pressed={rating === n}
            className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <Star
              className={cn(
                "size-7 transition-transform hover:scale-110",
                shown >= n
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-slate-300 dark:text-slate-600"
              )}
            />
          </button>
        ))}
      </div>

      <textarea
        name="comment"
        rows={3}
        maxLength={1000}
        defaultValue={existing?.comment ?? ""}
        placeholder="Conte como foi sua experiência (opcional)"
        className="w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
      />

      <Button type="submit" variant="primary" disabled={pending || rating === 0}>
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <CheckCircle2 className="size-5" />
        )}
        {existing ? "Atualizar avaliação" : "Enviar avaliação"}
      </Button>
    </form>
  );
}
