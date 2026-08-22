import { prisma } from "@/lib/prisma";
import { assertArea } from "@/lib/session";
import { resolveUnitFilter } from "@/lib/admin";
import { toCsv } from "@/lib/csv";
import type { OrderStatus } from "@prisma/client";
import { centsToDecimal, moneyToCents } from "@/lib/money";

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
  // A planilha leva nome e e-mail dos clientes (PII) e os valores dos pedidos:
  // exige a área "pedidos" (quem opera o balcão) — não basta ser staff.
  try {
    await assertArea("pedidos");
  } catch {
    return new Response("Acesso negado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("status");
  const status = raw && VALID.has(raw) ? (raw as OrderStatus) : null;
  // Escopo multi-unidade: a filial só exporta a própria unidade; a matriz exporta
  // tudo ou filtra por ?unit= (mesma regra das telas do admin).
  const unit = await resolveUnitFilter(searchParams.get("unit"));
  const archived = searchParams.get("archived") === "1";

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(unit ? { pharmacyId: unit } : {}),
      archivedAt: archived ? { not: null } : null,
    },
    include: {
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
    "CPF",
    "Telefone",
    "Destinatario",
    "Endereco",
    "Bairro",
    "Cidade",
    "UF",
    "CEP",
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
    o.customerName,
    o.customerEmail,
    o.customerCpf ?? "",
    o.customerPhone ?? "",
    o.shippingRecipient,
    `${o.shippingStreet}, ${o.shippingNumber}${o.shippingComplement ? ` - ${o.shippingComplement}` : ""}`,
    o.shippingDistrict,
    o.shippingCity,
    o.shippingState,
    o.shippingZip,
    o.pharmacy?.name ?? "—",
    STATUS_LABEL[o.status],
    o.paymentMethod ?? "",
    o.couponCode ?? "",
    centsToDecimal(moneyToCents(o.subtotal) ?? 0),
    centsToDecimal(moneyToCents(o.discount) ?? 0),
    centsToDecimal(moneyToCents(o.shipping) ?? 0),
    centsToDecimal(moneyToCents(o.total) ?? 0),
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
