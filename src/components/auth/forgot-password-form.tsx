"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2, Mail, CheckCircle2, ArrowLeft } from "lucide-react";
import { requestPasswordReset, type ResetState } from "@/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(
    requestPasswordReset,
    undefined
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-extrabold">Recuperar senha</h2>
        <p className="text-sm text-muted-foreground">
          Informe seu e-mail e enviaremos um link para redefinir a senha.
        </p>
      </div>

      {state?.ok ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl bg-success-500/10 px-4 py-3 text-sm font-medium text-success-600">
            <CheckCircle2 className="size-4 shrink-0 translate-y-0.5" />
            Se houver uma conta com esse e-mail, você receberá um link de
            redefinição em instantes. Verifique também o spam.
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            <ArrowLeft className="size-4" /> Voltar ao login
          </Link>
        </div>
      ) : (
        <>
          {state?.error && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
              <AlertCircle className="size-4 shrink-0" /> {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <Field label="E-mail" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@email.com"
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
                <Mail className="size-5" />
              )}
              Enviar link de redefinição
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Lembrou a senha?{" "}
            <Link
              href="/login"
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Entrar
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
