-- O código já usa Stripe desde antes desta migração. No caminho normal,
-- renomear preserva todas as linhas. Alguns bancos legados receberam STRIPE
-- por db push e ainda conservaram PAGBANK; nesse estado, normalize as linhas e
-- recrie o enum sem o rótulo obsoleto (PostgreSQL não permite removê-lo).
DO $$
DECLARE
  has_pagbank BOOLEAN;
  has_stripe BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum value
    INNER JOIN pg_type kind ON kind.oid = value.enumtypid
    WHERE kind.typname = 'PaymentProvider' AND value.enumlabel = 'PAGBANK'
  ) INTO has_pagbank;
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum value
    INNER JOIN pg_type kind ON kind.oid = value.enumtypid
    WHERE kind.typname = 'PaymentProvider' AND value.enumlabel = 'STRIPE'
  ) INTO has_stripe;

  IF has_pagbank AND NOT has_stripe THEN
    ALTER TYPE "PaymentProvider" RENAME VALUE 'PAGBANK' TO 'STRIPE';
  ELSIF has_pagbank AND has_stripe THEN
    ALTER TABLE "Payment" ALTER COLUMN "provider" DROP DEFAULT;
    UPDATE "Payment" SET "provider" = 'STRIPE' WHERE "provider" = 'PAGBANK';
    ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_legacy";
    CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PIX', 'CASH');
    ALTER TABLE "Payment"
      ALTER COLUMN "provider" TYPE "PaymentProvider"
      USING ("provider"::text::"PaymentProvider");
    DROP TYPE "PaymentProvider_legacy";
  END IF;
END $$;

ALTER TABLE "Payment" ALTER COLUMN "provider" SET DEFAULT 'STRIPE';

-- Estados explícitos evitam registrar um estorno como concluído antes da
-- confirmação do provedor.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUND_FAILED';

ALTER TABLE "Order" ADD COLUMN "checkoutKey" TEXT;
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");

ALTER TABLE "Payment"
  ADD COLUMN "refundId" TEXT,
  ADD COLUMN "refundError" TEXT,
  ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "failedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_refundId_key" ON "Payment"("refundId");
