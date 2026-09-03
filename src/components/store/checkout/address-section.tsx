"use client";

import { Plus } from "lucide-react";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CheckoutAddress } from "./types";

export function CheckoutAddressSection({
  addresses,
  addressId,
  setAddressId,
  isNew,
  newZip,
  setNewZip,
  cepLoading,
  handleCepBlur,
}: {
  addresses: CheckoutAddress[];
  addressId: string;
  setAddressId: (id: string) => void;
  isNew: boolean;
  newZip: string;
  setNewZip: (zip: string) => void;
  cepLoading: boolean;
  handleCepBlur: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">

      <div className="space-y-2">
        {addresses.map((a) => (
          <label
            key={a.id}
            className={cn(
              "flex cursor-pointer focus-within:ring-2 focus-within:ring-brand-500 gap-3 rounded-xl border p-3 transition",
              addressId === a.id
                ? "border-brand-600 bg-brand-50 dark:bg-brand-600/10"
                : "border-border hover:border-brand-300",
            )}
          >
            <input
              type="radio"
              name="addressId"
              value={a.id}
              checked={addressId === a.id}
              onChange={() => setAddressId(a.id)}
              className="mt-1 size-5 shrink-0 accent-brand-600"
            />
            <div className="text-sm">
              <p className="font-semibold">
                {a.label} · {a.recipient}
              </p>
              <p className="text-muted-foreground">
                {a.street}, {a.number}
                {a.complement ? ` - ${a.complement}` : ""} · {a.district},{" "}
                {a.city}/{a.state} · {a.zip}
              </p>
              {!a.covered && (
                <p className="mt-1 font-semibold text-danger-500">
                  Fora da área de entrega desta unidade
                </p>
              )}
            </div>
          </label>
        ))}

        <label
          className={cn(
            "flex cursor-pointer focus-within:ring-2 focus-within:ring-brand-500 items-center gap-3 rounded-xl border p-3 transition",
            isNew
              ? "border-brand-600 bg-brand-50 dark:bg-brand-600/10"
              : "border-border hover:border-brand-300",
          )}
        >
          <input
            type="radio"
            name="addressId"
            value="new"
            checked={isNew}
            onChange={() => setAddressId("new")}
            className="size-4 accent-brand-600"
          />
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Plus className="size-4" /> Usar um novo endereço
          </span>
        </label>
      </div>

      {isNew && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Destinatário" htmlFor="recipient">
            <Input
              id="recipient"
              name="recipient"
              placeholder="Nome de quem recebe"
              required autoComplete="shipping name"
            />
          </Field>
          <Field
            label="CEP"
            htmlFor="zip"
            hint={
              cepLoading
                ? "Buscando endereço…"
                : "Preenche o endereço automaticamente"
            }
          >
            <Input
              id="zip"
              name="zip"
              placeholder="00000-000"
              inputMode="numeric"
              required autoComplete="shipping postal-code" pattern="[0-9]{5}-?[0-9]{3}"
              value={newZip}
              onChange={(e) => setNewZip(e.target.value)}
              onBlur={handleCepBlur}
            />
          </Field>
          <Field label="Rua" htmlFor="street">
            <Input id="street" name="street" placeholder="Av. Paulista" required autoComplete="shipping address-line1" />
          </Field>
          <Field label="Número" htmlFor="number">
            <Input id="number" name="number" placeholder="1000 ou S/N" required />
          </Field>
          <Field label="Complemento" htmlFor="complement">
            <Input
              id="complement"
              name="complement"
              placeholder="Apto 12 (opcional)"
              autoComplete="shipping address-line2"
            />
          </Field>
          <Field label="Bairro" htmlFor="district">
            <Input id="district" name="district" placeholder="Centro" required />
          </Field>
          <Field label="Cidade" htmlFor="city">
            <Input id="city" name="city" placeholder="São Paulo" required autoComplete="shipping address-level2" />
          </Field>
          <Field label="Estado (UF)" htmlFor="state">
            <Input id="state" name="state" placeholder="SP" maxLength={2} required pattern="[a-zA-Z]{2}" autoComplete="shipping address-level1" />
          </Field>
        </div>
      )}
    </div>
  );
}
