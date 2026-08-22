-- Corrige dados legados antes de garantir no banco que cada usuário possua no
-- máximo um endereço padrão.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "userId" ORDER BY "createdAt" ASC, "id" ASC
  ) AS position
  FROM "Address"
  WHERE "isDefault" = TRUE
)
UPDATE "Address" AS address
SET "isDefault" = FALSE
FROM ranked
WHERE address."id" = ranked."id" AND ranked.position > 1;

CREATE UNIQUE INDEX "Address_one_default_per_user_key"
ON "Address"("userId")
WHERE "isDefault" = TRUE;
