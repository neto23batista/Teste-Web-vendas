import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertDisposableTestDatabase } from "@/lib/operations/test-database-safety";
import { transferPhysicalInventory } from "@/lib/inventory/lot-transfers";
import {
  releaseOrderInventoryReservations,
  reserveOrderInventory,
} from "@/lib/inventory/reservations";
import { syncCatalogInventory } from "@/lib/inventory/catalog-stock";

const databaseUrl = assertDisposableTestDatabase({
  url: process.env.INTEGRATION_DATABASE_URL,
  confirmation: process.env.INTEGRATION_ALLOW_WRITES,
  appEnv: process.env.APP_ENV,
  vercelEnv: process.env.VERCEL_ENV,
});
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const runId = randomUUID();
const userId = `test-user-${runId}`;
const categoryId = `test-category-${runId}`;
const units = [`test-unit-a-${runId}`, `test-unit-b-${runId}`];
const productIds: string[] = [];
let productId: string;

function expiry(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(12, 0, 0, 0);
  return value;
}
const stock = (unit: string) =>
  db.inventory.findUniqueOrThrow({
    where: { productId_pharmacyId: { productId, pharmacyId: unit } },
  });
const movements = () => db.inventoryMovement.findMany({ where: { productId } });
const transfer = (from: string, to: string, qty: number) =>
  db.$transaction((tx) =>
    transferPhysicalInventory(tx, {
      productId,
      fromPharmacyId: from,
      toPharmacyId: to,
      qty,
      transferId: randomUUID(),
      actor: null,
    }),
  );
async function order(qty = 4) {
  return db.order.create({
    data: {
      number: `TEST-${randomUUID()}`,
      userId,
      pharmacyId: units[0],
      subtotal: qty * 10,
      total: qty * 10,
      customerName: "Cliente sintético",
      customerEmail: `test-${runId}@example.test`,
      shippingRecipient: "Cliente sintético",
      shippingZip: "01001000",
      shippingStreet: "Rua de teste",
      shippingNumber: "1",
      shippingDistrict: "Teste",
      shippingCity: "São Paulo",
      shippingState: "SP",
      items: {
        create: { productId, name: "Produto sintético", price: 10, qty },
      },
    },
    include: { items: true },
  });
}
const reserve = (value: Awaited<ReturnType<typeof order>>) =>
  db.$transaction((tx) =>
    reserveOrderInventory(tx, {
      orderId: value.id,
      orderNumber: value.number,
      pharmacyId: units[0],
      items: value.items,
    }),
  );

beforeAll(async () => {
  await db.$connect();
  await db.user.create({
    data: {
      id: userId,
      name: "Cliente sintético",
      email: `test-${runId}@example.test`,
      passwordHash: "not-a-login-credential",
    },
  });
  await db.category.create({
    data: { id: categoryId, name: "Categoria sintética", slug: categoryId },
  });
  await db.pharmacy.createMany({
    data: units.map((id) => ({ id, name: id, slug: id, type: "FILIAL" })),
  });
});

beforeEach(async () => {
  productId = `test-product-${randomUUID()}`;
  await db.product.create({
    data: {
      id: productId,
      name: "Produto sintético",
      slug: productId,
      description: "Fixture de integração",
      price: 10,
      categoryId,
    },
  });
  productIds.push(productId);
  await db.inventory.createMany({
    data: units.map((pharmacyId, index) => ({
      productId,
      pharmacyId,
      stock: index === 0 ? 6 : 0,
      price: 10,
    })),
  });
  await db.inventoryLot.create({
    data: {
      productId,
      pharmacyId: units[0],
      lotCode: "EARLY",
      expiresAt: expiry(30),
      qty: 6,
      supplier: "Fornecedor sintético",
      note: "Rastreabilidade",
    },
  });
});

afterAll(async () => {
  try {
    // Remove exclusivamente os IDs aleatórios desta execução; nunca TRUNCATE/seed.
    await db.$transaction(async (tx) => {
      await tx.order.deleteMany({ where: { userId } });
      if (productIds.length) {
        await tx.inventoryMovement.deleteMany({
          where: { productId: { in: productIds } },
        });
        await tx.product.deleteMany({ where: { id: { in: productIds } } });
      }
      await tx.category.deleteMany({ where: { id: categoryId } });
      await tx.pharmacy.deleteMany({ where: { id: { in: units } } });
      await tx.user.deleteMany({ where: { id: userId } });
    });
  } finally {
    await db.$disconnect();
  }
});

describe("invariantes de estoque em PostgreSQL real", () => {
  it("preserva FEFO, fornecedor e observação na transferência", async () => {
    await db.inventoryLot.updateMany({
      where: { productId },
      data: { qty: 3 },
    });
    await db.inventoryLot.create({
      data: {
        productId,
        pharmacyId: units[0],
        lotCode: "LATE",
        expiresAt: expiry(60),
        qty: 3,
      },
    });
    await transfer(units[0], units[1], 4);
    expect((await stock(units[0])).stock).toBe(2);
    expect((await stock(units[1])).stock).toBe(4);
    const destination = await db.inventoryLot.findMany({
      where: { productId, pharmacyId: units[1] },
      orderBy: { lotCode: "asc" },
    });
    expect(destination).toMatchObject([
      {
        lotCode: "EARLY",
        qty: 3,
        supplier: "Fornecedor sintético",
        note: "Rastreabilidade",
      },
      { lotCode: "LATE", qty: 1 },
    ]);
    expect(await movements()).toHaveLength(2);
  });

  it("reverte ambos os saldos e o livro razão após conflito de validade", async () => {
    await db.inventory.updateMany({
      where: { productId, pharmacyId: units[1] },
      data: { stock: 1 },
    });
    await db.inventoryLot.create({
      data: {
        productId,
        pharmacyId: units[1],
        lotCode: "EARLY",
        expiresAt: expiry(60),
        qty: 1,
      },
    });
    await expect(transfer(units[0], units[1], 2)).rejects.toThrow(
      /outra validade/,
    );
    expect((await stock(units[0])).stock).toBe(6);
    expect((await stock(units[1])).stock).toBe(1);
    expect(await movements()).toHaveLength(0);
  });

  it("reservas simultâneas não vendem além do saldo disponível", async () => {
    const orders = await Promise.all([order(), order()]);
    const results = await Promise.allSettled(orders.map(reserve));
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect((await stock(units[0])).stock).toBe(2);
    expect(await db.inventoryReservation.count({ where: { productId } })).toBe(
      1,
    );
    expect(await movements()).toHaveLength(1);
  });

  it("libera uma reserva exatamente uma vez sob concorrência", async () => {
    const value = await order();
    await reserve(value);
    const release = () =>
      db.$transaction((tx) =>
        releaseOrderInventoryReservations(tx, {
          orderId: value.id,
          orderNumber: value.number,
          reason: "Cancelamento sintético",
        }),
      );
    const counts = await Promise.all([release(), release()]);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(1);
    expect((await stock(units[0])).stock).toBe(6);
    expect(
      await db.inventoryLot.aggregate({
        where: { productId },
        _sum: { qty: true },
      }),
    ).toMatchObject({ _sum: { qty: 6 } });
    expect(
      await db.inventoryMovement.count({
        where: { productId, kind: "RELEASE" },
      }),
    ).toBe(1);
  });

  it("saldo vencido não vira estoque sem lote ao reservar", async () => {
    await db.inventoryLot.updateMany({
      where: { productId },
      data: { expiresAt: expiry(-2) },
    });
    await expect(reserve(await order())).rejects.toThrow(/vencidos/);
    expect((await stock(units[0])).stock).toBe(6);
    expect(await movements()).toHaveLength(0);
    expect(await db.inventoryReservation.count({ where: { productId } })).toBe(
      0,
    );
  });

  it("contagem inválida reverte também os dados da oferta", async () => {
    await expect(
      db.$transaction((tx) =>
        syncCatalogInventory(tx, {
          productId,
          pharmacyId: units[0],
          minStock: 5,
          stock: 2,
          offer: {
            price: "99.00",
            promoPrice: null,
            costPrice: null,
            sku: null,
            ean: null,
          },
          reason: "Contagem sintética",
          actor: null,
        }),
      ),
    ).rejects.toThrow(/baixa no lote/);
    const inventory = await stock(units[0]);
    expect(inventory.stock).toBe(6);
    expect(inventory.price?.toString()).toBe("10");
    expect(await movements()).toHaveLength(0);
  });

  it("transferências inversas usam a mesma ordem de locks", async () => {
    await db.inventory.updateMany({
      where: { productId, pharmacyId: units[1] },
      data: { stock: 6 },
    });
    await db.inventoryLot.create({
      data: {
        productId,
        pharmacyId: units[1],
        lotCode: "EARLY",
        expiresAt: expiry(30),
        qty: 6,
      },
    });
    await Promise.all([
      transfer(units[0], units[1], 2),
      transfer(units[1], units[0], 2),
    ]);
    expect((await stock(units[0])).stock).toBe(6);
    expect((await stock(units[1])).stock).toBe(6);
    expect(await movements()).toHaveLength(4);
  });
});
