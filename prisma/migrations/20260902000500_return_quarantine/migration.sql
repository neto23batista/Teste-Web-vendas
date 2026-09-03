-- CreateEnum
CREATE TYPE "ReturnItemDisposition" AS ENUM ('PENDING', 'RESTOCKED', 'DISCARDED');

-- AlterTable
ALTER TABLE "ReturnItem" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedByEmail" TEXT,
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "disposition" "ReturnItemDisposition" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "dispositionNotes" TEXT,
ADD COLUMN     "receivedQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "restockLotId" TEXT;

-- CreateIndex
CREATE INDEX "ReturnItem_disposition_idx" ON "ReturnItem"("disposition");

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_restockLotId_fkey" FOREIGN KEY ("restockLotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Devoluções que já haviam sido recebidas antes da quarentena existir: o que
-- voltou ao estoque naquele fluxo já está lá, então a história fica coerente
-- marcando-as como decididas. Só as futuras passam pela conferência sanitária.
UPDATE "ReturnItem" AS ri
   SET "receivedQty" = ri."qty",
       "disposition" = CASE WHEN ri."restockQty" > 0 THEN 'RESTOCKED'::"ReturnItemDisposition"
                            ELSE 'DISCARDED'::"ReturnItemDisposition" END,
       "decidedAt"   = rr."receivedAt"
  FROM "ReturnRequest" AS rr
 WHERE rr."id" = ri."returnRequestId"
   AND rr."status" IN ('RECEIVED', 'COMPLETED');
