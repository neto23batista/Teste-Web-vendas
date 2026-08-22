import { NextResponse } from "next/server";

/**
 * Liveness: confirma somente que o processo Next.js consegue atender HTTP.
 * Dependências externas pertencem ao `/api/ready`, para que uma falha do banco
 * não faça o orquestrador reiniciar um processo saudável em loop.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
