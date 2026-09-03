import { NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import { reportError } from "@/lib/monitoring";
import { reconcilePaymentsAndReservations } from "@/lib/payments/reconciliation";
import { withJobLease } from "@/lib/operations/job-lease";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    // Roda de hora em hora contra uma janela de reserva de 25 h. Uma execução
    // lenta ainda pode estar no ar quando a próxima começa; a lease garante que
    // só uma trabalhe, sem duplicar consulta ao provedor nem disputar as mesmas
    // linhas. TTL um pouco acima do `maxDuration` da função, e bem abaixo do
    // intervalo entre execuções.
    const lease = await withJobLease("payments-reconciliation", 5 * 60_000, () =>
      reconcilePaymentsAndReservations(200),
    );
    if (!lease.ran) {
      return NextResponse.json(
        { ok: true, skipped: "already_running" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { ok: true, summary: lease.result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    reportError(error, { operation: "payments.reconcile" });
    return NextResponse.json(
      { ok: false, error: "payment_reconciliation_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
