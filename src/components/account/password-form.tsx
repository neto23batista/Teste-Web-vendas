"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { changePassword } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-border bg-card p-5"
    >
      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 rounded-xl bg-success-500/10 px-4 py-3 text-sm font-medium text-success-600">
          <CheckCircle2 className="size-4 shrink-0" /> Senha alterada com
          sucesso!
        </div>
      )}

      <Field label="Senha atual" htmlFor="currentPassword">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nova senha"
          htmlFor="newPassword"
          hint="Mínimo de 8 caracteres"
        >
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Field label="Confirmar nova senha" htmlFor="confirmPassword">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
      </div>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <KeyRound className="size-5" />
        )}
        Alterar senha
      </Button>
    </form>
  );
}
