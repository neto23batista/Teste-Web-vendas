ALTER TABLE "Coupon"
  ADD COLUMN "usageLimitPerCustomer" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Coupon"
  ADD CONSTRAINT "coupon_usage_limit_per_customer_positive"
    CHECK ("usageLimitPerCustomer" > 0);

CREATE TABLE "CouponRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- Reconstrói o histórico possível sem inventar usos anônimos. Se um pedido foi
-- cancelado, o contador já foi devolvido e ele não entra na nova autoridade.
INSERT INTO "CouponRedemption" ("id", "couponId", "userId", "orderId", "createdAt")
SELECT
  'legacy-' || purchase."id",
  coupon."id",
  purchase."userId",
  purchase."id",
  purchase."createdAt"
FROM "Order" AS purchase
INNER JOIN "Coupon" AS coupon ON coupon."code" = purchase."couponCode"
WHERE purchase."couponCode" IS NOT NULL
  AND purchase."status" <> 'CANCELED';

CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE INDEX "CouponRedemption_couponId_userId_createdAt_idx"
  ON "CouponRedemption"("couponId", "userId", "createdAt");
CREATE INDEX "CouponRedemption_userId_createdAt_idx"
  ON "CouponRedemption"("userId", "createdAt");

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
