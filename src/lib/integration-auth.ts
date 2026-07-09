import crypto from "crypto";
import type { NextRequest } from "next/server";
import type { Pharmacy } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Autenticação das rotas /api/integracao/*: o conector (PC da farmácia) envia
 * `Authorization: Bearer <token>`. Só o HASH do token vive no banco
 * (Pharmacy.integrationTokenHash) — vazamento de banco não vaza o token.
 */

export function hashIntegrationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Gera um token novo (exibido UMA vez) e o hash correspondente p/ persistir. */
export function newIntegrationToken(): { token: string; hash: string } {
  const token = `fvi_${crypto.randomBytes(24).toString("hex")}`;
  return { token, hash: hashIntegrationToken(token) };
}

/**
 * Resolve a unidade dona do token da requisição. null = 401.
 * Rate-limit por token: protege o banco de um conector em loop doente.
 */
export async function pharmacyFromRequest(
  req: NextRequest
): Promise<Pharmacy | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const hash = hashIntegrationToken(token);
  if (!(await rateLimit(`integracao:${hash.slice(0, 16)}`, 120, 60_000)).ok) {
    return null;
  }
  return prisma.pharmacy.findFirst({
    where: { integrationTokenHash: hash, active: true },
  });
}
