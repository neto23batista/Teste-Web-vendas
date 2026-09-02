import { prisma } from "@/lib/prisma";
import { assertArea, getAdminScope, type AdminScope } from "@/lib/auth/session";
import type { Prisma } from "@prisma/client";
import { moneyToNumber } from "@/lib/money";
import { ADMIN_PER_PAGE } from "@/lib/admin/scope";

/**
 * Um cliente pertence ao escopo operacional de uma filial somente quando há
 * pelo menos um pedido atendido por ela. A matriz não recebe filtro e mantém a
 * visão global. O caso sem pharmacyId falha fechado, mesmo que hoje o guard de
 * sessão já rejeite administradores sem unidade ativa.
 */
function customerScopeWhere(scope: AdminScope): Prisma.UserWhereInput {
  if (scope.isGlobal) return {};
  if (!scope.pharmacyId) return { id: { equals: "__unscoped_admin__" } };
  return { orders: { some: { pharmacyId: scope.pharmacyId } } };
}

function customerOrderScopeWhere(
  scope: AdminScope,
): Prisma.OrderWhereInput | undefined {
  if (scope.isGlobal) return undefined;
  return scope.pharmacyId
    ? { pharmacyId: scope.pharmacyId }
    : { id: { equals: "__unscoped_admin__" } };
}

function customerAddressScopeWhere(
  scope: AdminScope,
): Prisma.AddressWhereInput | undefined {
  const orderWhere = customerOrderScopeWhere(scope);
  return orderWhere ? { orders: { some: orderWhere } } : undefined;
}

export async function getAdminCustomers(q?: string, page = 1) {
  await assertArea("clientes");
  const scope = await getAdminScope();
  const orderWhere = customerOrderScopeWhere(scope);
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...customerScopeWhere(scope),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { cpf: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const current = Math.max(1, page);
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: {
          select: {
            orders: orderWhere ? { where: orderWhere } : true,
          },
        },
        loyalty: { select: { points: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * ADMIN_PER_PAGE,
      take: ADMIN_PER_PAGE,
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items,
    total,
    page: current,
    perPage: ADMIN_PER_PAGE,
    pages: Math.max(1, Math.ceil(total / ADMIN_PER_PAGE)),
  };
}

export async function getAdminCustomer(id: string) {
  await assertArea("clientes");
  const scope = await getAdminScope();
  const orderWhere = customerOrderScopeWhere(scope);
  const addressWhere = customerAddressScopeWhere(scope);
  const customer = await prisma.user.findFirst({
    where: {
      id,
      role: "CUSTOMER",
      ...customerScopeWhere(scope),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      createdAt: true,
      loyalty: { select: { points: true } },
      addresses: {
        ...(addressWhere ? { where: addressWhere } : {}),
        orderBy: { isDefault: "desc" },
      },
      orders: {
        ...(orderWhere ? { where: orderWhere } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
    },
  });
  return customer
    ? {
        ...customer,
        orders: customer.orders.map((order) => ({
          ...order,
          total: moneyToNumber(order.total),
        })),
      }
    : null;
}
