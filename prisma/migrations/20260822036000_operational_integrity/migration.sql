-- Integridade operacional: credenciais por unidade, ciclo de vida de farmácias,
-- cobertura de CEP sem ambiguidade e caixas de saída duráveis.

CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');
CREATE TYPE "StorageDeletionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "Pharmacy"
  ADD COLUMN "integrationTokenLastUsedAt" TIMESTAMP(3),
  ADD COLUMN "integrationTokenRotatedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "PharmacyCepRange"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Pharmacy"
    WHERE "integrationTokenHash" IS NOT NULL
    GROUP BY "integrationTokenHash"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem hashes de token de integração duplicados';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Pharmacy"
    WHERE "integrationTokenHash" IS NOT NULL
      AND "integrationTokenHash" !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: existe hash de token de integração inválido';
  END IF;

  IF (SELECT COUNT(*) FROM "Pharmacy" WHERE "type" = 'MATRIZ') > 1 THEN
    RAISE EXCEPTION 'Migration bloqueada: existe mais de uma farmácia MATRIZ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PharmacyCepRange" a
    JOIN "PharmacyCepRange" b ON a."id" < b."id"
    WHERE int4range(a."start", a."end", '[]') && int4range(b."start", b."end", '[]')
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem faixas de CEP sobrepostas';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PharmacyCepRange"
    WHERE "start" < 0 OR "end" > 99999999 OR "start" > "end" OR ("km" IS NOT NULL AND "km" < 0)
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: existe faixa de CEP ou distância inválida';
  END IF;
END $$;

UPDATE "Pharmacy"
SET "integrationTokenRotatedAt" = "updatedAt"
WHERE "integrationTokenHash" IS NOT NULL;

CREATE UNIQUE INDEX "Pharmacy_integrationTokenHash_key"
  ON "Pharmacy"("integrationTokenHash");
CREATE UNIQUE INDEX "Pharmacy_single_active_record_matrix_key"
  ON "Pharmacy" ((true))
  WHERE "type" = 'MATRIZ' AND "archivedAt" IS NULL;
CREATE INDEX "Pharmacy_active_archivedAt_idx"
  ON "Pharmacy"("active", "archivedAt");

ALTER TABLE "Pharmacy"
  ADD CONSTRAINT "Pharmacy_integration_token_hash_check"
    CHECK ("integrationTokenHash" IS NULL OR "integrationTokenHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "Pharmacy_archived_inactive_check"
    CHECK ("archivedAt" IS NULL OR NOT "active"),
  ADD CONSTRAINT "Pharmacy_matrix_not_archived_check"
    CHECK ("type" <> 'MATRIZ' OR "archivedAt" IS NULL),
  ADD CONSTRAINT "Pharmacy_archived_token_revoked_check"
    CHECK ("archivedAt" IS NULL OR "integrationTokenHash" IS NULL);

ALTER TABLE "PharmacyCepRange"
  ADD CONSTRAINT "PharmacyCepRange_valid_bounds_check"
    CHECK ("start" >= 0 AND "end" <= 99999999 AND "start" <= "end"),
  ADD CONSTRAINT "PharmacyCepRange_nonnegative_km_check"
    CHECK ("km" IS NULL OR "km" >= 0),
  ADD CONSTRAINT "PharmacyCepRange_no_overlap_excl"
    EXCLUDE USING gist (int4range("start", "end", '[]') WITH &&)
    WHERE ("archivedAt" IS NULL);

CREATE INDEX "PharmacyCepRange_archivedAt_idx"
  ON "PharmacyCepRange"("archivedAt");

CREATE TABLE "SubscriptionNotification" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionNotification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SubscriptionNotification"
  ADD CONSTRAINT "SubscriptionNotification_attempts_check"
    CHECK ("attempts" >= 0);

CREATE UNIQUE INDEX "SubscriptionNotification_subscriptionId_dueAt_key"
  ON "SubscriptionNotification"("subscriptionId", "dueAt");
CREATE INDEX "SubscriptionNotification_status_nextAttemptAt_idx"
  ON "SubscriptionNotification"("status", "nextAttemptAt");
ALTER TABLE "SubscriptionNotification"
  ADD CONSTRAINT "SubscriptionNotification_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StorageDeletionTask" (
  "id" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "status" "StorageDeletionStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorageDeletionTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StorageDeletionTask"
  ADD CONSTRAINT "StorageDeletionTask_attempts_check"
    CHECK ("attempts" >= 0),
  ADD CONSTRAINT "StorageDeletionTask_key_check"
    CHECK (char_length("storageKey") BETWEEN 1 AND 1024);

CREATE UNIQUE INDEX "StorageDeletionTask_storageKey_key"
  ON "StorageDeletionTask"("storageKey");
CREATE INDEX "StorageDeletionTask_status_nextAttemptAt_idx"
  ON "StorageDeletionTask"("status", "nextAttemptAt");
