import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pharmacyFromRequest } from "@/lib/integration-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista os pedidos da unidade prontos para virar venda na InovaFarma:
 * pagos (PAID/PREPARING) e ainda não exportados (sem OrderExport SENT).
 * Na primeira leitura cria o OrderExport PENDING — a fila é persistente e
 * o pedido nunca é exportado duas vezes (orderId único em OrderExport).
 */
export async function GET(req: NextRequest) {
  const pharmacy = await pharmacyFromRequest(req);
  if (!pharmacy) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      pharmacyId: pharmacy.id,
      status: { in: ["PAID", "PREPARING"] },
      OR: [{ orderExport: null }, { orderExport: { status: { not: "SENT" } } }],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: {
      items: { include: { product: { select: { sku: true, ean: true } } } },
      address: { select: { zip: true, city: true, state: true } },
      user: { select: { name: true, cpf: true, email: true } },
    },
  });

  // Garante a linha de fila (PENDING) para cada pedido listado.
  for (const o of orders) {
    await prisma.orderExport.upsert({
      where: { orderId: o.id },
      update: {},
      create: { orderId: o.id, pharmacyId: pharmacy.id },
    });
  }

  return NextResponse.json(
    {
      pedidos: orders.map((o) => ({
        numero: o.number,
        criadoEm: o.createdAt.toISOString(),
        total: o.total,
        frete: o.shipping,
        desconto: o.discount,
        formaPagamento: o.paymentMethod ?? "outro",
        cliente: {
          nome: o.user?.name ?? "Cliente",
          cpf: o.user?.cpf ?? null,
          email: o.user?.email ?? null,
        },
        entrega: o.address
          ? { cep: o.address.zip, cidade: o.address.city, uf: o.address.state }
          : null,
        itens: o.items.map((i) => ({
          sku: i.product?.sku ?? null,
          ean: i.product?.ean ?? null,
          nome: i.name,
          qtd: i.qty,
          preco: i.price,
        })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
