-- Search/index support for the public catalog and InovaFarma synchronization.
--
-- Deployment prerequisite: the migration role must be allowed to install the
-- trusted PostgreSQL extension `pg_trgm` (normally CREATE on the database is
-- sufficient; some managed providers require enabling it in their console).
-- Indexes are intentionally NOT created CONCURRENTLY so this file remains safe
-- when Prisma applies migrations inside a transaction. Schedule the deployment
-- for a low-write window on an already large Product table.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Exact/In-list EAN matching used by catalog preload and its per-item fallback.
-- NULL rows cannot satisfy these predicates, so the partial index stays small.
CREATE INDEX "Product_ean_idx"
  ON "Product" USING btree ("ean")
  WHERE "ean" IS NOT NULL;

-- Public search always implies active=true and requiresPrescription=false.
-- Its current predicates are ILIKE '%term%', which can use trigram GIN indexes;
-- a tsvector/FTS index would remain unused until the query itself adopts @@.
CREATE INDEX "Product_name_trgm_saleable_idx"
  ON "Product" USING gin ("name" gin_trgm_ops)
  WHERE "active" = TRUE AND "requiresPrescription" = FALSE;

CREATE INDEX "Product_description_trgm_saleable_idx"
  ON "Product" USING gin ("description" gin_trgm_ops)
  WHERE "active" = TRUE AND "requiresPrescription" = FALSE;

CREATE INDEX "Product_activeIngredient_trgm_saleable_idx"
  ON "Product" USING gin ("activeIngredient" gin_trgm_ops)
  WHERE "active" = TRUE
    AND "requiresPrescription" = FALSE;

CREATE INDEX "Product_sku_trgm_saleable_idx"
  ON "Product" USING gin ("sku" gin_trgm_ops)
  WHERE "active" = TRUE
    AND "requiresPrescription" = FALSE;

CREATE INDEX "Product_ean_trgm_saleable_idx"
  ON "Product" USING gin ("ean" gin_trgm_ops)
  WHERE "active" = TRUE
    AND "requiresPrescription" = FALSE;

-- Brand.name participates in the same ILIKE OR predicate through the Brand join.
CREATE INDEX "Brand_name_trgm_idx"
  ON "Brand" USING gin ("name" gin_trgm_ops);
