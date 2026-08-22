-- Um usuário autenticado deve possuir no máximo um carrinho. O índice parcial
-- mantém múltiplos carrinhos convidados (userId NULL) válidos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Cart"
    WHERE "userId" IS NOT NULL
    GROUP BY "userId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existem carrinhos duplicados por usuário. Consolide-os antes desta migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Cart_userId_unique_not_null"
ON "Cart" ("userId")
WHERE "userId" IS NOT NULL;
