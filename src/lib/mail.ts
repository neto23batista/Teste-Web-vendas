// Camada de e-mail agnóstica de provedor.
//
// - Produção: usa Resend (HTTP) quando RESEND_API_KEY + MAIL_FROM existem.
// - Dev / sem config: apenas loga no console (não envia nada).
//
// Best-effort: nunca lança — uma falha de e-mail não deve quebrar o fluxo do
// usuário (cadastro, pedido, reset). Retorna true só quando entregou ao provedor.

import { reportError } from "@/lib/monitoring";

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Chave interna estável para retry seguro no provedor (máx. 256 ASCII). */
  idempotencyKey?: string;
};

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/** URL base da aplicação (sem barra final), para montar links em e-mails. */
export function baseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export async function sendMail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: MailInput): Promise<boolean> {
  if (!mailConfigured()) {
    // Não registre destinatário nem corpo: mensagens de reset contêm dados
    // pessoais e tokens de uso único.
    console.info("[mail] provedor não configurado; mensagem não enviada");
    return false;
  }

  try {
    const safeIdempotencyKey =
      idempotencyKey && /^[A-Za-z0-9/_:.-]{1,256}$/.test(idempotencyKey)
        ? idempotencyKey
        : null;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(safeIdempotencyKey
          ? { "Idempotency-Key": safeIdempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      // O corpo de erro do provedor pode repetir destinatário/conteúdo.
      // Status + serviço bastam para alerta sem copiar PII para os logs.
      reportError(new Error(`Resend request failed (${res.status})`), {
        service: "mail",
      });
      return false;
    }
    return true;
  } catch (err) {
    reportError(err, { service: "mail" });
    return false;
  }
}
