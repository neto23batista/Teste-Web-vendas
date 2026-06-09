import { Skeleton } from "@/components/ui/skeleton";

/* Fallback de navegação neutro para rotas da loja sem loading próprio
   (home, sacola, conta, etc.). Mostra estrutura na hora enquanto o
   servidor responde — a navegação nunca fica "parada". */
export default function StoreLoading() {
  return (
    <div className="container-page space-y-6 py-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72" />
      <div className="space-y-4 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
