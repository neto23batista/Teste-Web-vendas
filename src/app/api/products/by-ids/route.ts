import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productCardSelect } from "@/lib/products";

// Busca produtos por uma lista de IDs (usado pela página de Favoritos, que
// guarda os IDs no localStorage do cliente). Somente leitura.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (ids.length === 0) return NextResponse.json({ items: [] });

  const found = await prisma.product.findMany({
    where: { id: { in: ids }, active: true },
    select: productCardSelect,
  });

  // Preserva a ordem dos IDs recebidos (mais recente primeiro).
  const byId = new Map(found.map((p) => [p.id, p]));
  const items = ids.map((id) => byId.get(id)).filter(Boolean);

  return NextResponse.json({ items });
}
