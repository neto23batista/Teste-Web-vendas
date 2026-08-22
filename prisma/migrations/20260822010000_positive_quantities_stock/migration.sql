-- Defesa em profundidade contra quantidades negativas/fracionárias vindas de
-- chamadas diretas às Server Actions ou de integrações. As colunas são INTEGER;
-- os CHECKs garantem o sinal mesmo para gravações que não passam pelo Prisma.

-- Carrinhos são temporários: remove apenas linhas já corrompidas para que a
-- constraint possa ser validada imediatamente. O cliente pode adicionar o item
-- novamente com uma quantidade válida.
DELETE FROM "CartItem" WHERE "qty" <= 0 OR "qty" > 99;

-- Não altera silenciosamente histórico financeiro nem estoque. Se houver dado
-- legado inválido, a migração para e exige auditoria/correção manual.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "OrderItem" WHERE "qty" <= 0 OR "qty" > 99) THEN
    RAISE EXCEPTION 'OrderItem possui quantidade fora do intervalo 1..99; audite os pedidos antes de aplicar a constraint';
  END IF;
  IF EXISTS (SELECT 1 FROM "Inventory" WHERE "stock" < 0) THEN
    RAISE EXCEPTION 'Inventory possui estoque negativo; audite o estoque antes de aplicar a constraint';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Subscription"
    WHERE "qty" NOT BETWEEN 1 AND 10
       OR "intervalDays" NOT IN (30, 60, 90)
  ) THEN
    RAISE EXCEPTION 'Subscription possui quantidade ou intervalo inválido; audite as assinaturas antes de aplicar a constraint';
  END IF;
END $$;

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_qty_valid" CHECK ("qty" BETWEEN 1 AND 99);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_qty_valid" CHECK ("qty" BETWEEN 1 AND 99);

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_stock_nonnegative" CHECK ("stock" >= 0);

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_qty_valid" CHECK ("qty" BETWEEN 1 AND 10),
  ADD CONSTRAINT "Subscription_interval_valid" CHECK ("intervalDays" IN (30, 60, 90));
