import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { getObject } from "@/lib/storage";
import { reportError } from "@/lib/monitoring";
import { EXPORT_COOLDOWN_MS } from "@/lib/privacy/data-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Portabilidade de dados (LGPD, art. 18 V).
 *
 * O arquivo é montado fora da requisição, pelo cron de retenção: um titular
 * antigo tem histórico grande demais para caber numa resposta HTTP, e montar
 * tudo em memória durante o download pressionava a instância inteira.
 *
 *  POST → solicita a exportação (1 por dia, registrada na auditoria)
 *  GET  → consulta o andamento e, quando pronta, entrega o arquivo
 */

async function currentUser() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const since = new Date(Date.now() - EXPORT_COOLDOWN_MS);
  const recent = await prisma.dataExportRequest.findFirst({
    where: { userId: user.id, requestedAt: { gte: since } },
    orderBy: { requestedAt: "desc" },
    select: { id: true, status: true, requestedAt: true },
  });
  if (recent) {
    // Montar a exportação lê o histórico inteiro do titular. Uma por dia já
    // atende o direito sem transformar o endpoint em amplificador de carga.
    return NextResponse.json(
      {
        status: recent.status,
        error:
          "Você já solicitou uma exportação nas últimas 24 horas. Ela aparece aqui assim que ficar pronta.",
      },
      { status: 429, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const created = await prisma.dataExportRequest.create({
    data: { userId: user.id },
    select: { id: true, status: true, requestedAt: true },
  });
  // A própria solicitação é um evento de privacidade e fica registrada.
  await logAudit({
    action: "privacy.export.request",
    entity: "DataExportRequest",
    entityId: created.id,
    detail: "Solicitou a exportação dos próprios dados",
    actor: { id: user.id, email: user.email ?? null },
  }).catch((error) => {
    reportError(error, { operation: "privacy.export.audit" });
  });

  return NextResponse.json(
    { status: created.status, requestedAt: created.requestedAt },
    { status: 202, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const latest = await prisma.dataExportRequest.findFirst({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      userId: true,
      status: true,
      storageKey: true,
      sizeBytes: true,
      error: true,
      requestedAt: true,
      readyAt: true,
      expiresAt: true,
    },
  });

  if (!latest) {
    return NextResponse.json(
      { status: "NONE" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // The UI polls metadata only; never download a personal archive in background.
  if (new URL(request.url).searchParams.get("status") === "1") {
    const expired = latest.expiresAt && latest.expiresAt <= new Date();
    return NextResponse.json(
      {
        status: expired ? "EXPIRED" : latest.status,
        requestedAt: latest.requestedAt,
        readyAt: latest.readyAt,
        expiresAt: latest.expiresAt,
        sizeBytes: latest.sizeBytes,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (latest.status !== "READY" || !latest.storageKey) {
    return NextResponse.json(
      {
        status: latest.status,
        requestedAt: latest.requestedAt,
        error: latest.error,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // Confere o dono antes de servir. A chave do storage nunca sai daqui: um link
  // direto para o objeto seria um vazamento permanente do histórico do titular.
  if (latest.userId !== user.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let body: Buffer;
  try {
    body = await getObject(latest.storageKey);
  } catch (error) {
    reportError(error, { operation: "privacy.export.download" });
    return NextResponse.json(
      { status: "FAILED", error: "O arquivo não está mais disponível. Solicite novamente." },
      { status: 410, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-farmavida.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
