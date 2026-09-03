-- A trilha de auditoria passa a ser somente-anexação no próprio banco.
--
-- A aplicação já grava a evidência junto com a mutação, mas isso protege contra
-- o caminho feliz apenas. Uma trilha que a própria aplicação pode reescrever ou
-- apagar não serve como evidência: qualquer bug, script solto ou acesso direto
-- ao banco poderia sumir com o registro depois do fato.
--
-- Duas exceções, ambas deliberadas e estreitas:
--
--  1. ANONIMIZAÇÃO (LGPD) — a exclusão de conta rompe o vínculo com o titular
--     (userId, userEmail) e substitui o texto livre (detail). O QUE aconteceu,
--     em qual entidade e quando continua intocável.
--
--  2. HANDOVER — o script de entrega do projeto zera a base inteira. Precisa
--     declarar a intenção na própria sessão:
--       SET LOCAL app.allow_audit_purge = 'on';

CREATE OR REPLACE FUNCTION "auditLogAppendOnly"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_audit_purge', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION
      'AuditLog e somente-anexacao: exclusao exige app.allow_audit_purge=on na sessao';
  END IF;

  IF NEW."id"         IS DISTINCT FROM OLD."id"
  OR NEW."action"     IS DISTINCT FROM OLD."action"
  OR NEW."entity"     IS DISTINCT FROM OLD."entity"
  OR NEW."entityId"   IS DISTINCT FROM OLD."entityId"
  OR NEW."pharmacyId" IS DISTINCT FROM OLD."pharmacyId"
  OR NEW."createdAt"  IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION
      'AuditLog e somente-anexacao: so userId, userEmail e detail podem mudar (anonimizacao)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION "auditLogAppendOnly"();
