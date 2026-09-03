"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAuditInTransaction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { InventoryLotBalanceError } from "@/lib/inventory/lots";
import { reportError } from "@/lib/monitoring";
import { slugify } from "@/lib/utils";
import { PRESCRIPTION_PRODUCT_UNAVAILABLE } from "@/lib/catalog/policy";
import { centsToDecimal } from "@/lib/money";
import {
  type ProductFormState,
  parseProductForm,
  validateProductForm,
  unitOfferFromForm,
} from "@/lib/catalog/product-form";
import {
  isCatalogAdmin,
  ensureInventoryForAllUnits,
  syncMatrizOffer,
  revalidateProducts,
} from "@/lib/catalog/admin-support";

async function uniqueSlug(
  tx: Prisma.TransactionClient,
  base: string,
  ignoreId?: string,
): Promise<string> {
  let slug = slugify(base) || "produto";
  let i = 1;
  while (true) {
    const found = await tx.product.findUnique({ where: { slug } });
    if (!found || found.id === ignoreId) return slug;
    slug = `${slugify(base)}-${i++}`;
  }
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  if (!(await isCatalogAdmin())) {
    return { error: "Apenas a matriz gerencia o catálogo de produtos." };
  }
  const d = parseProductForm(formData);
  const valid = validateProductForm(d);
  if (!valid.ok) return { error: valid.error };

  const actor = await requireAdmin();
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: d.name,
          slug: await uniqueSlug(tx, d.name),
          description: d.description || d.name,
          shortDescription: d.shortDescription,
          activeIngredient: d.activeIngredient,
          emoji: d.emoji,
          sku: d.sku,
          ean: d.ean,
          price: centsToDecimal(d.priceCents!),
          promoPrice:
            d.promoPriceCents == null
              ? null
              : centsToDecimal(d.promoPriceCents),
          costPrice:
            d.costPriceCents == null ? null : centsToDecimal(d.costPriceCents),
          categoryId: d.categoryId,
          brandId: d.brandId,
          isGeneric: d.isGeneric,
          featured: d.featured,
          active: d.active,
          images: {
            create: valid.imageUrls.map((url, i) => ({ url, sort: i })),
          },
        },
      });
      // Cria estoque por unidade: matriz com o informado, filiais zeradas.
      const offer = unitOfferFromForm(d);
      await ensureInventoryForAllUnits(tx, product.id, d.minStock, offer);
      await syncMatrizOffer(tx, product.id, d.minStock, offer, actor, d.stock);

      await logAuditInTransaction(tx, {
        action: "product.create",
        entity: "Product",
        entityId: product.id,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
        detail: `Criou o produto "${product.name}"`,
      });
    });
  } catch (error) {
    if (error instanceof InventoryLotBalanceError)
      return { error: error.message };
    reportError(error, { operation: "catalog.create" });
    return {
      error:
        "Não foi possível salvar o produto. Atualize a página e tente novamente.",
    };
  }
  revalidateProducts();
  redirect("/admin/produtos");
}

export async function updateProduct(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  if (!(await isCatalogAdmin())) {
    return { error: "Apenas a matriz gerencia o catálogo de produtos." };
  }
  const d = parseProductForm(formData);
  const valid = validateProductForm(d);
  if (!valid.ok) return { error: valid.error };

  const current = await prisma.product.findUnique({
    where: { id },
    select: { requiresPrescription: true },
  });
  if (!current) return { error: "Produto não encontrado." };

  const actor = await requireAdmin();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id, requiresPrescription: current.requiresPrescription },
        data: {
          name: d.name,
          slug: await uniqueSlug(tx, d.name, id),
          description: d.description || d.name,
          shortDescription: d.shortDescription,
          activeIngredient: d.activeIngredient,
          emoji: d.emoji,
          sku: d.sku,
          ean: d.ean,
          price: centsToDecimal(d.priceCents!),
          promoPrice:
            d.promoPriceCents == null
              ? null
              : centsToDecimal(d.promoPriceCents),
          costPrice:
            d.costPriceCents == null ? null : centsToDecimal(d.costPriceCents),
          categoryId: d.categoryId,
          brandId: d.brandId,
          isGeneric: d.isGeneric,
          featured: d.featured,
          // Mesmo uma chamada direta da Server Action não consegue republicar um
          // item classificado como sujeito a prescrição.
          active: current.requiresPrescription ? false : d.active,
          // Substitui o conjunto de imagens pelo informado no formulário.
          images: {
            deleteMany: {},
            create: valid.imageUrls.map((url, i) => ({ url, sort: i })),
          },
        },
      });
      // Editar o catálogo não reaplica o saldo antigo do formulário. O estoque é
      // alterado exclusivamente pelos fluxos dedicados de movimentação/contagem.
      const offer = unitOfferFromForm(d);
      await ensureInventoryForAllUnits(tx, id, d.minStock, offer);
      await syncMatrizOffer(tx, id, d.minStock, offer, actor);

      await logAuditInTransaction(tx, {
        action: "product.update",
        entity: "Product",
        entityId: id,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
        detail: `Editou o produto "${d.name}"`,
      });
    });
  } catch (error) {
    if (error instanceof InventoryLotBalanceError)
      return { error: error.message };
    reportError(error, { operation: "catalog.update" });
    return {
      error:
        "Não foi possível salvar o produto. Atualize a página e tente novamente.",
    };
  }
  revalidateProducts();
  redirect("/admin/produtos");
}

export async function toggleProductActive(id: string) {
  if (!(await isCatalogAdmin())) return { ok: false, error: "Acesso negado." };
  const actor = await requireAdmin();
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true, active: true, requiresPrescription: true },
  });
  if (product) {
    if (!product.active && product.requiresPrescription) {
      return { ok: false, error: PRESCRIPTION_PRODUCT_UNAVAILABLE };
    }
    // Mutação e evidência na mesma transação: uma falha ao gravar a auditoria
    // desfaz a mudança, em vez de deixar o produto alterado sem registro e a
    // interface mostrando erro (que convida o operador a repetir a ação).
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { active: !product.active },
      });
      await logAuditInTransaction(tx, {
        action: "product.toggle",
        entity: "Product",
        entityId: id,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
        detail: `${product.active ? "Desativou" : "Ativou"} o produto "${product.name}"`,
      });
    });
    revalidateProducts();
  }
  return product
    ? { ok: true }
    : { ok: false, error: "Produto não encontrado." };
}

export async function deleteProduct(id: string) {
  if (!(await isCatalogAdmin())) return { ok: false };
  const actor = await requireAdmin();
  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true },
  });
  // Só registra na auditoria (e reporta sucesso) se o delete de fato ocorreu —
  // e o registro vai na mesma transação, para que a exclusão nunca sobreviva
  // sem evidência de quem a fez.
  const deleted = await prisma
    .$transaction(async (tx) => {
      await tx.product.delete({ where: { id } });
      await logAuditInTransaction(tx, {
        action: "product.delete",
        entity: "Product",
        entityId: id,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
        detail: `Excluiu o produto "${product?.name ?? id}"`,
      });
      return true;
    })
    .catch(() => false);
  if (deleted) revalidateProducts();
  return { ok: deleted };
}
