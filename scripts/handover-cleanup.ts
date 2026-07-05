// Limpeza de HANDOVER: prepara o banco para entrega aos novos donos.
//
// O que faz (nesta ordem):
//   1. BACKUP completo de todas as tabelas em backups/pre-handover-<data>.json
//   2. Apaga TODOS os dados de movimento/demonstração: pedidos, pagamentos,
//      receitas, avaliações, favoritos, assinaturas, carrinhos, fidelidade,
//      endereços, cupons, auditoria e TODOS os usuários (incluindo os demo).
//   3. Mantém só 3 produtos de amostra (sem receita, com estoque na matriz) e
//      zera as notas fake; apaga marcas órfãs. Categorias ficam (estrutura).
//   4. Remove faixas de CEP demo (roteamento cai na matriz até configurarem) e
//      limpa CNPJ/farmacêutico demo dos Settings.
//   5. Cria UM admin de primeiro acesso (matriz, escopo global) com senha
//      aleatória impressa no final — os novos donos devem trocá-la.
//
// Uso: npx tsx scripts/handover-cleanup.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backupAll(): Promise<string> {
  const dump: Record<string, unknown> = {};
  const tables = {
    user: () => prisma.user.findMany(),
    address: () => prisma.address.findMany(),
    passwordResetToken: () => prisma.passwordResetToken.findMany(),
    category: () => prisma.category.findMany(),
    brand: () => prisma.brand.findMany(),
    product: () => prisma.product.findMany(),
    productImage: () => prisma.productImage.findMany(),
    cart: () => prisma.cart.findMany(),
    cartItem: () => prisma.cartItem.findMany(),
    order: () => prisma.order.findMany(),
    orderItem: () => prisma.orderItem.findMany(),
    payment: () => prisma.payment.findMany(),
    prescription: () => prisma.prescription.findMany(),
    loyaltyAccount: () => prisma.loyaltyAccount.findMany(),
    loyaltyTransaction: () => prisma.loyaltyTransaction.findMany(),
    coupon: () => prisma.coupon.findMany(),
    review: () => prisma.review.findMany(),
    favorite: () => prisma.favorite.findMany(),
    setting: () => prisma.setting.findMany(),
    pharmacy: () => prisma.pharmacy.findMany(),
    pharmacyCepRange: () => prisma.pharmacyCepRange.findMany(),
    inventory: () => prisma.inventory.findMany(),
    subscription: () => prisma.subscription.findMany(),
    auditLog: () => prisma.auditLog.findMany(),
  } as const;
  for (const [name, fetch] of Object.entries(tables)) {
    dump[name] = await fetch().catch(() => []);
  }
  const dir = path.join(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `pre-handover-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`
  );
  fs.writeFileSync(file, JSON.stringify(dump, null, 1), "utf8");
  return file;
}

async function main() {
  console.log("💾 Backup completo antes de qualquer exclusão…");
  const backupFile = await backupAll();
  console.log(`   → ${backupFile}`);

  console.log("🧹 Apagando dados de movimento/demonstração…");
  await prisma.auditLog.deleteMany();
  await prisma.subscription.deleteMany().catch(() => {});
  await prisma.favorite.deleteMany().catch(() => {});
  await prisma.review.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany(); // OrderItem cai em cascata
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.loyaltyAccount.deleteMany();
  await prisma.cart.deleteMany(); // CartItem cai em cascata
  await prisma.address.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.user.deleteMany();

  console.log("📦 Escolhendo 3 produtos de amostra…");
  const matriz = await prisma.pharmacy.findFirst({ where: { type: "MATRIZ" } });
  if (!matriz) throw new Error("Matriz não encontrada — abortando.");

  let keepers = await prisma.product.findMany({
    where: {
      active: true,
      requiresPrescription: false,
      inventory: { some: { pharmacyId: matriz.id, stock: { gt: 0 } } },
    },
    orderBy: { ratingCount: "desc" },
    take: 3,
    select: { id: true, name: true },
  });
  if (keepers.length < 3) {
    keepers = await prisma.product.findMany({
      take: 3,
      select: { id: true, name: true },
    });
  }
  const keepIds = keepers.map((k) => k.id);

  const removed = await prisma.product.deleteMany({
    where: { id: { notIn: keepIds } },
  });
  // Notas/contagens do seed eram fictícias — os novos donos partem do zero.
  await prisma.product.updateMany({
    where: { id: { in: keepIds } },
    data: { rating: 0, ratingCount: 0 },
  });
  await prisma.brand.deleteMany({ where: { products: { none: {} } } });

  console.log("🗺️  Removendo faixas de CEP demo e dados regulatórios fake…");
  await prisma.pharmacyCepRange.deleteMany();
  await prisma.setting.updateMany({
    where: { key: "pharmacy_cnpj" },
    data: { value: "" },
  });
  await prisma.setting.updateMany({
    where: { key: "pharmacist" },
    data: { value: "" },
  });

  console.log("👤 Criando o admin de primeiro acesso…");
  const password = `Farma@${crypto.randomBytes(4).toString("hex")}`;
  await prisma.user.create({
    data: {
      name: "Administrador",
      email: "admin@farmavida.local",
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      pharmacyId: matriz.id, // matriz = escopo global
    },
  });

  const products = await prisma.product.count();
  const users = await prisma.user.count();
  console.log("\n✅ Handover pronto:");
  console.log(`   Produtos mantidos (${products}): ${keepers.map((k) => k.name).join(" · ")}`);
  console.log(`   Produtos removidos: ${removed.count}`);
  console.log(`   Usuários: ${users} (apenas o admin de primeiro acesso)`);
  console.log(`   Login inicial → admin@farmavida.local / ${password}`);
  console.log("   ⚠️  Troque esta senha no primeiro acesso (Minha conta → Meus dados).");
  console.log(`   Backup salvo em: ${backupFile}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
