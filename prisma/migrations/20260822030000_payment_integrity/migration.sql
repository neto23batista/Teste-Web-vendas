-- O código já usa Stripe desde antes desta migração. Renomear o valor do
-- enum preserva todas as linhas e corrige o provedor sem UPDATE destrutivo.
ALTER TYPE "PaymentProvider" RENAME VALUE 'PAGBANK' TO 'STRIPE';

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
