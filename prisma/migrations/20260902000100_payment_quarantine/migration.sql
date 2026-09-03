-- Cobrança cujo valor/moeda diverge do total do pedido. O dinheiro pode estar
-- retido no provedor, então este estado tira o pagamento de todo automatismo
-- (confirmação, cancelamento e expiração de reserva) até a conciliação manual.
ALTER TYPE "PaymentStatus" ADD VALUE 'QUARANTINED';
