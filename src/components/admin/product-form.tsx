"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import type { ProductFormState } from "@/actions/admin-products";

type Option = { id: string; name: string };
type Product = {
  name: string;
  emoji: string | null;
  sku: string | null;
  price: number;
  promoPrice: number | null;
  stock: number;
  minStock: number;
  categoryId: string;
  brandId: string | null;
  shortDescription: string | null;
  activeIngredient: string | null;
  description: string;
  requiresPrescription: boolean;
  isGeneric: boolean;
  featured: boolean;
  active: boolean;
  images?: { url: string }[];
};

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20";

export function ProductForm({
  action,
  categories,
  brands,
  product,
  submitLabel = "Salvar produto",
}: {
  action: (prev: ProductFormState, fd: FormData) => Promise<ProductFormState>;
  categories: Option[];
  brands: Option[];
  product?: Product;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const p = product;

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold">Informações</h2>
            <Field label="Nome do produto" htmlFor="name">
              <Input id="name" name="name" defaultValue={p?.name} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
              <Field label="Descrição curta" htmlFor="shortDescription">
                <Input id="shortDescription" name="shortDescription" defaultValue={p?.shortDescription ?? ""} />
              </Field>
              <Field label="Emoji" htmlFor="emoji">
                <Input id="emoji" name="emoji" defaultValue={p?.emoji ?? ""} placeholder="💊" />
              </Field>
            </div>
            <Field label="Princípio ativo" htmlFor="activeIngredient">
              <Input
                id="activeIngredient"
                name="activeIngredient"
                defaultValue={p?.activeIngredient ?? ""}
                placeholder="Ex.: Dipirona sódica"
              />
            </Field>
            <Field label="Descrição completa" htmlFor="description">
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={p?.description}
                className="w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
              />
            </Field>
            <Field
              label="Imagens (URLs)"
              htmlFor="imageUrls"
              hint="Uma URL https por linha. A primeira é a imagem principal. Sem imagem, mostramos o emoji."
            >
              <textarea
                id="imageUrls"
                name="imageUrls"
                rows={3}
                defaultValue={(p?.images ?? []).map((i) => i.url).join("\n")}
                placeholder="https://exemplo.com/produto-1.jpg"
                className="w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
              />
            </Field>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold">Preço e estoque</h2>
            <p className="text-xs text-muted-foreground">
              Preço é compartilhado entre as unidades. O estoque abaixo é o da{" "}
              <strong>matriz</strong>; o das filiais é ajustado em Controle de estoque.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preço (R$)" htmlFor="price">
                <Input id="price" name="price" inputMode="decimal" defaultValue={p?.price} required />
              </Field>
              <Field label="Preço promocional (R$)" htmlFor="promoPrice">
                <Input id="promoPrice" name="promoPrice" inputMode="decimal" defaultValue={p?.promoPrice ?? ""} />
              </Field>
              <Field label="Estoque (matriz)" htmlFor="stock">
                <Input id="stock" name="stock" inputMode="numeric" defaultValue={p?.stock ?? 0} />
              </Field>
              <Field label="Estoque mínimo" htmlFor="minStock">
                <Input id="minStock" name="minStock" inputMode="numeric" defaultValue={p?.minStock ?? 5} />
              </Field>
              <Field label="SKU / EAN" htmlFor="sku">
                <Input id="sku" name="sku" defaultValue={p?.sku ?? ""} />
              </Field>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold">Organização</h2>
            <Field label="Categoria" htmlFor="categoryId">
              <select id="categoryId" name="categoryId" defaultValue={p?.categoryId ?? ""} className={inputCls} required>
                <option value="" disabled>
                  Selecione…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marca" htmlFor="brandId">
              <select id="brandId" name="brandId" defaultValue={p?.brandId ?? ""} className={inputCls}>
                <option value="">Sem marca</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold">Atributos</h2>
            {[
              ["active", "Ativo na loja", p ? p.active : true],
              ["featured", "Destaque", p?.featured ?? false],
              ["isGeneric", "Genérico", p?.isGeneric ?? false],
              ["requiresPrescription", "Exige receita", p?.requiresPrescription ?? false],
            ].map(([name, label, checked]) => (
              <label key={name as string} className="flex items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  name={name as string}
                  defaultChecked={checked as boolean}
                  className="size-4 rounded border-border accent-brand-600"
                />
                {label as string}
              </label>
            ))}
          </section>

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
