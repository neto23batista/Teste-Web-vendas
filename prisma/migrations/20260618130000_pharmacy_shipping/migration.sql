-- Frete por unidade: colunas opcionais em Pharmacy (override do frete global em Setting).
-- Aditiva e segura: nullable, sem default obrigatório; código cai no global quando null.
ALTER TABLE "Pharmacy" ADD COLUMN "shippingFlat" DOUBLE PRECISION;
ALTER TABLE "Pharmacy" ADD COLUMN "shippingFreeMin" DOUBLE PRECISION;
