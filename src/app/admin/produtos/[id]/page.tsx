import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminProductEditorView } from "@/server/queries/admin/catalog";
import { updateProduct } from "@/actions/admin/products";
import { ProductForm } from "@/components/admin/product-form";

export const metadata = { title: "Editar produto" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getAdminProductEditorView(id);
  if (!view) notFound();
  const { product, categories, brands } = view;
  const action = updateProduct.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/produtos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold">Editar produto</h1>
        <p className="text-sm text-muted-foreground">{product.name}</p>
      </div>
      <ProductForm
        action={action}
        categories={categories}
        brands={brands}
        product={product}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
