"use client";

import { useActionState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  Truck,
  Store,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { saveSettings } from "@/actions/admin-settings";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import type { StoreSettings } from "@/lib/settings";

function money(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export type PaymentView = { hasToken: boolean; sandbox: boolean };

export function SettingsForm({
  settings,
  payment,
}: {
  settings: StoreSettings;
  payment: PaymentView;
}) {
  const [state, formAction, pending] = useActionState(saveSettings, undefined);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 rounded-xl bg-success-500/10 px-4 py-3 text-sm font-medium text-success-600">
          <CheckCircle2 className="size-4 shrink-0" /> Configurações salvas! A
          loja já reflete os novos valores.
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <Truck className="size-5 text-brand-600 dark:text-brand-400" /> Entrega
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Taxa base de entrega (R$)"
            htmlFor="shippingFlat"
            hint="Regiões mais distantes somam um adicional automático"
          >
            <Input
              id="shippingFlat"
              name="shippingFlat"
              inputMode="decimal"
              defaultValue={money(settings.shipping.flat)}
              placeholder="14,90"
            />
          </Field>
          <Field
            label="Frete grátis a partir de (R$)"
            htmlFor="freeShippingMin"
            hint="Pedidos acima deste valor não pagam frete"
          >
            <Input
              id="freeShippingMin"
              name="freeShippingMin"
              inputMode="decimal"
              defaultValue={money(settings.shipping.freeMin)}
              placeholder="150,00"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <Store className="size-5 text-brand-600 dark:text-brand-400" /> Dados
          da farmácia
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CNPJ" htmlFor="cnpj">
            <Input
              id="cnpj"
              name="cnpj"
              defaultValue={settings.cnpj}
              placeholder="00.000.000/0001-00"
            />
          </Field>
          <Field label="Telefone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              defaultValue={settings.phone}
              placeholder="(11) 3000-0000"
            />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp">
            <Input
              id="whatsapp"
              name="whatsapp"
              defaultValue={settings.whatsapp}
              placeholder="(11) 90000-0000"
            />
          </Field>
          <Field label="E-mail de contato" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={settings.email}
              placeholder="contato@farmavida.com.br"
            />
          </Field>
        </div>
        <Field label="Endereço da loja" htmlFor="address">
          <Input
            id="address"
            name="address"
            defaultValue={settings.address}
            placeholder="Av. Paulista, 1000 - São Paulo/SP"
          />
        </Field>
        <Field
          label="Horário de funcionamento"
          htmlFor="hours"
          hint="Exibido no rodapé da loja"
        >
          <Input
            id="hours"
            name="hours"
            defaultValue={settings.hours}
            placeholder="Seg a Sáb, 8h às 22h"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Farmacêutico(a) responsável"
            htmlFor="pharmacistName"
            hint="Exigência ANVISA: responsável técnico visível"
          >
            <Input
              id="pharmacistName"
              name="pharmacistName"
              defaultValue={settings.pharmacistName}
              placeholder="Dra. Maria Silva"
            />
          </Field>
          <Field label="CRF" htmlFor="pharmacistCrf">
            <Input
              id="pharmacistCrf"
              name="pharmacistCrf"
              defaultValue={settings.pharmacistCrf}
              placeholder="CRF/SP 12345"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <CreditCard className="size-5 text-brand-600 dark:text-brand-400" />{" "}
          Pagamento online (PagBank)
        </h2>
        <p className="text-sm text-muted-foreground">
          Cole aqui o <strong>token de produção</strong> do PagBank (Painel
          PagBank → Venda online → Integrações → Chave/Token). Com o token
          salvo, a loja passa a gerar PIX e checkout de cartão automaticamente.
        </p>
        <Field
          label="Token do PagBank"
          htmlFor="pagbankToken"
          hint={
            payment.hasToken
              ? "Um token já está salvo. Deixe como está para mantê-lo; digite um novo para substituir."
              : "Nenhum token salvo ainda — os pagamentos online estão desativados."
          }
        >
          <Input
            id="pagbankToken"
            name="pagbankToken"
            type="password"
            autoComplete="off"
            defaultValue={payment.hasToken ? "••••••••••••••••" : ""}
            placeholder="Cole o token aqui"
          />
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-border p-3">
          <input
            type="checkbox"
            name="pagbankSandbox"
            defaultChecked={payment.sandbox}
            className="mt-0.5 size-4 accent-brand-600"
          />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="size-4 text-brand-600 dark:text-brand-400" />{" "}
              Modo de testes (sandbox)
            </span>
            <span className="text-muted-foreground">
              Use apenas para testar com um token de sandbox. Para receber de
              verdade, deixe <strong>desmarcado</strong>.
            </span>
          </span>
        </label>
      </section>

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
        Salvar configurações
      </Button>
    </form>
  );
}
