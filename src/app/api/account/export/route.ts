import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { centsToDecimal, moneyToCents } from "@/lib/money";

/**
 * Portabilidade de dados (LGPD, art. 18 V): devolve um JSON com tudo que a
 * loja guarda sobre o usuário logado, como download.
 */
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [
    profile,
    addresses,
    orders,
    loyalty,
    reviews,
    prescriptions,
    favorites,
    subscriptions,
    cart,
    policyAcceptances,
    auditEvents,
  ] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          name: true,
          email: true,
          cpf: true,
          phone: true,
          mfaEnabledAt: true,
          createdAt: true,
        },
      }),
      prisma.address.findMany({
        where: { userId: user.id },
        select: {
          label: true,
          recipient: true,
          zip: true,
          street: true,
          number: true,
          complement: true,
          district: true,
          city: true,
          state: true,
          isDefault: true,
        },
      }),
      prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          number: true,
          status: true,
          subtotal: true,
          discount: true,
          shipping: true,
          total: true,
          paymentMethod: true,
          couponCode: true,
          customerName: true,
          customerEmail: true,
          customerCpf: true,
          customerPhone: true,
          shippingRecipient: true,
          shippingZip: true,
          shippingStreet: true,
          shippingNumber: true,
          shippingComplement: true,
          shippingDistrict: true,
          shippingCity: true,
          shippingState: true,
          createdAt: true,
          payment: {
            select: {
              provider: true,
              status: true,
              amount: true,
              failedAt: true,
              refundedAt: true,
              createdAt: true,
            },
          },
          items: { select: { name: true, price: true, qty: true } },
        },
      }),
      prisma.loyaltyAccount.findUnique({
        where: { userId: user.id },
        select: {
          points: true,
          transactions: {
            select: { points: true, reason: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.review.findMany({
        where: { userId: user.id },
        select: {
          rating: true,
          comment: true,
          approved: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      }),
      prisma.prescription.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          status: true,
          createdAt: true,
          order: { select: { number: true } },
        },
      }),
      prisma.favorite.findMany({
        where: { userId: user.id },
        select: { createdAt: true, product: { select: { name: true } } },
      }),
      prisma.subscription.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          qty: true,
          intervalDays: true,
          status: true,
          nextDueAt: true,
          lastNotifiedAt: true,
          createdAt: true,
          product: { select: { name: true, sku: true } },
        },
      }),
      prisma.cart.findFirst({
        where: { userId: user.id },
        select: {
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              qty: true,
              product: { select: { name: true, sku: true } },
            },
          },
        },
      }),
      prisma.policyAcceptance.findMany({
        where: { userId: user.id },
        orderBy: { acceptedAt: "asc" },
        select: { kind: true, version: true, acceptedAt: true },
      }),
      // Apenas metadados dos eventos praticados pelo titular. `detail` pode
      // conter dados de terceiros e, por isso, não entra no download automático.
      prisma.auditLog.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          action: true,
          entity: true,
          entityId: true,
          pharmacyId: true,
          createdAt: true,
        },
      }),
    ]);

  const payload = {
    geradoEm: new Date().toISOString(),
    descricao:
      "Exportação dos seus dados pessoais na FarmaVida (LGPD — portabilidade).",
    perfil: profile,
    enderecos: addresses,
    pedidos: orders.map((order) => ({
      ...order,
      subtotal: centsToDecimal(moneyToCents(order.subtotal) ?? 0),
      discount: centsToDecimal(moneyToCents(order.discount) ?? 0),
      shipping: centsToDecimal(moneyToCents(order.shipping) ?? 0),
      total: centsToDecimal(moneyToCents(order.total) ?? 0),
      payment: order.payment
        ? {
            ...order.payment,
            amount: centsToDecimal(moneyToCents(order.payment.amount) ?? 0),
          }
        : null,
      items: order.items.map((item) => ({
        ...item,
        price: centsToDecimal(moneyToCents(item.price) ?? 0),
      })),
    })),
    fidelidade: loyalty,
    avaliacoes: reviews,
    receitas: prescriptions.map((prescription) => ({
      ...prescription,
      downloadPath: `/api/prescriptions/${prescription.id}`,
    })),
    favoritos: favorites,
    assinaturas: subscriptions,
    carrinho: cart,
    aceitesDePoliticas: policyAcceptances,
    eventosDeAuditoria: auditEvents,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-farmavida.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
