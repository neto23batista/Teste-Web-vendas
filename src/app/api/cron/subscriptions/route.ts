import { NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import { mailConfigured } from "@/lib/communications/mail";
import { reportError } from "@/lib/monitoring";
import {
  enqueueDueSubscriptionNotifications,
  processSubscriptionNotifications,
} from "@/lib/communications/subscription-notifications";

// Cron diário (vercel.json): lembra por e-mail as assinaturas vencidas e
// reinicia o ciclo. Sem cobrança automática — o cliente confirma o pedido.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // A Vercel envia `Authorization: Bearer ${CRON_SECRET}`. Falha fechado em
  // qualquer runtime de produção e não revela se o segredo está configurado.
  if (!cronRequestAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Sem provedor de e-mail, NÃO processa: avançar o vencimento aqui "queimaria"
  // o lembrete sem enviar nada. Volta a rodar quando RESEND/MAIL_FROM existirem.
  if (!mailConfigured()) {
    return NextResponse.json({
      skipped: "mail_not_configured",
      due: 0,
      notified: 0,
    });
  }

  try {
    const enqueue = await enqueueDueSubscriptionNotifications();
    const delivery = await processSubscriptionNotifications();

    return NextResponse.json({
      due: enqueue.inspected,
      queued: enqueue.queued,
      advanced: enqueue.advanced,
      paused: enqueue.paused + delivery.paused,
      claimed: delivery.claimed,
      notified: delivery.sent,
      failed: delivery.failed,
      discarded: delivery.discarded,
    });
  } catch (error) {
    // Migração ausente ou indisponibilidade do banco precisa alertar o
    // monitoramento; nunca se disfarça de lote vazio bem-sucedido.
    reportError(error, { operation: "subscription.reminder_cron" });
    return NextResponse.json(
      { error: "subscription_reminder_temporarily_unavailable" },
      { status: 503 }
    );
  }
}
