-- Invalidação imediata de JWTs, MFA TOTP administrativo e evidência
-- versionada dos aceites legais. Campos sensíveis nunca são armazenados em claro.
CREATE TYPE "PolicyKind" AS ENUM (
  'TERMS_ACCEPTANCE',
  'PRIVACY_ACKNOWLEDGEMENT'
);

ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mfaSecretEncrypted" TEXT,
  ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);

ALTER TABLE "User"
  ADD CONSTRAINT "User_sessionVersion_nonnegative"
    CHECK ("sessionVersion" >= 0),
  ADD CONSTRAINT "User_mfa_enabled_requires_secret"
    CHECK ("mfaEnabledAt" IS NULL OR "mfaSecretEncrypted" IS NOT NULL);

CREATE TABLE "MfaRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt" TIMESTAMP(3),

  CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key"
  ON "MfaRecoveryCode"("codeHash");
CREATE INDEX "MfaRecoveryCode_userId_usedAt_idx"
  ON "MfaRecoveryCode"("userId", "usedAt");

ALTER TABLE "MfaRecoveryCode"
  ADD CONSTRAINT "MfaRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PolicyAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "PolicyKind" NOT NULL,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PolicyAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PolicyAcceptance_userId_kind_version_key"
  ON "PolicyAcceptance"("userId", "kind", "version");
CREATE INDEX "PolicyAcceptance_userId_acceptedAt_idx"
  ON "PolicyAcceptance"("userId", "acceptedAt");

ALTER TABLE "PolicyAcceptance"
  ADD CONSTRAINT "PolicyAcceptance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
