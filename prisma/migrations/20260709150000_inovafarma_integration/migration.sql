-- Integração InovaFarma: token do conector por unidade + fila de exportação de
-- pedidos (idempotência) + telemetria de sincronização. Tudo aditivo.

ALTER TABLE "Pharmacy" ADD COLUMN "integrationTokenHash" TEXT;

CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'SENT', 'ERROR');

CREATE TABLE "OrderExport" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "externalSaleId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderExport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderExport_orderId_key" ON "OrderExport"("orderId");
CREATE INDEX "OrderExport_pharmacyId_status_idx" ON "OrderExport"("pharmacyId", "status");

ALTER TABLE "OrderExport" ADD CONSTRAINT "OrderExport_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderExport" ADD CONSTRAINT "OrderExport_pharmacyId_fkey"
    FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "SyncKind" AS ENUM ('CATALOG', 'ORDERS');

CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "kind" "SyncKind" NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "items" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncRun_pharmacyId_kind_createdAt_idx" ON "SyncRun"("pharmacyId", "kind", "createdAt");

ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_pharmacyId_fkey"
    FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
