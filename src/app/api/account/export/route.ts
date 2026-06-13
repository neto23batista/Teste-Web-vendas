import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * Portabilidade de dados (LGPD, art. 18 V): devolve um JSON com tudo que a
 * loja guarda sobre o usuário logado, como download.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [profile, addresses, orders, loyalty, reviews, prescriptions, favorites] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          name: true,
          email: true,
          cpf: true,
          phone: true,
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
          createdAt: true,
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
          status: true,
          createdAt: true,
          order: { select: { number: true } },
        },
      }),
      // Favoritos por conta dependem da migration `add_favorites`. Enquanto ela
      // não roda em produção, a tabela pode não existir — degrade para lista
      // vazia em vez de derrubar toda a exportação.
      prisma.favorite
        .findMany({
          where: { userId: user.id },
          select: { createdAt: true, product: { select: { name: true } } },
        })
        .catch(() => [] as { createdAt: Date; product: { name: string } }[]),
    ]);

  const payload = {
    geradoEm: new Date().toISOString(),
    descricao:
      "Exportação dos seus dados pessoais na FarmaVida (LGPD — portabilidade).",
    perfil: profile,
    enderecos: addresses,
    pedidos: orders,
    fidelidade: loyalty,
    avaliacoes: reviews,
    receitas: prescriptions,
    favoritos: favorites,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-farmavida.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
