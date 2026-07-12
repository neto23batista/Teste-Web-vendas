import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail, mailConfigured, baseUrl } from "@/lib/mail";
import { subscriptionDueEmail } from "@/lib/email-templates";

// Cron diário (vercel.json): lembra por e-mail as assinaturas vencidas e
// reinicia o ciclo. Sem cobrança automática — o cliente confirma o pedido.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Lembretes em lote levam alguns segundos; pede mais fôlego onde o plano permite
// (ignorado no Hobby, que limita a 10s — por isso o lote é pequeno e paralelo).
export const maxDuration = 60;

const CHUNK = 10; // e-mails enviados em paralelo por vez (limita a concorrência)

/** Compara segredos em tempo constante (não vaza o prefixo correto pelo tempo). */
function secretMatches(header: string | null, expected: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${expected}`);
  // timingSafeEqual exige o mesmo tamanho — o tamanho em si não é segredo.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  // A Vercel envia `Authorization: Bearer ${CRON_SECRET}` quando a env existe.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (!secretMatches(request.headers.get("authorization"), secret)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Sem segredo em produção, não expõe um endpoint que dispara e-mails.
    return NextResponse.json(
      { error: "CRON_SECRET não configurado" },
      { status: 503 }
    );
  }

  // Sem provedor de e-mail, NÃO processa: avançar o vencimento aqui "queimaria"
  // o lembrete sem enviar nada. Volta a rodar quando RESEND/MAIL_FROM existirem.
  if (!mailConfigured()) {
    return NextResponse.json({ skipped: "mail_not_configured", due: 0, notified: 0 });
  }

  const now = new Date();
  // Lote defensivo (mais atrasadas primeiro); o cron diário drena o restante.
  const due = await prisma.subscription
    .findMany({
      where: { status: "ACTIVE", nextDueAt: { lte: now } },
      orderBy: { nextDueAt: "asc" },
      take: 100,
      include: {
        user: { select: { email: true, name: true } },
        product: { select: { name: true, active: true, requiresPrescription: true } },
      },
    })
    .catch(() => []); // tabela ainda não migrada → nada a fazer

  const nextDue = (days: number) => new Date(now.getTime() + days * 86_400_000);

  async function processOne(sub: (typeof due)[number]): Promise<boolean> {
    // Produto fora de linha, que passou a exigir receita, ou conta anonimizada
    // (LGPD): pausa em vez de avisar (evita lembrete órfão).
    if (
      !sub.product.active ||
      sub.product.requiresPrescription ||
      sub.user.email.endsWith("@anon.invalid")
    ) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "PAUSED", nextDueAt: nextDue(sub.intervalDays) },
      });
      return false;
    }

    const mail = subscriptionDueEmail(
      sub.user.name,
      sub.product.name,
      sub.qty,
      `${baseUrl()}/conta/assinaturas`
    );
    const sent = await sendMail({ to: sub.user.email, ...mail });

    // Avança mesmo se um envio pontual falhar (evita travar o lote num endereço
    // ruim); o provedor já está configurado (checado acima).
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { nextDueAt: nextDue(sub.intervalDays), lastNotifiedAt: now },
    });
    return sent;
  }

  let notified = 0;
  for (let i = 0; i < due.length; i += CHUNK) {
    const results = await Promise.all(due.slice(i, i + CHUNK).map(processOne));
    notified += results.filter(Boolean).length;
  }

  return NextResponse.json({ due: due.length, notified });
}
