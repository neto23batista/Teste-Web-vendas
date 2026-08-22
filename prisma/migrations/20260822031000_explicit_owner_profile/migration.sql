-- Perfis ausentes eram historicamente interpretados como OWNER pelo código.
-- Materialize essa decisão uma única vez para preservar admins legados; depois
-- desta migration, qualquer novo null falha para o menor privilégio.
UPDATE "User"
SET "staffProfile" = 'OWNER'
WHERE "role" = 'ADMIN' AND "staffProfile" IS NULL;
