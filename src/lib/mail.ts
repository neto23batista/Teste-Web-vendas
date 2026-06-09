// Camada de e-mail agnóstica de provedor.
//
// - Produção: usa Resend (HTTP) quando RESEND_API_KEY + MAIL_FROM existem.
// - Dev / sem config: apenas loga no console (não envia nada).
//
// Best-effort: nunca lança — uma falha de e-mail não deve quebrar o fluxo do
// usuário (cadastro, pedido, reset). Retorna true só quando entregou ao provedor.

type MailInput = { to: string; subject: string; html: string; text?: string };

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
}: MailInput): Promise<boolean> {
  if (!mailConfigured()) {
    // Em dev, deixamos o rastro no log para inspeção (ex.: link de reset).
    console.info(`[mail] (sem provedor) → ${to} · "${subject}"`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      }),
    });
    if (!res.ok) {
      console.error(`[mail] Resend ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mail] erro ao enviar:", err);
    return false;
  }
}
