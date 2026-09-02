-- Observabilidade e idempotência dos pagamentos ficam persistidas, inclusive
-- quando webhooks chegam repetidos ou a API externa precisa ser reconciliada.
CREATE TYPE "StripeEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "ReturnRefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "Payment"
  ADD COLUMN "lastReconciledAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconciliationError" TEXT;

ALTER TABLE "ReturnRequest"
  ADD COLUMN "refundStatus" "ReturnRefundStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "refundId" TEXT,
  ADD COLUMN "refundError" TEXT,
  ADD COLUMN "refundedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ReturnRequest_refundId_key" ON "ReturnRequest"("refundId");

CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "status" "StripeEventStatus" NOT NULL DEFAULT 'PROCESSING',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StripeEvent_attempts_check" CHECK ("attempts" > 0),
    CONSTRAINT "StripeEvent_payloadSha256_check" CHECK (length("payloadSha256") = 64)
);

CREATE INDEX "StripeEvent_status_updatedAt_idx" ON "StripeEvent"("status", "updatedAt");
CREATE INDEX "StripeEvent_type_receivedAt_idx" ON "StripeEvent"("type", "receivedAt");
