-- Remove definitivamente a integração legada com o PDV InovaFarma.
-- As tabelas são exclusivas do conector e não participam do fluxo interno da loja.
DROP TABLE IF EXISTS "SyncRun";
DROP TABLE IF EXISTS "OrderExport";

ALTER TABLE "Pharmacy"
  DROP CONSTRAINT IF EXISTS "Pharmacy_archived_token_revoked_check",
  DROP CONSTRAINT IF EXISTS "Pharmacy_integration_token_hash_check";

DROP INDEX IF EXISTS "Pharmacy_integrationTokenHash_key";

ALTER TABLE "Pharmacy"
  DROP COLUMN IF EXISTS "integrationTokenLastUsedAt",
  DROP COLUMN IF EXISTS "integrationTokenRotatedAt",
  DROP COLUMN IF EXISTS "integrationTokenHash";

DROP TYPE IF EXISTS "SyncKind";
DROP TYPE IF EXISTS "ExportStatus";
