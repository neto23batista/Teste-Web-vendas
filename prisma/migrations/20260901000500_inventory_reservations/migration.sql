-- Reserva o estoque no momento em que o pedido é criado. O saldo de Inventory
-- passa a representar somente a disponibilidade para novas compras.
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED');

CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryReservation_qty_check" CHECK ("qty" > 0),
    CONSTRAINT "InventoryReservation_state_dates_check" CHECK (
      ("status" = 'ACTIVE' AND "committedAt" IS NULL AND "releasedAt" IS NULL)
      OR ("status" = 'COMMITTED' AND "committedAt" IS NOT NULL AND "releasedAt" IS NULL)
      OR ("status" = 'RELEASED' AND "releasedAt" IS NOT NULL)
    )
);

CREATE TABLE "InventoryReservationLot" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "InventoryReservationLot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryReservationLot_qty_check" CHECK ("qty" > 0)
);

CREATE UNIQUE INDEX "InventoryReservation_orderItemId_key"
  ON "InventoryReservation"("orderItemId");
CREATE INDEX "InventoryReservation_orderId_status_idx"
  ON "InventoryReservation"("orderId", "status");
CREATE INDEX "InventoryReservation_status_expiresAt_idx"
  ON "InventoryReservation"("status", "expiresAt");
CREATE INDEX "InventoryReservation_productId_pharmacyId_status_idx"
  ON "InventoryReservation"("productId", "pharmacyId", "status");
CREATE UNIQUE INDEX "InventoryReservationLot_reservationId_lotId_key"
  ON "InventoryReservationLot"("reservationId", "lotId");
CREATE INDEX "InventoryReservationLot_lotId_idx"
  ON "InventoryReservationLot"("lotId");

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservationLot"
  ADD CONSTRAINT "InventoryReservationLot_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryReservationLot"
  ADD CONSTRAINT "InventoryReservationLot_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
