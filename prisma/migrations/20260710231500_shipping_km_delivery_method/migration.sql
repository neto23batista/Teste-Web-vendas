-- Frete por km e Entrega Rápida.
-- 1) Distância (km) por faixa de CEP da unidade — base do frete por distância.
ALTER TABLE "PharmacyCepRange" ADD COLUMN "km" DOUBLE PRECISION;

-- 2) Modalidade de entrega do pedido: "standard" (padrão) ou "express" (rápida).
ALTER TABLE "Order" ADD COLUMN "deliveryMethod" TEXT NOT NULL DEFAULT 'standard';
