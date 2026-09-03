-- Política MIP-only no nível do banco: item sujeito a receita nunca fica ativo.
--
-- A aplicação já impede isso em updateProduct, toggleProductActive e na
-- importação CSV, e agora também na sacola e no checkout. Esta constraint é a
-- última linha: fecha escrita direta no banco, script de migração de dados e
-- qualquer caminho futuro que esqueça a regra.

-- Normaliza o que estiver violando antes de travar. Desativar é exatamente o
-- que a aplicação faria com esses registros — não há perda de dado.
UPDATE "Product"
   SET "active" = FALSE
 WHERE "active" = TRUE
   AND "requiresPrescription" = TRUE;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_prescription_never_active"
  CHECK (NOT ("active" AND "requiresPrescription"));
