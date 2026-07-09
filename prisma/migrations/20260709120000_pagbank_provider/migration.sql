-- Troca do provedor de pagamento: Mercado Pago → PagBank.
-- RENAME preserva as linhas existentes (histórico de pagamentos antigos
-- passa a ler PAGBANK — o provedor ativo do sistema).
ALTER TYPE "PaymentProvider" RENAME VALUE 'MERCADO_PAGO' TO 'PAGBANK';

-- Default acompanha o novo nome.
ALTER TABLE "Payment" ALTER COLUMN "provider" SET DEFAULT 'PAGBANK';
