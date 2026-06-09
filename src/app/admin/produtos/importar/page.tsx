import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductImport } from "@/components/admin/product-import";

export default function AdminImportProductsPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin/produtos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para produtos
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold">Importar catálogo</h1>
        <p className="text-sm text-muted-foreground">
          Envie um arquivo CSV para criar ou atualizar produtos em lote. Produtos
          com SKU já existente são atualizados; os demais são criados.
        </p>
      </div>

      <ProductImport />
    </div>
  );
}
