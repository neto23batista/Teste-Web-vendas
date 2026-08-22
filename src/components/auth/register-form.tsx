"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { register } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(register, undefined);
  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  // No celular, quem envia o form está rolado no FIM da página — o banner de
  // erro fica no topo, fora da vista, e parece que "nada aconteceu". O toast
  // garante que o motivo apareça na tela (mesmo padrão do checkout).
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold">Criar conta</h1>
        <p className="text-sm text-muted-foreground">
          Leva menos de 1 minuto. Comece a comprar com benefícios.
        </p>
      </div>

      {state?.error && (
        <div
          id="register-error"
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500"
        >
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4" aria-busy={pending}>
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <input type="hidden" name="privacyVersion" value={PRIVACY_VERSION} />
        <input type="hidden" name="termsVersion" value={TERMS_VERSION} />
        <Field label="Nome completo" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" placeholder="Seu nome" required />
        </Field>
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="CPF" htmlFor="cpf">
            <Input id="cpf" name="cpf" placeholder="000.000.000-00" inputMode="numeric" />
          </Field>
          <Field label="Telefone" htmlFor="phone">
            <Input id="phone" name="phone" placeholder="(11) 90000-0000" inputMode="tel" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Senha" htmlFor="password" hint="Entre 12 e 64 caracteres">
            <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="••••••••••••" minLength={12} maxLength={64} required />
          </Field>
          <Field label="Confirmar" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" placeholder="••••••••••••" minLength={12} maxLength={64} required />
          </Field>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input type="checkbox" name="lgpd" required className="mt-0.5 size-4 rounded border-border accent-brand-600" />
          <span>
            Aceito os{" "}
            <Link href="/termos" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Termos de Uso
            </Link>{" "}
            e estou ciente da{" "}
            <Link href="/privacidade" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Política de Privacidade (LGPD)
            </Link>
            .
          </span>
        </label>

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : <UserPlus className="size-5" />}
          Criar minha conta
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={loginHref} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Entrar
        </Link>
      </p>
    </div>
  );
}
