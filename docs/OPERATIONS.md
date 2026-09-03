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

O utilitário `scripts/ops/handover-cleanup.ts` é reservado a uma entrega formal e
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

## Estoque, lotes e transferências

- O cadastro de produto aceita estoque inicial e registra o movimento. Na
  edição, o saldo é somente leitura: salvar descrição/preço não deve reaplicar
  uma quantidade antiga. Use os fluxos próprios de estoque/lotes para ajustes.
- A importação CSV com contagem explícita registra o movimento da diferença e
  recusa saldo inferior às quantidades rastreadas em lotes. Produtos novos
  importados também registram o saldo inicial no livro-razão. Oferta, estoque e
  movimentos pertencem à mesma transação e devem reverter juntos em falha.
  Estoque vazio preserva o saldo existente; para produtos novos, começa em zero.
  Valores inválidos, fracionários, negativos ou fora do limite são recusados,
  nunca arredondados. Em linhas duplicadas, vale a última contagem explícita.
- Receba mercadorias em **Compras → Receber lote**. Quantidades devem ser
  inteiras; datas inexistentes ou vencidas são recusadas. A validade considera
  o dia civil de `America/Sao_Paulo`, inclusive o dia informado.
- O mesmo produto/lote/unidade não pode receber uma nova validade pelo fluxo de
  recebimento. Uma divergência exige conferência física e tratamento específico;
  não use um novo recebimento para prolongar a validade cadastrada.
- O saldo físico pode conter lotes vencidos enquanto a baixa não for registrada.
  Reservas de pedidos e transferências físicas descontam essa parcela do saldo
  utilizável. Saldo sem lote só representa a parcela realmente não rastreada.
- A transferência física entre unidades usa primeiro os lotes válidos com
  vencimento mais próximo (FEFO) e preserva código, validade e dados de origem
  no destino. Unidades inativas e conflitos de validade no destino são recusados.
- Ajustes manuais negativos só podem consumir saldo não rastreado. Para perdas,
  avarias e vencimento de unidades rastreadas, registre a baixa no próprio lote,
  em **Compras**, para manter lote, estoque e livro-razão consistentes.
- Recebimentos, baixas e reservas travam o estoque agregado antes dos lotes.
  A transferência física trava as duas unidades em ordem estável. Em falha,
  toda a transação deve ser revertida, inclusive movimentos e auditoria.
- Se a soma dos lotes superar o estoque agregado, a reserva/transferência é
  recusada. Investigue ajustes legados e confira o saldo físico antes de corrigir;
  não apague lotes nem acrescente estoque apenas para contornar o bloqueio.

## Portabilidade de dados (LGPD)

- A exportação é **assíncrona**: o titular solicita em Conta > Privacidade e o
  arquivo é montado pelo cron de retenção. Montar o histórico inteiro dentro da
  requisição pressionava a instância, e truncar o resultado não cumpriria o
  direito.
- Um pedido por titular a cada 24 h. A solicitação fica registrada na auditoria.
- O arquivo vive em storage privado por 7 dias e depois é apagado pela retenção.
  O download passa pela rota autenticada, que confere o dono — a chave do objeto
  nunca é exposta.

## Devoluções e comprovação de entrega

- Solicitações de devolução validam propriedade do pedido, saldo por item,
  quantidades inteiras e itens duplicados. Novas solicitações do mesmo pedido
  são serializadas no PostgreSQL antes do cálculo do saldo devolvível.
- Aprovação e recebimento usam transições condicionais. Outra tentativa não
  deve repetir a operação nem registrar sucesso de algo já concluído.
- **O recebimento não devolve nada ao estoque.** Ele registra apenas quanto
  chegou fisicamente; os itens entram em QUARENTENA. Medicamento que voltou da
  casa do cliente só volta à prateleira depois da conferência sanitária.
- A conferência tem duas saídas: **liberar** (as unidades voltam ao LOTE de
  origem, o mesmo que a venda consumiu) ou **descartar**. Sem lote de origem
  rastreável, ou com o lote vencido, a liberação é recusada pelo sistema — a
  saída é descartar ou registrar um lote novo em Compras, com a validade
  conferida na embalagem. Não contorne isso com ajuste manual de estoque.
- O recebimento físico é confirmado separadamente do reembolso. Se a liquidação
  estiver indisponível, o painel informa que os itens já foram recebidos e que
  a liquidação precisa ser retomada. Não repita a conferência de recebimento.
- Despacho e entrega devem usar **Entregas**, com entregador da mesma unidade e
  comprovante do destinatário. O seletor genérico de status em Pedidos não pode
  efetuar essas transições sem as informações obrigatórias.
- Quando informado, o comprovante guarda somente os quatro últimos dígitos do
  documento do destinatário, nunca o documento completo.

## Pagamentos, webhooks e reembolsos

- Trate o provedor como fonte da confirmação financeira; a página de retorno do
  navegador não confirma pagamento.
- Alerta obrigatório: webhook inválido, repetido em falha, atrasado ou com fila
  crescente. Reprocessamento deve manter idempotência.
- Compare diariamente pedidos pagos/reembolsados com o relatório do provedor e
  investigue divergências antes do fechamento.
- No plano Hobby, o agendador chama `/api/cron/payments` diariamente. Ele reconcilia
  PaymentIntents, Checkout Sessions, reembolsos e devoluções e somente depois
  cancela reservas de estoque vencidas. Monitore ausência de execução, `401`,
  `503`, crescimento de `reconciliationAttempts` e mensagens em
  `reconciliationError`. Em produção com maior volume, use Vercel Pro e altere
  a frequência para cada 10 minutos; o webhook permanece o caminho imediato.
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
