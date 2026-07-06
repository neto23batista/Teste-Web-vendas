"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { authenticate } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(authenticate, undefined);

  // Toast além do banner: garante que o erro seja visto no mobile.
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-extrabold">Entrar na conta</h2>
        <p className="text-sm text-muted-foreground">
          Bem-vindo de volta! Acesse para comprar mais rápido.
        </p>
      </div>

      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required />
        </Field>
        <Field label="Senha" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
        </Field>

        <div className="text-right">
          <Link
            href="/recuperar-senha"
            className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Esqueci minha senha
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
          Entrar
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Criar agora
        </Link>
      </p>
    </div>
  );
}
