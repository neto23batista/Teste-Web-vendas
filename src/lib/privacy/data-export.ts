import { prisma } from "@/lib/prisma";
import { centsToDecimal, moneyToCents, type MoneyValue } from "@/lib/money";
import { putObject, deleteObject } from "@/lib/storage";
import { reportError } from "@/lib/monitoring";

/**
 * Portabilidade de dados pessoais (LGPD, art. 18 V).
 *
 * A montagem é assíncrona e paginada. Um titular antigo tem histórico grande
 * demais para caber numa requisição HTTP: montar tudo em memória durante o
 * download pressionava a instância inteira, e cortar o resultado para caber
 * seria pior — uma exportação legal truncada em silêncio não cumpre o direito.
 */

/** O arquivo pronto fica disponível por este prazo antes de ser apagado. */
export const EXPORT_RETENTION_MS = 7 * 86_400_000;

/** Intervalo mínimo entre dois pedidos do mesmo titular. */
export const EXPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Lote de leitura. Mantém a memória previsível independente do histórico. */
const PAGE = 200;

const money = (value: MoneyValue) => centsToDecimal(moneyToCents(value) ?? 0);

/** O `id` serve só para paginar por cursor; não faz parte do dado do titular. */
function stripId<T extends { id: string }>(row: T): Omit<T, "id"> {
  const copy: Partial<T> = { ...row };
  delete copy.id;
  return copy as Omit<T, "id">;
}

/** Lê uma coleção inteira em páginas, sem nunca segurar a consulta toda aberta. */
async function paginate<T extends { id: string }>(
  read: (cursor: string | null) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: T[] = await read(cursor);
    all.push(...page);
    if (page.length < PAGE) break;
    cursor = page[page.length - 1]!.id;
  }
  return all;
}

export async function buildDataExportPayload(userId: string) {
  const [profile, addresses, loyalty, reviews, favorites, subscriptions, cart, policyAcceptances] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
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
        where: { userId },
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
      prisma.loyaltyAccount.findUnique({
        where: { userId },
        select: {
          points: true,
          transactions: {
            select: { points: true, reason: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.review.findMany({
        where: { userId },
        select: {
          rating: true,
          comment: true,
          approved: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      }),
      prisma.favorite.findMany({
        where: { userId },
        select: { createdAt: true, product: { select: { name: true } } },
      }),
      prisma.subscription.findMany({
        where: { userId },
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
        where: { userId },
        select: {
          createdAt: true,
          updatedAt: true,
          items: {
            select: { qty: true, product: { select: { name: true, sku: true } } },
          },
        },
      }),
      prisma.policyAcceptance.findMany({
        where: { userId },
        orderBy: { acceptedAt: "asc" },
        select: { kind: true, version: true, acceptedAt: true },
      }),
    ]);

  // As duas coleções que crescem sem teto ao longo dos anos.
  const orders = await paginate((cursor) =>
    prisma.order.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
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
  );

  // Apenas metadados dos eventos praticados pelo titular. `detail` pode conter
  // dados de terceiros e, por isso, não entra no download automático.
  const auditEvents = await paginate((cursor) =>
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        pharmacyId: true,
        createdAt: true,
      },
    }),
  );

  const prescriptions = await prisma.prescription.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      order: { select: { number: true } },
    },
  });

  return {
    geradoEm: new Date().toISOString(),
    descricao:
      "Exportação dos seus dados pessoais na FarmaVida (LGPD — portabilidade).",
    perfil: profile,
    enderecos: addresses,
    pedidos: orders.map((row) => {
      const order = stripId(row);
      return {
      ...order,
      subtotal: money(order.subtotal),
      discount: money(order.discount),
      shipping: money(order.shipping),
      total: money(order.total),
      payment: order.payment
        ? { ...order.payment, amount: money(order.payment.amount) }
        : null,
      items: order.items.map((item) => ({ ...item, price: money(item.price) })),
      };
    }),
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
    eventosDeAuditoria: auditEvents.map(stripId),
  };
}

export type DataExportRun = { processed: number; failed: number; expired: number };

/**
 * Gera os arquivos pendentes e apaga os vencidos. Roda no cron de retenção, que
 * já é o dono do ciclo de vida de arquivo temporário.
 */
export async function processDataExports(limit = 5): Promise<DataExportRun> {
  const run: DataExportRun = { processed: 0, failed: 0, expired: 0 };
  const now = new Date();

  const pending = await prisma.dataExportRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { requestedAt: "asc" },
    take: limit,
    select: { id: true, userId: true },
  });

  for (const request of pending) {
    try {
      const payload = await buildDataExportPayload(request.userId);
      const body = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
      // Storage PRIVADO: a chave nunca é exposta; o download passa pela rota
      // autenticada, que confere o dono antes de servir o conteúdo.
      const storageKey = `exports/${request.userId}/${request.id}.json`;
      await putObject(storageKey, body);
      await prisma.dataExportRequest.update({
        where: { id: request.id },
        data: {
          status: "READY",
          storageKey,
          sizeBytes: body.byteLength,
          readyAt: now,
          expiresAt: new Date(now.getTime() + EXPORT_RETENTION_MS),
          error: null,
        },
      });
      run.processed += 1;
    } catch (error) {
      run.failed += 1;
      reportError(error, { operation: "privacy.data_export.build" });
      await prisma.dataExportRequest.update({
        where: { id: request.id },
        data: {
          status: "FAILED",
          error: "Não foi possível gerar a exportação. Solicite novamente.",
        },
      });
    }
  }

  // Arquivo temporário não pode virar cópia permanente dos dados do titular.
  const stale = await prisma.dataExportRequest.findMany({
    where: { status: "READY", expiresAt: { lte: now } },
    take: 50,
    select: { id: true, storageKey: true },
  });
  for (const request of stale) {
    try {
      if (request.storageKey) await deleteObject(request.storageKey);
      await prisma.dataExportRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED", storageKey: null },
      });
      run.expired += 1;
    } catch (error) {
      reportError(error, { operation: "privacy.data_export.expire" });
    }
  }

  return run;
}
