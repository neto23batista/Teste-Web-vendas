import { Skeleton, ProductCardSkeleton } from "@/components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <div className="container-page space-y-6 py-6 md:py-8">
      <Skeleton className="h-9 w-48" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
