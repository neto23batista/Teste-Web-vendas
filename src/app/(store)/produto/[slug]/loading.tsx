import { Skeleton, ProductCardSkeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <div className="container-page space-y-12 py-6 md:py-8">
      <Skeleton className="h-4 w-64" />

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <Skeleton className="aspect-square w-full rounded-3xl" />

        <div className="space-y-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-40" />
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="no-scrollbar flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[210px] shrink-0 md:w-[240px]">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
