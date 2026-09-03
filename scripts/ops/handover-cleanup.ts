// Limpeza de HANDOVER: prepara o banco para entrega aos novos donos.
//
// O que faz (nesta ordem):
//   1. Valida confirmações fortes e o banco-alvo ANTES de qualquer leitura/escrita.
//   2. Apaga TODOS os dados de movimento/demonstração: pedidos, pagamentos,
//      receitas, avaliações, favoritos, assinaturas, carrinhos, fidelidade,
//      endereços, cupons, auditoria e TODOS os usuários (incluindo os demo).
//   3. Mantém só 3 produtos de amostra (sem receita, com estoque na matriz) e
//      zera as notas fake; apaga marcas órfãs. Categorias ficam (estrutura).
//   4. Remove faixas de CEP demo (roteamento cai na matriz até configurarem) e
//      limpa CNPJ/farmacêutico demo dos Settings.
//   5. Cria UM admin de primeiro acesso (matriz, escopo global) com senha
//      de alta entropia. A senha não é impressa sem opt-in separado.
//
// Uso: consulte docs/OPERATIONS.md. A execução falha fechada por padrão.
import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { reportError } from "../../src/lib/monitoring";
import { enqueueStorageDeletions } from "../../src/lib/storage/deletions";
import {
  assertHandoverCleanupAllowed,
  handoverPasswordMode,
} from "../../src/lib/operations/handover-safety";

const prisma = new PrismaClient();

async function main() {
  assertHandoverCleanupAllowed(process.env);
  const passwordMode = handoverPasswordMode(process.env);
  const password =
    passwordMode === "provided"
      ? process.env.HANDOVER_OWNER_PASSWORD!
      : crypto.randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  // Não criamos dump JSON: ele copiava PII, hashes, tokens e dados de pagamento
  // para o workspace. Backup/restore deve usar o procedimento criptografado da
  // infraestrutura, com retenção e acesso controlados.

  console.log("🧹 Executando limpeza atômica de dados de demonstração…");
  const summary = await prisma.$transaction(
    async (tx) => {
      const matriz = await tx.pharmacy.findFirst({
        where: { type: "MATRIZ" },
        select: { id: true },
      });
      if (!matriz) throw new Error("Matriz não encontrada — transação abortada.");

      // Todos os efeitos no PostgreSQL vivem na MESMA transação. Qualquer falha
      // desfaz o conjunto inteiro, em vez de deixar uma base meio apagada.
      const prescriptionFiles = await tx.prescription.findMany({
        select: { fileUrl: true },
      });
      await enqueueStorageDeletions(
        tx,
        prescriptionFiles.map(({ fileUrl }) => fileUrl)
      );
      // A trilha é somente-anexação no banco (trigger AuditLog_append_only).
      // Zerá-la só é permitido declarando a intenção na própria sessão — é o
      // que separa a entrega deliberada do projeto de um DELETE acidental.
      await tx.$executeRawUnsafe("SET LOCAL app.allow_audit_purge = 'on'");
      await tx.auditLog.deleteMany();
      await tx.subscription.deleteMany();
      await tx.favorite.deleteMany();
      await tx.review.deleteMany();
      await tx.prescription.deleteMany();
      await tx.bankTransaction.deleteMany();
      await tx.payment.deleteMany();
      await tx.order.deleteMany(); // OrderItem cai em cascata
      await tx.loyaltyTransaction.deleteMany();
      await tx.loyaltyAccount.deleteMany();
      await tx.cart.deleteMany(); // CartItem cai em cascata
      await tx.address.deleteMany();
      await tx.passwordResetToken.deleteMany();
      await tx.coupon.deleteMany();
      await tx.expense.deleteMany();
      await tx.courier.deleteMany();
      await tx.user.deleteMany();

      // Nunca completa a amostra com produto regulado. Se houver menos de três
      // produtos MIP ativos, mantém somente os disponíveis — inclusive zero.
      const keepers = await tx.product.findMany({
        where: { active: true, requiresPrescription: false },
        orderBy: [{ ratingCount: "desc" }, { createdAt: "asc" }],
        take: 3,
        select: { id: true, name: true },
      });
      const keepIds = keepers.map((product) => product.id);
      const removed = await tx.product.deleteMany({
        where: { id: { notIn: keepIds } },
      });
      await tx.product.updateMany({
        where: { id: { in: keepIds } },
        data: { rating: 0, ratingCount: 0 },
      });
      await tx.brand.deleteMany({ where: { products: { none: {} } } });

      await tx.pharmacyCepRange.deleteMany();
      await tx.setting.deleteMany({
        where: {
          key: {
            in: [
              "pharmacy_cnpj",
              "pharmacist",
              "store.legalName",
              "store.cnpj",
              "store.phone",
              "store.whatsapp",
              "store.email",
              "store.address",
              "store.hours",
              "store.pharmacistName",
              "store.pharmacistCrf",
              "store.sanitaryLicense",
              "store.afe",
              "store.ae",
            ],
          },
        },
      });
      await tx.pharmacy.updateMany({
        data: { cnpj: null, pharmacistName: null, pharmacistCrf: null },
      });

      await tx.user.create({
        data: {
          name: "Administrador",
          email: "admin@farmavida.local",
          passwordHash,
          role: "ADMIN",
          staffProfile: "OWNER",
          pharmacyId: matriz.id,
        },
      });

      return {
        keepers,
        removed: removed.count,
        products: await tx.product.count(),
        users: await tx.user.count(),
      };
    },
    { maxWait: 10_000, timeout: 120_000 }
  );

  console.log("\n✅ Handover pronto:");
  console.log(
    `   Produtos mantidos (${summary.products}): ${summary.keepers.map((product) => product.name).join(" · ") || "nenhum MIP ativo disponível"}`
  );
  console.log(`   Produtos removidos: ${summary.removed}`);
  console.log(`   Usuários: ${summary.users} (apenas o admin de primeiro acesso)`);
  console.log("   Login inicial → admin@farmavida.local");
  if (passwordMode === "generate-and-print") {
    console.log(`   Senha inicial (exibição única autorizada): ${password}`);
  } else {
    console.log("   Senha inicial recebida por HANDOVER_OWNER_PASSWORD (não exibida). ");
  }
  console.log("   ⚠️  Troque esta senha no primeiro acesso (Minha conta → Meus dados).");
}

main()
  .catch((e) => {
    reportError(e, { operation: "handover.cleanup" });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
