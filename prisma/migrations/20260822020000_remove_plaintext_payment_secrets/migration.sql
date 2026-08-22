-- Segredos de pagamento pertencem ao secret manager, nunca à tabela Setting.
-- A remoção é idempotente e não afeta a flag não sensível stripe.pixEnabled.
DELETE FROM "Setting"
WHERE "key" IN ('stripe.secretKey', 'stripe.webhookSecret');
