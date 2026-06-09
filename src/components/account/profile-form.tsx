"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export function ProfileForm({
  defaultValues,
}: {
  defaultValues: { name: string; email: string; cpf: string; phone: string };
}) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-border bg-card p-5">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 rounded-xl bg-success-500/10 px-4 py-3 text-sm font-medium text-success-600">
          <CheckCircle2 className="size-4 shrink-0" /> Dados atualizados com sucesso!
        </div>
      )}

      <Field label="Nome completo" htmlFor="name">
        <Input id="name" name="name" defaultValue={defaultValues.name} required />
      </Field>
      <Field label="E-mail" htmlFor="email" hint="O e-mail de acesso não pode ser alterado.">
        <Input id="email" name="email" defaultValue={defaultValues.email} disabled />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CPF" htmlFor="cpf">
          <Input id="cpf" name="cpf" defaultValue={defaultValues.cpf} placeholder="000.000.000-00" />
        </Field>
        <Field label="Telefone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={defaultValues.phone} placeholder="(11) 90000-0000" />
        </Field>
      </div>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
        Salvar alterações
      </Button>
    </form>
  );
}
