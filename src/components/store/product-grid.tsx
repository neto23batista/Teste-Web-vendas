import { ProductCard } from "@/components/store/product-card";
import { RevealGroup, RevealItem } from "@/components/motion/motion";
import type { ProductCard as ProductCardData } from "@/lib/products";

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <RevealGroup className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <RevealItem key={p.id} className="h-full">
          <ProductCard product={p} />
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
