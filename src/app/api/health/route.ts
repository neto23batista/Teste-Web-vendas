import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Keep-warm + healthcheck. Um pinger externo (cron-job.org/UptimeRobot) bate aqui
// a cada ~4 min para manter o compute do Neon acordado (o autosuspend do plano
// free dorme após ~5 min ocioso → 1ª query fica lenta). O toque é trivial
// (SELECT 1): não lê dados nem segredos. Também serve de healthcheck simples.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Rota pública que toca o banco → limite generoso por IP contra flood
  // (30 hits / 10 s bastam para monitorar; barra abuso). Sem Upstash cai no
  // contador em memória — suficiente aqui.
  const ip = await clientIp();
  const { ok } = await rateLimit(`health:${ip}`, 30, 10_000);
  if (!ok) return new NextResponse("Too Many Requests", { status: 429 });

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, db: "up", at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // Banco indisponível: o ping ainda respondeu, então o monitor sabe que o
    // app está no ar mas o banco não.
    return NextResponse.json(
      { ok: false, db: "down", at: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
