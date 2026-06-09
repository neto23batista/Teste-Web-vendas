"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { parseCsvRecords } from "@/lib/csv";

// Invalida o cache das listas de produto da home (tag "products").
function revalidateProducts() {
  revalidateTag("products", "max");
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

export type ProductFormState = { error?: string } | undefined;

function parse(formData: FormData) {
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").replace(",", ".").trim();
    return v === "" ? null : Number(v);
  };
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    shortDescription: String(formData.get("shortDescription") ?? "").trim() || null,
    activeIngredient: String(formData.get("activeIngredient") ?? "").trim() || null,
    emoji: String(formData.get("emoji") ?? "").trim() || null,
    sku: String(formData.get("sku") ?? "").trim() || null,
    price: num("price"),
    promoPrice: num("promoPrice"),
    stock: num("stock") ?? 0,
    minStock: num("minStock") ?? 5,
    categoryId: String(formData.get("categoryId") ?? ""),
    brandId: String(formData.get("brandId") ?? "") || null,
    imageUrls: String(formData.get("imageUrls") ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => /^https:\/\/.+/i.test(s))
      .slice(0, 8),
    requiresPrescription: formData.get("requiresPrescription") === "on",
    isGeneric: formData.get("isGeneric") === "on",
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  };
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  let slug = slugify(base) || "produto";
  let i = 1;
  while (true) {
    const found = await prisma.product.findUnique({ where: { slug } });
    if (!found || found.id === ignoreId) return slug;
    slug = `${slugify(base)}-${i++}`;
  }
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireAdmin();
  const d = parse(formData);
  if (!d.name || d.price === null || !d.categoryId) {
    return { error: "Nome, preço e categoria são obrigatórios." };
  }

  await prisma.product.create({
    data: {
      name: d.name,
      slug: await uniqueSlug(d.name),
      description: d.description || d.name,
      shortDescription: d.shortDescription,
      activeIngredient: d.activeIngredient,
      emoji: d.emoji,
      sku: d.sku,
      price: d.price,
      promoPrice: d.promoPrice,
      stock: d.stock,
      minStock: d.minStock,
      categoryId: d.categoryId,
      brandId: d.brandId,
      requiresPrescription: d.requiresPrescription,
      isGeneric: d.isGeneric,
      featured: d.featured,
      active: d.active,
      images: {
        create: d.imageUrls.map((url, i) => ({ url, sort: i })),
      },
    },
  });

  revalidateProducts();
  redirect("/admin/produtos");
}

export async function updateProduct(
  id: string,
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireAdmin();
  const d = parse(formData);
  if (!d.name || d.price === null || !d.categoryId) {
    return { error: "Nome, preço e categoria são obrigatórios." };
  }

  await prisma.product.update({
    where: { id },
    data: {
      name: d.name,
      slug: await uniqueSlug(d.name, id),
      description: d.description || d.name,
      shortDescription: d.shortDescription,
      activeIngredient: d.activeIngredient,
      emoji: d.emoji,
      sku: d.sku,
      price: d.price,
      promoPrice: d.promoPrice,
      stock: d.stock,
      minStock: d.minStock,
      categoryId: d.categoryId,
      brandId: d.brandId,
      requiresPrescription: d.requiresPrescription,
      isGeneric: d.isGeneric,
      featured: d.featured,
      active: d.active,
      // Substitui o conjunto de imagens pelo informado no formulário.
      images: {
        deleteMany: {},
        create: d.imageUrls.map((url, i) => ({ url, sort: i })),
      },
    },
  });

  revalidateProducts();
  redirect("/admin/produtos");
}

export async function toggleProductActive(id: string) {
  await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id } });
  if (product) {
    await prisma.product.update({ where: { id }, data: { active: !product.active } });
    revalidateProducts();
  }
  return { ok: true };
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  await prisma.product.delete({ where: { id } }).catch(() => {});
  revalidateProducts();
  return { ok: true };
}

// ─────────────────────── Importação de catálogo (CSV) ───────────────────────

export type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  errors: string[];
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const csvNum = (v: string): number | null => {
  const t = (v ?? "").replace(/\./g, "").replace(",", ".").trim();
  // Aceita "1.299,90" (pt-BR) e "1299.90". Remove separador de milhar só se
  // houver vírgula decimal; senão usa o ponto como decimal.
  const plain = (v ?? "").replace(",", ".").trim();
  const candidate = /,/.test(v ?? "") ? t : plain;
  if (candidate === "") return null;
  const n = Number(candidate);
  return Number.isFinite(n) ? n : null;
};

const csvBool = (v: string): boolean =>
  ["sim", "s", "true", "1", "x", "yes"].includes((v ?? "").trim().toLowerCase());

export async function importProducts(formData: FormData): Promise<ImportResult> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, created: 0, updated: 0, errors: ["Selecione um arquivo CSV."] };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, created: 0, updated: 0, errors: ["Arquivo muito grande (máx. 2 MB)."] };
  }

  const text = await file.text();
  const records = parseCsvRecords(text);
  if (records.length === 0) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      errors: ["CSV vazio ou sem linhas de dados (verifique o cabeçalho)."],
    };
  }

  // Pré-carrega categorias e marcas e indexa por nome e slug normalizados.
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.brand.findMany({ select: { id: true, name: true, slug: true } }),
  ]);
  const catMap = new Map<string, string>();
  for (const c of categories) {
    catMap.set(norm(c.name), c.id);
    catMap.set(norm(c.slug), c.id);
  }
  const brandMap = new Map<string, string>();
  for (const b of brands) {
    brandMap.set(norm(b.name), b.id);
    brandMap.set(norm(b.slug), b.id);
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const line = i + 2; // +1 pelo cabeçalho, +1 para base-1
    const name = (r.nome ?? "").trim();
    const sku = (r.sku ?? "").trim() || null;

    if (!name) {
      errors.push(`Linha ${line}: nome em branco — ignorada.`);
      continue;
    }
    const price = csvNum(r.preco ?? "");
    if (price === null) {
      errors.push(`Linha ${line} (${name}): preço inválido — ignorada.`);
      continue;
    }

    const catKey = norm(r.categoria ?? "");
    const categoryId = catKey ? catMap.get(catKey) : undefined;
    if (!categoryId) {
      errors.push(
        `Linha ${line} (${name}): categoria "${r.categoria ?? ""}" não encontrada — ignorada.`
      );
      continue;
    }

    let brandId: string | null = null;
    const brandKey = norm(r.marca ?? "");
    if (brandKey) {
      const found = brandMap.get(brandKey);
      if (!found) {
        errors.push(
          `Linha ${line} (${name}): marca "${r.marca}" não encontrada — ignorada.`
        );
        continue;
      }
      brandId = found;
    }

    const data = {
      name,
      description: (r.descricao ?? "").trim() || name,
      activeIngredient: (r.principio_ativo ?? "").trim() || null,
      ean: (r.ean ?? "").trim() || null,
      price,
      promoPrice: csvNum(r.promo ?? ""),
      stock: Math.max(0, Math.round(csvNum(r.estoque ?? "") ?? 0)),
      categoryId,
      brandId,
      requiresPrescription: csvBool(r.exige_receita ?? ""),
      isGeneric: csvBool(r.generico ?? ""),
    };

    try {
      const existing = sku
        ? await prisma.product.findUnique({ where: { sku } })
        : null;
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.product.create({
          data: { ...data, sku, slug: await uniqueSlug(name) },
        });
        created++;
      }
    } catch (err) {
      errors.push(`Linha ${line} (${name}): falha ao salvar (${String(err)}).`);
    }
  }

  if (created > 0 || updated > 0) revalidateProducts();

  return { ok: true, created, updated, errors };
}

export async function adjustStock(id: string, delta: number) {
  await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id } });
  if (product) {
    await prisma.product.update({
      where: { id },
      data: { stock: Math.max(0, product.stock + delta) },
    });
    revalidateProducts();
    revalidatePath("/admin/estoque");
  }
  return { ok: true };
}
