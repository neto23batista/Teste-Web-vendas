-- Interrompe com uma mensagem acionavel antes de qualquer cast que poderia
-- falhar por NaN/infinito ou estouro de DECIMAL(12,2).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "price" AS value FROM "Product"
      UNION ALL SELECT "costPrice" FROM "Product"
      UNION ALL SELECT "promoPrice" FROM "Product"
      UNION ALL SELECT "subtotal" FROM "Order"
      UNION ALL SELECT "discount" FROM "Order"
      UNION ALL SELECT "shipping" FROM "Order"
      UNION ALL SELECT "total" FROM "Order"
      UNION ALL SELECT "price" FROM "OrderItem"
      UNION ALL SELECT "amount" FROM "Payment"
      UNION ALL SELECT "value" FROM "Coupon"
      UNION ALL SELECT "minTotal" FROM "Coupon"
      UNION ALL SELECT "shippingFlat" FROM "Pharmacy"
      UNION ALL SELECT "shippingFreeMin" FROM "Pharmacy"
      UNION ALL SELECT "amount" FROM "Expense"
      UNION ALL SELECT "amount" FROM "BankTransaction"
    ) AS money
    WHERE value IS NOT NULL
      AND (
        value::text IN ('NaN', 'Infinity', '-Infinity')
        OR abs(value) > 9999999999.99
      )
  ) THEN
    RAISE EXCEPTION 'Ha valor monetario nao finito ou fora de DECIMAL(12,2); saneie o legado antes da migration';
  END IF;
END $$;

-- Valores financeiros deixam de usar ponto flutuante binário. O ROUND antes
-- do cast congela exatamente os centavos que a aplicação já exibia/cobrava.
ALTER TABLE "Product"
  ALTER COLUMN "price" TYPE DECIMAL(12,2) USING ROUND("price"::numeric, 2),
  ALTER COLUMN "costPrice" TYPE DECIMAL(12,2) USING ROUND("costPrice"::numeric, 2),
  ALTER COLUMN "promoPrice" TYPE DECIMAL(12,2) USING ROUND("promoPrice"::numeric, 2);

ALTER TABLE "Order"
  ALTER COLUMN "subtotal" TYPE DECIMAL(12,2) USING ROUND("subtotal"::numeric, 2),
  ALTER COLUMN "discount" TYPE DECIMAL(12,2) USING ROUND("discount"::numeric, 2),
  ALTER COLUMN "shipping" TYPE DECIMAL(12,2) USING ROUND("shipping"::numeric, 2),
  ALTER COLUMN "total" TYPE DECIMAL(12,2) USING ROUND("total"::numeric, 2);

ALTER TABLE "OrderItem"
  ALTER COLUMN "price" TYPE DECIMAL(12,2) USING ROUND("price"::numeric, 2);

ALTER TABLE "Payment"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "Coupon"
  ALTER COLUMN "value" TYPE DECIMAL(12,2) USING ROUND("value"::numeric, 2),
  ALTER COLUMN "minTotal" TYPE DECIMAL(12,2) USING ROUND("minTotal"::numeric, 2);

ALTER TABLE "Pharmacy"
  ALTER COLUMN "shippingFlat" TYPE DECIMAL(12,2) USING ROUND("shippingFlat"::numeric, 2),
  ALTER COLUMN "shippingFreeMin" TYPE DECIMAL(12,2) USING ROUND("shippingFreeMin"::numeric, 2);

ALTER TABLE "Expense"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "BankTransaction"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

-- O endereço relacionado pode ser editado ou removido depois da compra. Estes
-- campos passam a ser a fonte imutável do comprovante e das integrações.
ALTER TABLE "Order"
  ADD COLUMN "customerName" TEXT,
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "customerCpf" TEXT,
  ADD COLUMN "customerPhone" TEXT,
  ADD COLUMN "shippingRecipient" TEXT,
  ADD COLUMN "shippingZip" TEXT,
  ADD COLUMN "shippingStreet" TEXT,
  ADD COLUMN "shippingNumber" TEXT,
  ADD COLUMN "shippingComplement" TEXT,
  ADD COLUMN "shippingDistrict" TEXT,
  ADD COLUMN "shippingCity" TEXT,
  ADD COLUMN "shippingState" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "Order" AS o
SET
  "shippingRecipient" = NULLIF(a."recipient", ''),
  "shippingZip" = COALESCE(a."zip", ''),
  "shippingStreet" = COALESCE(a."street", ''),
  "shippingNumber" = COALESCE(a."number", ''),
  "shippingComplement" = NULLIF(a."complement", ''),
  "shippingDistrict" = COALESCE(a."district", ''),
  "shippingCity" = COALESCE(a."city", ''),
  "shippingState" = COALESCE(a."state", '')
FROM "Address" AS a
WHERE a."id" = o."addressId";

UPDATE "Order" AS o
SET
  "customerName" = COALESCE(NULLIF(u."name", ''), 'Cliente não identificado'),
  "customerEmail" = COALESCE(u."email", ''),
  "customerCpf" = NULLIF(u."cpf", ''),
  "customerPhone" = NULLIF(u."phone", ''),
  "shippingRecipient" = COALESCE(o."shippingRecipient", NULLIF(u."name", ''), 'Destinatário não informado'),
  "shippingZip" = COALESCE(o."shippingZip", ''),
  "shippingStreet" = COALESCE(o."shippingStreet", ''),
  "shippingNumber" = COALESCE(o."shippingNumber", ''),
  "shippingDistrict" = COALESCE(o."shippingDistrict", ''),
  "shippingCity" = COALESCE(o."shippingCity", ''),
  "shippingState" = COALESCE(o."shippingState", '')
FROM "User" AS u
WHERE u."id" = o."userId";

ALTER TABLE "Order"
  ALTER COLUMN "customerName" SET NOT NULL,
  ALTER COLUMN "customerEmail" SET NOT NULL,
  ALTER COLUMN "shippingRecipient" SET NOT NULL,
  ALTER COLUMN "shippingZip" SET NOT NULL,
  ALTER COLUMN "shippingStreet" SET NOT NULL,
  ALTER COLUMN "shippingNumber" SET NOT NULL,
  ALTER COLUMN "shippingDistrict" SET NOT NULL,
  ALTER COLUMN "shippingCity" SET NOT NULL,
  ALTER COLUMN "shippingState" SET NOT NULL;

CREATE INDEX "Order_archivedAt_createdAt_idx"
  ON "Order"("archivedAt", "createdAt");

-- Os snapshots pertencem ao fato historico do pedido. Alteracoes posteriores
-- em User/Address (inclusive anonimizacao da conta) nao podem reescreve-los.
CREATE FUNCTION "prevent_order_snapshot_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."customerName" IS DISTINCT FROM OLD."customerName"
     OR NEW."customerEmail" IS DISTINCT FROM OLD."customerEmail"
     OR NEW."customerCpf" IS DISTINCT FROM OLD."customerCpf"
     OR NEW."customerPhone" IS DISTINCT FROM OLD."customerPhone"
     OR NEW."shippingRecipient" IS DISTINCT FROM OLD."shippingRecipient"
     OR NEW."shippingZip" IS DISTINCT FROM OLD."shippingZip"
     OR NEW."shippingStreet" IS DISTINCT FROM OLD."shippingStreet"
     OR NEW."shippingNumber" IS DISTINCT FROM OLD."shippingNumber"
     OR NEW."shippingComplement" IS DISTINCT FROM OLD."shippingComplement"
     OR NEW."shippingDistrict" IS DISTINCT FROM OLD."shippingDistrict"
     OR NEW."shippingCity" IS DISTINCT FROM OLD."shippingCity"
     OR NEW."shippingState" IS DISTINCT FROM OLD."shippingState"
  THEN
    RAISE EXCEPTION 'Os snapshots de cliente e entrega do pedido sao imutaveis';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Order_snapshot_immutable"
BEFORE UPDATE ON "Order"
FOR EACH ROW
EXECUTE FUNCTION "prevent_order_snapshot_mutation"();

-- Preflight explícito: não escondemos legado inválido em constraints
-- indefinidamente NOT VALID. Se houver inconsistência, a migration aborta com
-- o conjunto exato a sanear e nada é aplicado parcialmente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Product"
    WHERE "price" < 0 OR "price"::text IN ('NaN', 'Infinity', '-Infinity')
       OR ("costPrice" IS NOT NULL AND ("costPrice" < 0 OR "costPrice"::text IN ('NaN', 'Infinity', '-Infinity')))
       OR ("promoPrice" IS NOT NULL AND ("promoPrice" < 0 OR "promoPrice"::text IN ('NaN', 'Infinity', '-Infinity')))
  ) THEN RAISE EXCEPTION 'Product possui preço/custo negativo ou não finito';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Order"
    WHERE "subtotal"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "discount"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "shipping"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "total"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "subtotal" < 0 OR "discount" < 0 OR "shipping" < 0 OR "total" < 0
       OR "discount" > "subtotal"
       OR "total" <> "subtotal" - "discount" + "shipping"
  ) THEN RAISE EXCEPTION 'Order possui totais monetários inconsistentes';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "OrderItem"
    WHERE "price" < 0 OR "price"::text IN ('NaN', 'Infinity', '-Infinity')
  ) THEN
    RAISE EXCEPTION 'OrderItem possui preço negativo';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Payment"
    WHERE "amount" < 0 OR "amount"::text IN ('NaN', 'Infinity', '-Infinity')
  ) THEN
    RAISE EXCEPTION 'Payment possui valor negativo';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Coupon"
    WHERE "value"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "minTotal"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "value" < 0 OR "minTotal" < 0 OR ("type" = 'PERCENT' AND "value" > 100)
  ) THEN RAISE EXCEPTION 'Coupon possui valor fora dos limites';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Pharmacy"
    WHERE ("shippingFlat" IS NOT NULL AND (
            "shippingFlat" < 0 OR "shippingFlat"::text IN ('NaN', 'Infinity', '-Infinity')
          ))
       OR ("shippingFreeMin" IS NOT NULL AND (
            "shippingFreeMin" < 0 OR "shippingFreeMin"::text IN ('NaN', 'Infinity', '-Infinity')
          ))
  ) THEN RAISE EXCEPTION 'Pharmacy possui frete negativo';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Expense"
    WHERE "amount" <= 0 OR "amount"::text IN ('NaN', 'Infinity', '-Infinity')
  ) THEN
    RAISE EXCEPTION 'Expense possui valor não positivo';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "BankTransaction"
    WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')
  ) THEN
    RAISE EXCEPTION 'BankTransaction possui valor nao finito';
  END IF;
END $$;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_money_nonnegative" CHECK (
    "price"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND "price" >= 0 AND
    ("costPrice" IS NULL OR (
      "costPrice"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND "costPrice" >= 0
    )) AND
    ("promoPrice" IS NULL OR (
      "promoPrice"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND "promoPrice" >= 0
    ))
  );

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_money_consistent" CHECK (
    "subtotal"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND
    "discount"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND
    "shipping"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND
    "total"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND
    "subtotal" >= 0 AND "discount" >= 0 AND "shipping" >= 0 AND "total" >= 0 AND
    "discount" <= "subtotal" AND
    "total" = "subtotal" - "discount" + "shipping"
  );

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_price_nonnegative" CHECK (
    "price"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND "price" >= 0
  );

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_nonnegative" CHECK (
    "amount"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND "amount" >= 0
  );

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_value_valid" CHECK (
    "value"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND
    "minTotal"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND
    "value" >= 0 AND "minTotal" >= 0 AND
    ("type" <> 'PERCENT' OR "value" <= 100)
  );

ALTER TABLE "Pharmacy"
  ADD CONSTRAINT "Pharmacy_shipping_nonnegative" CHECK (
    ("shippingFlat" IS NULL OR (
      "shippingFlat"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND "shippingFlat" >= 0
    )) AND
    ("shippingFreeMin" IS NULL OR (
      "shippingFreeMin"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND "shippingFreeMin" >= 0
    ))
  );

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_amount_positive" CHECK (
    "amount"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND "amount" > 0
  );

ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_amount_finite" CHECK (
    "amount"::text NOT IN ('NaN', 'Infinity', '-Infinity')
  );
