CREATE TYPE "ReturnStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'COMPLETED',
  'CANCELED'
);

CREATE TYPE "ReturnReason" AS ENUM (
  'WITHDRAWAL',
  'DAMAGED',
  'WRONG_ITEM',
  'QUALITY',
  'OTHER'
);

CREATE TABLE "InventoryLot" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "pharmacyId" TEXT NOT NULL,
  "lotCode" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "qty" INTEGER NOT NULL,
  "supplier" TEXT,
  "note" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_lot_qty_nonnegative" CHECK ("qty" >= 0),
  CONSTRAINT "inventory_lot_code_not_blank" CHECK (char_length(btrim("lotCode")) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX "InventoryLot_productId_pharmacyId_lotCode_key"
  ON "InventoryLot"("productId", "pharmacyId", "lotCode");
CREATE INDEX "InventoryLot_pharmacyId_expiresAt_qty_idx"
  ON "InventoryLot"("pharmacyId", "expiresAt", "qty");
CREATE INDEX "InventoryLot_productId_pharmacyId_idx"
  ON "InventoryLot"("productId", "pharmacyId");

ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReturnRequest" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pharmacyId" TEXT NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
  "reason" "ReturnReason" NOT NULL,
  "customerNotes" TEXT,
  "adminNotes" TEXT,
  "requestedAmount" DECIMAL(12, 2) NOT NULL,
  "approvedAmount" DECIMAL(12, 2),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "return_requested_amount_nonnegative" CHECK ("requestedAmount" >= 0),
  CONSTRAINT "return_approved_amount_valid" CHECK (
    "approvedAmount" IS NULL OR (
      "approvedAmount" >= 0 AND "approvedAmount" <= "requestedAmount"
    )
  )
);

CREATE INDEX "ReturnRequest_orderId_status_idx" ON "ReturnRequest"("orderId", "status");
CREATE INDEX "ReturnRequest_userId_createdAt_idx" ON "ReturnRequest"("userId", "createdAt");
CREATE INDEX "ReturnRequest_pharmacyId_status_createdAt_idx"
  ON "ReturnRequest"("pharmacyId", "status", "createdAt");
CREATE UNIQUE INDEX "ReturnRequest_one_active_per_order_key"
  ON "ReturnRequest"("orderId")
  WHERE "status" IN ('REQUESTED', 'APPROVED', 'RECEIVED');

ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ReturnItem" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "restockQty" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "return_item_qty_positive" CHECK ("qty" > 0),
  CONSTRAINT "return_item_restock_valid" CHECK ("restockQty" >= 0 AND "restockQty" <= "qty")
);

CREATE UNIQUE INDEX "ReturnItem_returnRequestId_orderItemId_key"
  ON "ReturnItem"("returnRequestId", "orderItemId");
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");

ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
