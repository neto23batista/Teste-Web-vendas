-- Limpeza do legado: o estoque agora é 100% por unidade (model Inventory).
-- Removemos as colunas globais de estoque do Product. Os dados já foram
-- migrados para Inventory na migração multi_pharmacy.
--
-- ORDEM DE APLICAÇÃO (produção): só rode DEPOIS de o código novo (que não
-- referencia mais Product.stock/minStock) estar deployado. Caso contrário, a
-- versão antiga do app quebraria ao gravar produtos.

ALTER TABLE "Product" DROP COLUMN "stock";
ALTER TABLE "Product" DROP COLUMN "minStock";
