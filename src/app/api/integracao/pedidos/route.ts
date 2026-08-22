import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pharmacyFromRequest } from "@/lib/integration-auth";
import { moneyToNumber } from "@/lib/money";

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
      archivedAt: null,
      OR: [{ orderExport: null }, { orderExport: { status: { not: "SENT" } } }],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: {
      items: { include: { product: { select: { sku: true, ean: true } } } },
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
        total: moneyToNumber(o.total),
        frete: moneyToNumber(o.shipping),
        desconto: moneyToNumber(o.discount),
        formaPagamento: o.paymentMethod ?? "outro",
        cliente: {
          nome: o.customerName,
          cpf: o.customerCpf,
          email: o.customerEmail || null,
        },
        entrega: {
          destinatario: o.shippingRecipient,
          cep: o.shippingZip,
          logradouro: o.shippingStreet,
          numero: o.shippingNumber,
          complemento: o.shippingComplement,
          bairro: o.shippingDistrict,
          cidade: o.shippingCity,
          uf: o.shippingState,
        },
        itens: o.items.map((i) => ({
          sku: i.product?.sku ?? null,
          ean: i.product?.ean ?? null,
          nome: i.name,
          qtd: i.qty,
          preco: moneyToNumber(i.price),
        })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
