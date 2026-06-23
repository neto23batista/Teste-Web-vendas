-- Dados regulatórios (ANVISA) por unidade: override do global. NULL = usa o global.
ALTER TABLE "Pharmacy" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "Pharmacy" ADD COLUMN "pharmacistName" TEXT;
ALTER TABLE "Pharmacy" ADD COLUMN "pharmacistCrf" TEXT;
