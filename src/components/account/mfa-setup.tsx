"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { beginMfaSetup, confirmMfaSetup, disableMfa } from "@/actions/account/mfa";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function MfaSetup({
  enabled,
  required,
  liveProduction,
}: {
  enabled: boolean;
  required: boolean;
  liveProduction: boolean;
}) {
  const [beginState, beginAction, beginning] = useActionState(
    beginMfaSetup,
    undefined
  );
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmMfaSetup,
    undefined
  );
  const [disableState, disableAction, disabling] = useActionState(
    disableMfa,
    undefined
  );
  const [copied, setCopied] = useState(false);

  const recoveryCodes = confirmState?.recoveryCodes;

  async function copyCodes() {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (recoveryCodes) {
    return (
      <div className="space-y-4 rounded-2xl border border-success-500/40 bg-success-500/5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" />
          <div>
            <h3 className="font-bold">MFA ativado</h3>
            <p className="text-sm text-muted-foreground">
              Salve estes códigos em um gerenciador de senhas. Eles não serão
              exibidos novamente e cada um funciona uma única vez.
            </p>
          </div>
        </div>

        <div className="grid gap-2 rounded-xl border border-border bg-card p-4 font-mono text-sm sm:grid-cols-2">
          {recoveryCodes.map((code) => (
            <code key={code}>{code}</code>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={copyCodes}>
            <ClipboardCopy className="size-4" />
            {copied ? "Códigos copiados" : "Copiar códigos"}
          </Button>
          <Button asChild variant="primary">
            <Link href="/login?callbackUrl=%2Fadmin">Entrar novamente</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A ativação encerrou as sessões anteriores. Depois de salvar os
          códigos, entre novamente com o código do autenticador.
        </p>
      </div>
    );
  }

  if (disableState?.success) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p role="status" className="flex items-center gap-2 font-semibold text-success-600">
          <CheckCircle2 className="size-5" /> MFA desativado neste ambiente.
        </p>
        <p className="text-sm text-muted-foreground">
          As sessões anteriores foram revogadas.
        </p>
        <Button asChild variant="primary">
          <Link href="/login">Entrar novamente</Link>
        </Button>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success-600" />
          <div>
            <h3 className="font-bold">MFA ativo</h3>
            <p className="text-sm text-muted-foreground">
              O login administrativo exige um código TOTP ou um recovery code.
            </p>
          </div>
        </div>

        {liveProduction ? (
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:bg-brand-600/15 dark:text-brand-200">
            Em produção, o MFA administrativo é obrigatório e não pode ser
            desativado por esta interface.
          </p>
        ) : (
          <form action={disableAction} className="space-y-4" aria-busy={disabling}>
            <p className="text-sm font-semibold">Desativar neste ambiente</p>
            {disableState?.error && (
              <p role="alert" className="text-sm font-medium text-danger-500">
                {disableState.error}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Senha atual" htmlFor="disable-current-password">
                <Input
                  id="disable-current-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  required
                />
              </Field>
              <Field
                label="TOTP ou código de recuperação"
                htmlFor="disable-mfa-code"
              >
                <Input
                  id="disable-mfa-code"
                  name="mfaCode"
                  autoComplete="one-time-code"
                  maxLength={64}
                  required
                />
              </Field>
            </div>
            <Button type="submit" variant="danger" disabled={disabling}>
              {disabling ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Desativar MFA
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
      {required && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <span>
            A loja pública exige MFA para acessar o painel. Conclua a ativação
            e entre novamente.
          </span>
        </div>
      )}

      <div>
        <h3 className="font-bold">Ativar autenticador</h3>
        <p className="text-sm text-muted-foreground">
          Confirme sua senha, leia o QR Code com um app TOTP e valide o primeiro
          código. Nenhum segredo do autenticador é salvo em claro.
        </p>
      </div>

      {!beginState?.secret ? (
        <form action={beginAction} className="space-y-4" aria-busy={beginning}>
          {beginState?.error && (
            <p role="alert" className="text-sm font-medium text-danger-500">
              {beginState.error}
            </p>
          )}
          <Field label="Senha atual" htmlFor="mfa-current-password">
            <Input
              id="mfa-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
            />
          </Field>
          <Button type="submit" variant="primary" disabled={beginning}>
            {beginning ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Iniciar configuração
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="grid items-center gap-5 md:grid-cols-[15rem_1fr]">
            {beginState.qrDataUrl ? (
              <Image
                src={beginState.qrDataUrl}
                alt="QR Code para configurar o autenticador TOTP"
                width={240}
                height={240}
                unoptimized
                className="rounded-xl border border-border bg-white"
              />
            ) : null}
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold">Chave para configuração manual</p>
              <code className="block break-all rounded-xl bg-muted p-3 text-sm">
                {beginState.secret}
              </code>
              <p className="text-xs text-muted-foreground">
                Tipo TOTP, 6 dígitos, período de 30 segundos.
              </p>
            </div>
          </div>

          <form action={confirmAction} className="space-y-4" aria-busy={confirming}>
            {confirmState?.error && (
              <p role="alert" className="text-sm font-medium text-danger-500">
                {confirmState.error}
              </p>
            )}
            <Field label="Código de 6 dígitos" htmlFor="confirm-mfa-code">
              <Input
                id="confirm-mfa-code"
                name="mfaCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
              />
            </Field>
            <Button type="submit" variant="primary" disabled={confirming}>
              {confirming ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Confirmar e ativar
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
