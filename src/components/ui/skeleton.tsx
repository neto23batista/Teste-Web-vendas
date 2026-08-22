import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "shimmer rounded-xl bg-muted",
        className
      )}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando produto"
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <span className="sr-only">Carregando produto…</span>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
