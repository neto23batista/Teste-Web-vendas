import { NextResponse } from "next/server";
import { reportError } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { EXPECTED_MIGRATION } from "@/lib/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReadinessRow = { ready: boolean };

/**
 * Readiness: aceita tráfego somente quando o PostgreSQL responde, a migration
 * esperada é a última concluída e não existe migration interrompida. A resposta
 * pública é propositalmente binária; diagnósticos ficam nos logs protegidos.
 */
export async function GET() {
  try {
    const [state] = await prisma.$queryRaw<ReadinessRow[]>`
      WITH "latest_successful" AS (
        SELECT "migration_name"
        FROM "_prisma_migrations"
        WHERE "finished_at" IS NOT NULL
          AND "rolled_back_at" IS NULL
          AND "applied_steps_count" > 0
        ORDER BY "migration_name" DESC
        LIMIT 1
      )
      SELECT
        COALESCE(
          (SELECT "migration_name" = ${EXPECTED_MIGRATION}
           FROM "latest_successful"),
          FALSE
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "_prisma_migrations"
          WHERE "finished_at" IS NULL
            AND "rolled_back_at" IS NULL
        ) AS "ready"
    `;

    if (!state?.ready) {
      return NextResponse.json(
        { ok: false },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    reportError(error, { operation: "readiness.check" });
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
