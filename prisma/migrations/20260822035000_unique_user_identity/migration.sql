-- Identidades não podem ser duplicadas por diferença de caixa/espaços no
-- e-mail ou pelo mesmo CPF em duas contas. Falhamos de forma explícita se a
-- base legada precisar de saneamento manual; escolher uma conta automaticamente
-- poderia atribuir pedidos/dados pessoais à pessoa errada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "User"
     GROUP BY LOWER(BTRIM("email"))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem e-mails duplicados ignorando caixa/espaços';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM "User"
     WHERE "cpf" IS NOT NULL AND BTRIM("cpf") <> ''
     GROUP BY REGEXP_REPLACE("cpf", '[^0-9]', '', 'g')
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem CPFs duplicados após normalização';
  END IF;
END $$;

UPDATE "User"
   SET "email" = LOWER(BTRIM("email")),
       "cpf" = NULLIF(REGEXP_REPLACE(COALESCE("cpf", ''), '[^0-9]', '', 'g'), '');

-- Mesma regra de dígitos verificadores usada pela aplicação. A função é
-- imutável para poder participar de CHECK sem depender de tabela/configuração.
CREATE FUNCTION "is_valid_cpf"(cpf_value TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
DECLARE
  total INTEGER := 0;
  digit INTEGER;
  expected INTEGER;
  position INTEGER;
BEGIN
  IF cpf_value !~ '^[0-9]{11}$' OR cpf_value = REPEAT(SUBSTRING(cpf_value, 1, 1), 11) THEN
    RETURN FALSE;
  END IF;

  FOR position IN 1..9 LOOP
    total := total + SUBSTRING(cpf_value, position, 1)::INTEGER * (11 - position);
  END LOOP;
  digit := 11 - (total % 11);
  expected := CASE WHEN digit >= 10 THEN 0 ELSE digit END;
  IF expected <> SUBSTRING(cpf_value, 10, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  total := 0;
  FOR position IN 1..10 LOOP
    total := total + SUBSTRING(cpf_value, position, 1)::INTEGER * (12 - position);
  END LOOP;
  digit := 11 - (total % 11);
  expected := CASE WHEN digit >= 10 THEN 0 ELSE digit END;
  RETURN expected = SUBSTRING(cpf_value, 11, 1)::INTEGER;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "cpf" IS NOT NULL AND NOT "is_valid_cpf"("cpf")
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem CPFs com dígitos verificadores inválidos';
  END IF;
END $$;

CREATE UNIQUE INDEX "User_email_lower_key"
  ON "User" (LOWER("email"));

CREATE UNIQUE INDEX "User_cpf_unique_not_null_key"
  ON "User" ("cpf")
  WHERE "cpf" IS NOT NULL;

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_canonical" CHECK (
    "email" = LOWER(BTRIM("email")) AND CHAR_LENGTH("email") <= 254
  ),
  ADD CONSTRAINT "User_cpf_valid" CHECK (
    "cpf" IS NULL OR "is_valid_cpf"("cpf")
  );
