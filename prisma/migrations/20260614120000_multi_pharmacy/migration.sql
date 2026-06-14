-- Suporte a múltiplas farmácias (Matriz + Filial).
-- Migração ADITIVA: cria unidades, estoque por unidade (Inventory) e vincula
-- pedidos/admin a uma unidade. Mantém Product.stock/minStock como LEGADO
-- (não dropa nesta fase, para não quebrar instâncias antigas durante o deploy).

-- CreateEnum
CREATE TYPE "PharmacyType" AS ENUM ('MATRIZ', 'FILIAL');

-- CreateTable
CREATE TABLE "Pharmacy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "PharmacyType" NOT NULL DEFAULT 'FILIAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "zip" TEXT,
    "street" TEXT,
    "number" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "hours" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyCepRange" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,

    CONSTRAINT "PharmacyCepRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "pharmacyId" TEXT;
ALTER TABLE "Order" ADD COLUMN "pharmacyId" TEXT;
ALTER TABLE "Cart" ADD COLUMN "pharmacyId" TEXT;

-- ─────────────────────────── Backfill ───────────────────────────
-- Cria a matriz (usando o nome de loja já configurado) e uma filial placeholder.
-- Em banco novo (dev) o seed recria tudo; isto serve à migração de produção.
INSERT INTO "Pharmacy" ("id", "name", "slug", "type", "active", "createdAt", "updatedAt")
SELECT 'pharmacy_matriz',
       COALESCE((SELECT "value" FROM "Setting" WHERE "key" = 'pharmacy_name'), 'Matriz'),
       'matriz', 'MATRIZ', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Pharmacy" WHERE "id" = 'pharmacy_matriz');

INSERT INTO "Pharmacy" ("id", "name", "slug", "type", "active", "createdAt", "updatedAt")
SELECT 'pharmacy_filial', 'Filial', 'filial', 'FILIAL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Pharmacy" WHERE "id" = 'pharmacy_filial');

-- Estoque atual de cada produto vai para a matriz; filial começa zerada.
INSERT INTO "Inventory" ("id", "productId", "pharmacyId", "stock", "minStock")
SELECT gen_random_uuid()::text, p."id", 'pharmacy_matriz', p."stock", p."minStock"
FROM "Product" p
WHERE EXISTS (SELECT 1 FROM "Pharmacy" WHERE "id" = 'pharmacy_matriz')
  AND NOT EXISTS (SELECT 1 FROM "Inventory" i WHERE i."productId" = p."id" AND i."pharmacyId" = 'pharmacy_matriz');

INSERT INTO "Inventory" ("id", "productId", "pharmacyId", "stock", "minStock")
SELECT gen_random_uuid()::text, p."id", 'pharmacy_filial', 0, p."minStock"
FROM "Product" p
WHERE EXISTS (SELECT 1 FROM "Pharmacy" WHERE "id" = 'pharmacy_filial')
  AND NOT EXISTS (SELECT 1 FROM "Inventory" i WHERE i."productId" = p."id" AND i."pharmacyId" = 'pharmacy_filial');

-- Pedidos antigos e admins existentes passam a pertencer à matriz.
UPDATE "Order" SET "pharmacyId" = 'pharmacy_matriz'
WHERE "pharmacyId" IS NULL AND EXISTS (SELECT 1 FROM "Pharmacy" WHERE "id" = 'pharmacy_matriz');

UPDATE "User" SET "pharmacyId" = 'pharmacy_matriz'
WHERE "role" = 'ADMIN' AND "pharmacyId" IS NULL AND EXISTS (SELECT 1 FROM "Pharmacy" WHERE "id" = 'pharmacy_matriz');

-- ─────────────────────────── Índices ───────────────────────────
-- CreateIndex
CREATE UNIQUE INDEX "Pharmacy_slug_key" ON "Pharmacy"("slug");
CREATE INDEX "Pharmacy_type_idx" ON "Pharmacy"("type");
CREATE INDEX "PharmacyCepRange_pharmacyId_idx" ON "PharmacyCepRange"("pharmacyId");
CREATE UNIQUE INDEX "Inventory_productId_pharmacyId_key" ON "Inventory"("productId", "pharmacyId");
CREATE INDEX "Inventory_pharmacyId_idx" ON "Inventory"("pharmacyId");
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");
CREATE INDEX "User_pharmacyId_idx" ON "User"("pharmacyId");
CREATE INDEX "Order_pharmacyId_idx" ON "Order"("pharmacyId");
CREATE INDEX "Cart_pharmacyId_idx" ON "Cart"("pharmacyId");

-- ─────────────────────────── Chaves estrangeiras ───────────────────────────
-- AddForeignKey
ALTER TABLE "PharmacyCepRange" ADD CONSTRAINT "PharmacyCepRange_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
