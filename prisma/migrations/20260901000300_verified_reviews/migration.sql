ALTER TABLE "Review"
  ADD COLUMN "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false;

-- Avaliações legadas recebem o selo somente quando há compra entregue do mesmo
-- usuário e produto; não confiamos apenas na existência de uma conta.
UPDATE "Review" AS review
SET "verifiedPurchase" = true
WHERE EXISTS (
  SELECT 1
  FROM "Order" AS purchase
  INNER JOIN "OrderItem" AS item ON item."orderId" = purchase."id"
  WHERE purchase."userId" = review."userId"
    AND purchase."status" = 'DELIVERED'
    AND item."productId" = review."productId"
);

CREATE INDEX "Review_verifiedPurchase_approved_idx"
  ON "Review"("verifiedPurchase", "approved");
