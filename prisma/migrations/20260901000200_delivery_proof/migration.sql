CREATE TYPE "DeliveryProofMethod" AS ENUM (
  'RECIPIENT',
  'CONCIERGE',
  'SAFE_PLACE',
  'PICKUP'
);

CREATE TABLE "DeliveryProof" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "method" "DeliveryProofMethod" NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientDocumentLast4" TEXT,
  "notes" TEXT,
  "courierName" TEXT,
  "confirmedById" TEXT,
  "confirmedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_proof_recipient_name" CHECK (
    char_length(btrim("recipientName")) BETWEEN 2 AND 160
  ),
  CONSTRAINT "delivery_proof_document_last4" CHECK (
    "recipientDocumentLast4" IS NULL OR "recipientDocumentLast4" ~ '^[0-9]{4}$'
  )
);

CREATE UNIQUE INDEX "DeliveryProof_orderId_key" ON "DeliveryProof"("orderId");
CREATE INDEX "DeliveryProof_createdAt_idx" ON "DeliveryProof"("createdAt");

ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
