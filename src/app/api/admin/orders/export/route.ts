import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveUnitFilter } from "@/lib/admin";
import { toCsv } from "@/lib/csv";
import type { OrderStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  PREPARING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

const VALID = new Set(Object.keys(STATUS_LABEL));

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Acesso negado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("status");
  const status = raw && VALID.has(raw) ? (raw as OrderStatus) : null;
  // Escopo multi-unidade: a filial só exporta a própria unidade; a matriz exporta
  // tudo ou filtra por ?unit= (mesma regra das telas do admin).
  const unit = await resolveUnitFilter(searchParams.get("unit"));

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(unit ? { pharmacyId: unit } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      pharmacy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = [
    "Numero",
    "Data",
    "Cliente",
    "Email",
    "Unidade",
    "Status",
    "Pagamento",
    "Cupom",
    "Subtotal",
    "Desconto",
    "Frete",
    "Total",
  ];
  const rows = orders.map((o) => [
    o.number,
    new Date(o.createdAt).toLocaleString("pt-BR"),
    o.user.name,
    o.user.email,
    o.pharmacy?.name ?? "—",
    STATUS_LABEL[o.status],
    o.paymentMethod ?? "",
    o.couponCode ?? "",
    o.subtotal.toFixed(2),
    o.discount.toFixed(2),
    o.shipping.toFixed(2),
    o.total.toFixed(2),
  ]);

  // BOM (﻿) para o Excel reconhecer o UTF-8 (acentos).
  const csv = "﻿" + toCsv([header, ...rows]);
  const date = new Date().toISOString().slice(0, 10);
  const suffix = status ? `-${status.toLowerCase()}` : "";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos${suffix}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
