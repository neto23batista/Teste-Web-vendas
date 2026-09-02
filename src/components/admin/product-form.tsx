"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import type { ProductFormState } from "@/lib/catalog/product-form";

type Option = { id: string; name: string };
type Product = {
  name: string;
  emoji: string | null;
  sku: string | null;
  ean: string | null;
  price: number;
  promoPrice: number | null;
  costPrice: number | null;
  stock: number;
  minStock: number;
  categoryId: string;
  brandId: string | null;
  shortDescription: string | null;
  activeIngredient: string | null;
  description: string;
  isGeneric: boolean;
  featured: boolean;
  active: boolean;
  requiresPrescription?: boolean;
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
              hint="Uma URL HTTPS por linha (até 8), somente images.unsplash.com ou images.pexels.com. A primeira é a principal."
            >
              <textarea
                id="imageUrls"
                name="imageUrls"
                rows={3}
                defaultValue={(p?.images ?? []).map((i) => i.url).join("\n")}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
              />
            </Field>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold">Preço e estoque</h2>
            <p className="text-xs text-muted-foreground">
              Estes dados definem a oferta da <strong>matriz</strong>. As filiais podem
              manter preço, identificadores e estoque próprios em Controle de estoque.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preço (R$)" htmlFor="price">
                <Input id="price" name="price" inputMode="decimal" defaultValue={p?.price} required />
              </Field>
              <Field label="Preço promocional (R$)" htmlFor="promoPrice">
                <Input id="promoPrice" name="promoPrice" inputMode="decimal" defaultValue={p?.promoPrice ?? ""} />
              </Field>
              <Field
                label="Custo de aquisição (R$)"
                htmlFor="costPrice"
                hint="Base do CMV e da margem no Financeiro. Não aparece para o cliente."
              >
                <Input id="costPrice" name="costPrice" inputMode="decimal" defaultValue={p?.costPrice ?? ""} />
              </Field>
              <Field
                label={p ? "Estoque atual (matriz)" : "Estoque inicial (matriz)"}
                htmlFor="stock"
                hint={p ? "Para movimentar o saldo, use Controle de estoque ou os lotes em Compras." : "O saldo inicial será registrado no histórico de movimentos."}
              >
                <Input id="stock" name={p ? undefined : "stock"} inputMode="numeric" defaultValue={p?.stock ?? 0} readOnly={Boolean(p)} />
              </Field>
              <Field label="Estoque mínimo" htmlFor="minStock">
                <Input id="minStock" name="minStock" inputMode="numeric" defaultValue={p?.minStock ?? 5} />
              </Field>
              <Field label="SKU" htmlFor="sku">
                <Input id="sku" name="sku" defaultValue={p?.sku ?? ""} />
              </Field>
              <Field label="EAN" htmlFor="ean">
                <Input id="ean" name="ean" inputMode="numeric" defaultValue={p?.ean ?? ""} />
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
            {p?.requiresPrescription && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Produto sujeito a prescrição: permanece inativo e não pode ser
                vendido ou assinado neste canal.
              </div>
            )}
            {[
              ["active", "Ativo na loja", p ? p.active : true],
              ["featured", "Destaque", p?.featured ?? false],
              ["isGeneric", "Genérico", p?.isGeneric ?? false],
            ].map(([name, label, checked]) => (
              <label key={name as string} className="flex items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  name={name as string}
                  defaultChecked={checked as boolean}
                  disabled={name === "active" && p?.requiresPrescription === true}
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
