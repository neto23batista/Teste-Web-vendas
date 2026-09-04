/**
 * Pré-voo da migração de produção — SOMENTE LEITURA.
 *
 * Não escreve nada. Responde três perguntas antes de `prisma migrate deploy`:
 *   1. quais migrations o banco já tem, e se alguma ficou interrompida;
 *   2. quantos produtos a constraint de receita vai DESATIVAR;
 *   3. quantas linhas de devolução o backfill vai marcar como decididas.
 *
 * Nunca imprime credencial: só o host do banco, para você confirmar o alvo.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

const ESPERADAS = [
  "20260902000100_payment_quarantine",
  "20260902000200_prescription_never_active",
  "20260902000300_job_lease",
  "20260902000400_audit_log_append_only",
  "20260902000500_return_quarantine",
  "20260902000600_data_export_requests",
];

async function main() {
  const alvo = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  const host = alvo.replace(/^.*@/, "").replace(/\/.*$/, "") || "(indefinido)";
  console.log(`\nAlvo: ${host}\n`);

  const linhas = await prisma.$queryRaw<MigrationRow[]>`
    SELECT "migration_name", "finished_at", "rolled_back_at"
    FROM "_prisma_migrations"
    ORDER BY "migration_name"
  `;
  const aplicadas = new Set(
    linhas.filter((l) => l.finished_at && !l.rolled_back_at).map((l) => l.migration_name)
  );
  const interrompidas = linhas.filter((l) => !l.finished_at && !l.rolled_back_at);

  console.log(`Migrations aplicadas no banco: ${aplicadas.size}`);
  console.log(`Última: ${[...aplicadas].sort().at(-1) ?? "(nenhuma)"}\n`);

  console.log("Deste release:");
  for (const nome of ESPERADAS) {
    console.log(`  ${aplicadas.has(nome) ? "JÁ APLICADA" : "PENDENTE   "}  ${nome}`);
  }

  if (interrompidas.length > 0) {
    console.log(`\n!! ${interrompidas.length} migration(s) INTERROMPIDA(S) — resolva antes de seguir:`);
    for (const l of interrompidas) console.log(`   ${l.migration_name}`);
  }

  const [receita] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "Product"
    WHERE "active" = TRUE AND "requiresPrescription" = TRUE
  `;
  const [devolucoes] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n
    FROM "ReturnItem" ri
    JOIN "ReturnRequest" rr ON rr."id" = ri."returnRequestId"
    WHERE rr."status" IN ('RECEIVED', 'COMPLETED')
  `;

  console.log("\nImpacto em dados (o que as migrations vão ESCREVER):");
  console.log(`  produtos que serão DESATIVADOS (tarja ativa): ${receita?.n ?? 0}`);
  console.log(`  itens de devolução marcados como decididos:   ${devolucoes?.n ?? 0}`);
  console.log("\nNada foi alterado por este script.\n");
}

main()
  .catch((e) => {
    console.error("\nFalhou:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
