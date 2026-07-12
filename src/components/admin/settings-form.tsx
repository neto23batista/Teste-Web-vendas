"use client";

import * as React from "react";
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
  RotateCcw,
  Plug,
} from "lucide-react";
import { toast } from "sonner";
import { saveSettings, testPagbankConnection } from "@/actions/admin-settings";
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
  const [testing, startTest] = React.useTransition();

  function handleTestPagbank() {
    startTest(async () => {
      const res = await testPagbankConnection();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

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
        <p className="text-sm text-muted-foreground">
          Frete padrão: grátis a partir do valor abaixo dentro do raio; além
          dele, cobra o custo por km excedente. A distância vem das faixas de CEP
          de cada unidade (campo km).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Frete grátis a partir de (R$)"
            htmlFor="freeShippingMin"
            hint="Pedidos acima deste valor liberam o raio grátis"
          >
            <Input
              id="freeShippingMin"
              name="freeShippingMin"
              inputMode="decimal"
              defaultValue={money(settings.shipping.freeMin)}
              placeholder="10,00"
            />
          </Field>
          <Field
            label="Raio grátis (km)"
            htmlFor="freeRadiusKm"
            hint="Distância coberta sem custo no frete padrão"
          >
            <Input
              id="freeRadiusKm"
              name="freeRadiusKm"
              inputMode="decimal"
              defaultValue={money(settings.shipping.freeRadiusKm)}
              placeholder="4"
            />
          </Field>
          <Field
            label="Custo por km (R$)"
            htmlFor="perKm"
            hint="Cobrado por km excedente (padrão) e por km na Entrega Rápida"
          >
            <Input
              id="perKm"
              name="perKm"
              inputMode="decimal"
              defaultValue={money(settings.shipping.perKm)}
              placeholder="1,00"
            />
          </Field>
          <Field
            label="Taxa da Entrega Rápida (R$)"
            htmlFor="expressFlat"
            hint="Fixo da entrega em 30–40 min, somado ao custo por km"
          >
            <Input
              id="expressFlat"
              name="expressFlat"
              inputMode="decimal"
              defaultValue={money(settings.shipping.expressFlat)}
              placeholder="5,00"
            />
          </Field>
          <Field
            label="Distância padrão (km)"
            htmlFor="defaultKm"
            hint="Usada quando o CEP não casa nenhuma faixa cadastrada"
          >
            <Input
              id="defaultKm"
              name="defaultKm"
              inputMode="decimal"
              defaultValue={money(settings.shipping.defaultKm)}
              placeholder="0"
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
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTestPagbank}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:border-brand-300 hover:bg-muted disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plug className="size-4" />
            )}
            Testar conexão
          </button>
          <p className="text-xs text-muted-foreground">
            Verifica se o token salvo autentica e em qual ambiente. Salve antes de
            testar.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <RotateCcw className="size-5 text-brand-600 dark:text-brand-400" />{" "}
          Política de troca e devolução
        </h2>
        <p className="text-sm text-muted-foreground">
          Exibida na página pública{" "}
          <a href="/trocas-e-devolucoes" className="font-semibold text-brand-600 dark:text-brand-400" target="_blank" rel="noreferrer">
            /trocas-e-devolucoes
          </a>{" "}
          e no rodapé. Aceita Markdown (títulos com <code>##</code>, listas com{" "}
          <code>-</code>). Em branco, usa o texto padrão em conformidade com o CDC.
        </p>
        <textarea
          name="returnPolicy"
          rows={12}
          defaultValue={settings.returnPolicy}
          placeholder="## Política de Troca e Devolução…"
          className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 font-mono text-xs leading-relaxed outline-none transition placeholder:text-muted-foreground focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
        />
      </section>

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
        Salvar configurações
      </Button>
    </form>
  );
}
