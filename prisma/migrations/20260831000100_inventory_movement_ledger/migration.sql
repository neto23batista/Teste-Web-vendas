CREATE TYPE "InventoryMovementKind" AS ENUM (
  'MANUAL_ADJUSTMENT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'SALE',
  'CANCELLATION',
  'RETURN',
  'RECEIPT',
  'LOSS',
  'SYNC',
  'RESERVATION',
  'RELEASE'
);

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "pharmacyId" TEXT NOT NULL,
  "kind" "InventoryMovementKind" NOT NULL,
  "delta" INTEGER NOT NULL,
  "stockBefore" INTEGER NOT NULL,
  "stockAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_movement_nonzero_delta" CHECK ("delta" <> 0),
  CONSTRAINT "inventory_movement_nonnegative_stock" CHECK (
    "stockBefore" >= 0 AND "stockAfter" >= 0
  ),
  CONSTRAINT "inventory_movement_balances" CHECK (
    "stockAfter" = "stockBefore" + "delta"
  ),
  CONSTRAINT "inventory_movement_reason_present" CHECK (
    char_length(btrim("reason")) BETWEEN 1 AND 500
  )
);

CREATE INDEX "InventoryMovement_productId_pharmacyId_createdAt_idx"
  ON "InventoryMovement"("productId", "pharmacyId", "createdAt");
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx"
  ON "InventoryMovement"("referenceType", "referenceId");
CREATE INDEX "InventoryMovement_createdAt_idx"
  ON "InventoryMovement"("createdAt");
