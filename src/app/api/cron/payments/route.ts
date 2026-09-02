import { NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { reportError } from "@/lib/monitoring";
import { reconcilePaymentsAndReservations } from "@/lib/payment-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const summary = await reconcilePaymentsAndReservations(50);
    return NextResponse.json(
      { ok: true, summary },
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
