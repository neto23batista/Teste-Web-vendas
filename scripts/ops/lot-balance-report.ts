/**
 * Diagnóstico do saldo de lotes por unidade.
 *
 *   npm run ops:lots
 *
 * Duas condições impedem a venda de um produto numa unidade, e nenhuma das duas
 * aparece sozinha no painel:
 *
 *  1. DIVERGÊNCIA — `sum(lot.qty) > Inventory.stock`. É invariante quebrada:
 *     `inventoryLotAvailability` recusa qualquer reserva daquele produto ali, e
 *     nem o ajuste manual nem a contagem de catálogo conseguem corrigir (os dois
 *     também se recusam a baixar estoque abaixo do rastreado). Saída: baixa de
 *     lote em Compras.
 *
 *  2. VENCIDO — parte do saldo está em lote fora da validade. O estoque agregado
 *     continua contando essas unidades (elas existem fisicamente até a baixa),
 *     então a vitrine anuncia disponibilidade que o checkout recusa. Saída:
 *     baixa do lote vencido em Compras.
 *
 * Rodar antes de virar a chave de produção: o número esperado é zero nos dois.
 */
import { prisma } from "../../src/lib/prisma";
import { inventoryLotDateCutoff } from "../../src/lib/inventory/lots";
import { reportError } from "../../src/lib/monitoring";

type Row = {
  product: string;
  pharmacy: string;
  stock: number;
  trackedQty: number;
  expiredQty: number;
};

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

function table(rows: Row[], showExpired: boolean) {
  for (const row of rows) {
    const detail = showExpired
      ? `estoque ${row.stock}, vencido ${row.expiredQty}, vendável ${row.stock - row.expiredQty}`
      : `estoque ${row.stock}, lotes ${row.trackedQty} (excesso ${row.trackedQty - row.stock})`;
    console.log(`  ${row.pharmacy} · ${row.product} — ${detail}`);
  }
}

async function main() {
  const cutoff = inventoryLotDateCutoff();

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      p."name"  AS "product",
      ph."name" AS "pharmacy",
      i."stock"::int AS "stock",
      COALESCE(SUM(l."qty"), 0)::int AS "trackedQty",
      COALESCE(SUM(CASE WHEN l."expiresAt" < ${cutoff} THEN l."qty" ELSE 0 END), 0)::int AS "expiredQty"
    FROM "Inventory" AS i
    INNER JOIN "Product"  AS p  ON p."id"  = i."productId"
    INNER JOIN "Pharmacy" AS ph ON ph."id" = i."pharmacyId"
    LEFT JOIN "InventoryLot" AS l
      ON l."productId" = i."productId"
     AND l."pharmacyId" = i."pharmacyId"
     AND l."qty" > 0
    GROUP BY p."name", ph."name", i."stock"
    HAVING COALESCE(SUM(l."qty"), 0) > 0
    ORDER BY ph."name", p."name"
  `;

  const diverging = rows.filter((row) => row.trackedQty > row.stock);
  const expired = rows.filter(
    (row) => row.expiredQty > 0 && row.trackedQty <= row.stock,
  );

  console.log("\nSaldo de lotes por unidade\n");

  if (diverging.length > 0) {
    console.log(
      red(`  ${diverging.length} divergência(s): lotes acima do estoque — produto BLOQUEADO para venda`),
    );
    table(diverging, false);
    console.log("");
  }

  if (expired.length > 0) {
    console.log(
      yellow(`  ${expired.length} com lote vencido: saldo anunciado maior que o vendável`),
    );
    table(expired, true);
    console.log("");
  }

  if (diverging.length === 0 && expired.length === 0) {
    console.log(green("  Nenhuma divergência e nenhum lote vencido em circulação.\n"));
  }

  await prisma.$disconnect();
  // Divergência é bloqueio de venda: falha o comando para travar o go-live.
  process.exit(diverging.length > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(red("  Falha ao consultar o saldo de lotes."));
  reportError(error, { operation: "ops.lot_balance_report" });
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
