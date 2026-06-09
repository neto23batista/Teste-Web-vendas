"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { resetPassword, type ResetState } from "@/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(
    resetPassword,
    undefined
  );

  if (!token) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-extrabold">Link inválido</h2>
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> Este link de redefinição é
          inválido ou está incompleto.
        </div>
        <Link
          href="/recuperar-senha"
          className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Solicitar um novo link
        </Link>
      </div>
    );
  }

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-extrabold">Senha redefinida ✅</h2>
        <div className="flex items-start gap-2 rounded-xl bg-success-500/10 px-4 py-3 text-sm font-medium text-success-600">
          <CheckCircle2 className="size-4 shrink-0 translate-y-0.5" />
          Sua senha foi atualizada com sucesso. Agora é só entrar com a nova
          senha.
        </div>
        <Link href="/login">
          <Button variant="primary" size="lg" className="w-full">
            Ir para o login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-extrabold">Criar nova senha</h2>
        <p className="text-sm text-muted-foreground">
          Defina uma senha com pelo menos 8 caracteres.
        </p>
      </div>

      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Nova senha" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm">
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <KeyRound className="size-5" />
          )}
          Redefinir senha
        </Button>
      </form>
    </div>
  );
}
