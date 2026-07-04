import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail, baseUrl } from "@/lib/mail";
import { subscriptionDueEmail } from "@/lib/email-templates";

// Cron diário (vercel.json): lembra por e-mail as assinaturas vencidas e
// reinicia o ciclo. Sem cobrança automática — o cliente confirma o pedido.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // A Vercel envia `Authorization: Bearer ${CRON_SECRET}` quando a env existe.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Sem segredo em produção, não expõe um endpoint que dispara e-mails.
    return NextResponse.json(
      { error: "CRON_SECRET não configurado" },
      { status: 503 }
    );
  }

  const now = new Date();
  // Lote defensivo: 200 por execução — o cron diário drena o restante amanhã.
  const due = await prisma.subscription
    .findMany({
      where: { status: "ACTIVE", nextDueAt: { lte: now } },
      take: 200,
      include: {
        user: { select: { email: true, name: true } },
        product: { select: { name: true, active: true } },
      },
    })
    .catch(() => []); // tabela ainda não migrada → nada a fazer

  let notified = 0;
  for (const sub of due) {
    const nextDueAt = new Date(now.getTime() + sub.intervalDays * 86_400_000);

    // Produto desativado ou conta anonimizada (LGPD): pausa em vez de avisar.
    if (!sub.product.active || sub.user.email.endsWith("@anon.invalid")) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "PAUSED", nextDueAt },
      });
      continue;
    }

    const mail = subscriptionDueEmail(
      sub.user.name,
      sub.product.name,
      sub.qty,
      `${baseUrl()}/conta/assinaturas`
    );
    const sent = await sendMail({ to: sub.user.email, ...mail });
    if (sent) notified += 1;

    // Avança o ciclo mesmo sem provedor de e-mail (evita loop de reenvio).
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { nextDueAt, lastNotifiedAt: now },
    });
  }

  return NextResponse.json({ due: due.length, notified });
}
