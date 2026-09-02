import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import { reportError } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { processStorageDeletionTasks } from "@/lib/storage/deletions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 86_400_000;

/**
 * Minimiza dados temporários sem tocar em pedidos/evidências sujeitos a uma
 * matriz legal específica. A rotina é idempotente e pode ser repetida.
 */
export async function GET(request: Request) {
  if (!cronRequestAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = Date.now();
  try {
    const [resetTokens, guestCarts, paymentRaw, completedStorageTasks] =
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({
          where: { expiresAt: { lt: new Date(now) } },
        }),
        prisma.cart.deleteMany({
          where: {
            userId: null,
            updatedAt: { lt: new Date(now - 30 * DAY) },
          },
        }),
        prisma.payment.updateMany({
          where: {
            createdAt: { lt: new Date(now - 90 * DAY) },
            status: { in: ["APPROVED", "REJECTED", "REFUNDED"] },
            raw: { not: Prisma.DbNull },
          },
          data: { raw: Prisma.DbNull },
        }),
        prisma.storageDeletionTask.deleteMany({
          where: {
            status: "COMPLETED",
            completedAt: { lt: new Date(now - 30 * DAY) },
          },
        }),
      ]);
    const storageDeletions = await processStorageDeletionTasks(50);

    return NextResponse.json(
      {
        ok: true,
        removed: {
          expiredResetTokens: resetTokens.count,
          abandonedGuestCarts: guestCarts.count,
          minimizedPaymentPayloads: paymentRaw.count,
          storageObjects: storageDeletions.completed,
          completedStorageTasks: completedStorageTasks.count,
        },
        storageQueue: storageDeletions,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    reportError(error, { operation: "retention.cleanup" });
    return NextResponse.json(
      { ok: false, error: "retention_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
