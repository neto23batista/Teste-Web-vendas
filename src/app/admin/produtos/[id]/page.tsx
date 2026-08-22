import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCategoriesAndBrands } from "@/lib/admin";
import { updateProduct } from "@/actions/admin-products";
import { ProductForm } from "@/components/admin/product-form";
import { moneyToNumber } from "@/lib/money";

export const metadata = { title: "Editar produto" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sort: "asc" }, select: { url: true } } },
  });
  if (!product) notFound();

  // O campo de estoque do formulário reflete a MATRIZ (filiais em Controle de
  // estoque). Busca o Inventory da matriz para preencher o valor atual.
  const matrizInv = await prisma.inventory.findFirst({
    where: { productId: id, pharmacy: { type: "MATRIZ" } },
    select: { stock: true, minStock: true },
  });

  const [categories, brands] = await getCategoriesAndBrands();
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
        product={{
          ...product,
          price: moneyToNumber(product.price),
          promoPrice:
            product.promoPrice == null ? null : moneyToNumber(product.promoPrice),
          costPrice:
            product.costPrice == null ? null : moneyToNumber(product.costPrice),
          stock: matrizInv?.stock ?? 0,
          minStock: matrizInv?.minStock ?? 5,
        }}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
