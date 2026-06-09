import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCategoriesAndBrands } from "@/lib/admin";
import { createProduct } from "@/actions/admin-products";
import { ProductForm } from "@/components/admin/product-form";

export const metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const [categories, brands] = await getCategoriesAndBrands();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/produtos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold">Novo produto</h1>
      </div>
      <ProductForm
        action={createProduct}
        categories={categories}
        brands={brands}
        submitLabel="Criar produto"
      />
    </div>
  );
}
