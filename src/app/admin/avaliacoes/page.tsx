import Link from "next/link";
import { Star, Inbox } from "lucide-react";
import { getReviewsByApproval } from "@/lib/admin";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { StarRating } from "@/components/store/star-rating";
import { cn } from "@/lib/utils";

export const metadata = { title: "Avaliações" };

const tabs = [
  { approved: false, key: "pendentes", label: "Pendentes" },
  { approved: true, key: "aprovadas", label: "Aprovadas" },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const approved = sp.status === "aprovadas";
  const reviews = await getReviewsByApproval(approved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Avaliações</h1>
        <p className="text-sm text-muted-foreground">
          {approved
            ? `Histórico das ${reviews.length} aprovadas mais recentes`
            : `${reviews.length} ${reviews.length === 1 ? "avaliação aguarda" : "avaliações aguardam"} sua aprovação para aparecer na loja`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.approved ? "/admin/avaliacoes?status=aprovadas" : "/admin/avaliacoes"}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              approved === t.approved
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-border bg-card hover:border-brand-300"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <p className="font-semibold">
            {approved ? "Nenhuma avaliação aprovada ainda" : "Nenhuma avaliação pendente"}
          </p>
          <p className="text-sm text-muted-foreground">
            {approved
              ? "As avaliações que você aprovar aparecem aqui."
              : "Tudo moderado por aqui."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
                <Star className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{r.user.name}</p>
                  <StarRating rating={r.rating} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Produto:{" "}
                  <Link
                    href={`/produto/${r.product.slug}`}
                    target="_blank"
                    className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {r.product.name}
                  </Link>{" "}
                  · {new Date(r.createdAt).toLocaleString("pt-BR")}
                </p>
                {r.comment && (
                  <p className="text-sm text-muted-foreground">“{r.comment}”</p>
                )}
              </div>
              <ReviewModeration id={r.id} approved={r.approved} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
