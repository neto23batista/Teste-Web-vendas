-- O EAN canônico identifica um único produto. Em vez de escolher um vencedor
-- silenciosamente, a migration para e exige saneamento explícito se o legado
-- contiver duplicatas.
UPDATE "Product"
SET "ean" = NULL
WHERE "ean" IS NOT NULL AND btrim("ean") = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Product"
    WHERE "ean" IS NOT NULL AND btrim("ean") <> ''
    GROUP BY "ean"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'EAN duplicado em Product; saneie os cadastros antes desta migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Product"
    WHERE "ean" IS NOT NULL AND "ean" !~ '^[0-9]{8,14}$'
  ) THEN
    RAISE EXCEPTION 'EAN inválido em Product; use somente 8 a 14 dígitos';
  END IF;
END $$;

-- Bancos legados podem já ter este índice por um db push anterior à adoção
-- integral do histórico de migrations. O preflight acima continua garantindo
-- que o conteúdo é compatível com a unicidade esperada.
CREATE UNIQUE INDEX IF NOT EXISTS "Product_ean_key" ON "Product"("ean");

ALTER TABLE "Inventory"
  ADD COLUMN "price" DECIMAL(12, 2),
  ADD COLUMN "costPrice" DECIMAL(12, 2),
  ADD COLUMN "promoPrice" DECIMAL(12, 2),
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "ean" TEXT;

-- Toda linha existente ganha uma oferta inicial igual ao catálogo canônico.
-- A partir daqui, cada unidade pode divergir sem a última sincronização vencer.
UPDATE "Inventory" AS inventory
SET
  "price" = product."price",
  "costPrice" = product."costPrice",
  "promoPrice" = product."promoPrice",
  "sku" = product."sku",
  "ean" = product."ean"
FROM "Product" AS product
WHERE product."id" = inventory."productId";

CREATE UNIQUE INDEX "Inventory_pharmacyId_sku_key"
  ON "Inventory"("pharmacyId", "sku");
CREATE UNIQUE INDEX "Inventory_pharmacyId_ean_key"
  ON "Inventory"("pharmacyId", "ean");

ALTER TABLE "Inventory"
  ADD CONSTRAINT "inventory_unit_price_nonnegative"
    CHECK ("price" IS NULL OR "price" >= 0),
  ADD CONSTRAINT "inventory_unit_cost_nonnegative"
    CHECK ("costPrice" IS NULL OR "costPrice" >= 0),
  ADD CONSTRAINT "inventory_unit_promo_valid"
    CHECK (
      "promoPrice" IS NULL
      OR ("price" IS NOT NULL AND "promoPrice" > 0 AND "promoPrice" < "price")
    );

ALTER TABLE "Product"
  ADD CONSTRAINT "product_ean_format"
    CHECK ("ean" IS NULL OR "ean" ~ '^[0-9]{8,14}$');

ALTER TABLE "Inventory"
  ADD CONSTRAINT "inventory_ean_format"
    CHECK ("ean" IS NULL OR "ean" ~ '^[0-9]{8,14}$');
