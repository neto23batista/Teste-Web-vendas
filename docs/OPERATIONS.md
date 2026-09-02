# Operação e recuperação — FarmaVida

Este runbook deve ser adaptado ao provedor real antes do go-live. Registre em
cada exercício a data, responsável, ambiente, evidências e tempo de recuperação.

## Backup e restauração

1. Habilite backup contínuo e recuperação para um ponto no tempo (PITR) no
   PostgreSQL. Defina RPO e RTO aprovados pelo negócio.
2. Faça também exportações criptografadas periódicas para uma conta ou projeto
   separado, com retenção e acesso mínimo.
3. Mensalmente, restaure o backup mais recente em um banco isolado. Nunca
   restaure sobre produção durante um teste.
4. Aplique as migrations com `npm run db:migrate:deploy`, rode verificações de
   integridade e valide amostras de usuários, pedidos, pagamentos e estoque.
5. Registre o tempo real, falhas encontradas e a evidência de descarte seguro do
   ambiente de restauração.

Antes de qualquer restauração real, pause checkout, webhooks mutáveis, cron de
assinaturas e atualização de catálogo. Preserve logs e confirme o ponto exato de
recuperação com engenharia, financeiro e operação.

## Handover destrutivo

O utilitário `scripts/handover-cleanup.ts` é reservado a uma entrega formal e
falha fechado. Antes de executá-lo, valide um backup criptografado e uma
restauração/PITR em ambiente isolado. Ele é proibido em produção e na Vercel.

- Exige `ALLOW_DESTRUCTIVE_HANDOVER=I_UNDERSTAND_THIS_WILL_PERMANENTLY_DELETE_DATABASE_DATA`.
- Banco PostgreSQL remoto de homologação exige também
  `ALLOW_REMOTE_DESTRUCTIVE_HANDOVER=I_UNDERSTAND_THIS_REMOTE_DATABASE_WILL_BE_DESTROYED`.
- Forneça `HANDOVER_OWNER_PASSWORD` por secret manager ou canal protegido; nunca
  coloque a senha na linha de comando, no histórico do shell, em ticket ou log.
- Gere o valor com CSPRNG. A validação exige ASCII sem espaços, diversidade e
  forma com espaço de busca nominal de pelo menos 128 bits (por exemplo, 32
  dígitos hexadecimais realmente aleatórios ou 24+ caracteres aleatórios de um
  alfabeto misto). A forma não prova entropia: não invente frases ou padrões.
- A geração com exibição única só é habilitada pela confirmação separada
  `HANDOVER_PRINT_INITIAL_PASSWORD=I_ACCEPT_EXPOSING_THE_INITIAL_PASSWORD_TO_THIS_TERMINAL`.
  Esse caminho usa 24 bytes do gerador criptográfico do sistema (192 bits).

Confirme o host e o nome do banco por uma segunda pessoa. A operação do banco é
atômica: qualquer falha deve reverter todas as mutações; confira o resumo final.

## Incidente de segurança ou dados pessoais

1. Contenha o acesso comprometido: revogue sessões, segredos e integrações
   afetadas sem apagar evidências.
2. Preserve logs com controle de acesso e marque a linha do tempo em UTC.
3. Determine dados, titulares, pedidos e terceiros afetados.
4. Acione o responsável interno, jurídico/LGPD, segurança e direção. Eles devem
   avaliar comunicações à ANPD, titulares, parceiros e autoridades nos prazos
   aplicáveis.
5. Corrija a causa, rotacione credenciais, valide o ambiente limpo e monitore
   recorrência antes de reabrir o serviço.
6. Documente causa-raiz, impacto, decisões, evidências e ações preventivas.

Nunca inclua senhas, tokens, receitas ou dados completos de pagamento em tickets,
mensagens ou logs. Use identificadores internos e repositórios de evidência com
acesso restrito.

## Sessões e MFA administrativo

- JWTs expiram em 24 horas. Troca/reset de senha, ativação/desativação de MFA,
  mudança de papel/perfil/unidade e desligamento incrementam `sessionVersion` e
  revogam imediatamente todos os cookies anteriores.
- Na loja pública (`VERCEL_ENV=production` ou `APP_ENV=production`), nenhuma
  operação administrativa é autorizada sem MFA ativo. O administrador sem MFA
  só consegue seguir para `/conta/seguranca` e concluir o enrollment.
- Recovery codes devem ficar em um cofre diferente do dispositivo autenticador.
  Eles são exibidos uma vez, armazenados somente como HMAC e consumidos de forma
  atômica, um por login.
- `AUTH_SECRET`, `MFA_ENCRYPTION_KEY` e `MFA_RECOVERY_PEPPER` são independentes.
  Rotacionar `AUTH_SECRET` revoga JWTs sem inutilizar o MFA. Para girar uma raiz
  MFA, publique o valor novo como atual e o antigo em `*_PREVIOUS`; logins TOTP
  reenvelopam gradualmente o segredo com a chave atual e recovery codes antigos
  continuam válidos até o primeiro uso. Remova `*_PREVIOUS` somente depois da
  janela aprovada. Qualquer limpeza emergencial deve zerar os campos MFA, apagar
  recovery codes, incrementar `sessionVersion` e deixar evidência auditável.

## Pagamentos, webhooks e reembolsos

- Trate o provedor como fonte da confirmação financeira; a página de retorno do
  navegador não confirma pagamento.
- Alerta obrigatório: webhook inválido, repetido em falha, atrasado ou com fila
  crescente. Reprocessamento deve manter idempotência.
- Compare diariamente pedidos pagos/reembolsados com o relatório do provedor e
  investigue divergências antes do fechamento.
- O agendador chama `/api/cron/payments` a cada 10 minutos. Ele reconcilia
  PaymentIntents, Checkout Sessions, reembolsos e devoluções e somente depois
  cancela reservas de estoque vencidas. Monitore ausência de execução, `401`,
  `503`, crescimento de `reconciliationAttempts` e mensagens em
  `reconciliationError`.
- Em reembolso, confirme o resultado do provedor antes do estado final local.
  Estados pendente e falho devem permanecer visíveis para nova tentativa segura.
- Nunca altere manualmente banco, pontos, cupom ou estoque sem ticket, aprovação,
  evidência do provedor e procedimento reversível.

## Liveness, readiness e retenção

- `/api/health` mede somente liveness do processo HTTP. Use-o para decidir se a
  instância precisa ser reiniciada; ele não consulta banco nem outros provedores.
- `/api/ready` mede PostgreSQL e confirma que
  `20260901000600_payment_reconciliation` é a última migration concluída, sem
  migration interrompida. Um `503` deve retirar a instância do tráfego e gerar
  alerta, não reinício automático indiscriminado. A resposta externa é opaca;
  consulte os logs protegidos para o diagnóstico.
- O agendador chama `/api/cron/retention` diariamente com
  `Authorization: Bearer <CRON_SECRET>`. A rotina idempotente apaga tokens de
  redefinição expirados e carrinhos anônimos abandonados há 30 dias, remove
  tarefas de armazenamento já concluídas e minimiza payloads terminais de
  pagamento depois de 90 dias. Monitore `401`, `503` e ausência de execução no
  horário.
- Pedidos, trilha de auditoria, documentos de saúde e demais evidências não
  entram nessa limpeza genérica. A retenção deles exige matriz legal aprovada,
  legal hold e procedimento específico antes de qualquer descarte.

## Release e rollback

1. Valide CI, migrations e compatibilidade entre a versão atual e a nova.
2. Faça backup/PITR imediatamente antes de migrations de risco.
3. Publique migrations retrocompatíveis antes do código que depende delas.
4. Faça smoke tests de login, busca, carrinho, checkout, webhook, cancelamento,
   estoque, e-mail, cron e painel administrativo.
5. Para rollback, reverta primeiro a aplicação. Migration destrutiva exige plano
   específico e restauração testada; não improvise `migrate reset`.

## Contatos e cadência

Preencha no cofre operacional os contatos de engenharia, operação, responsável
técnico, jurídico/LGPD, financeiro, hospedagem, banco, e-mail e Stripe. Revise o
runbook trimestralmente e após todo incidente ou mudança relevante.
