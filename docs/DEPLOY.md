# Deploy e operação — FarmaVida (Vercel + Neon)

Referência técnica para publicar a aplicação Next.js na Vercel com PostgreSQL
gerenciado pela Neon.

## 1. Variáveis de ambiente

Obrigatórias para o boot:

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | conexão pooled da aplicação |
| `DATABASE_URL_UNPOOLED` | conexão direta usada nas migrations |
| `AUTH_SECRET` | segredo do Auth.js, gerado com `npx auth secret` |
| `MFA_ENCRYPTION_KEY` | chave exclusiva que protege os segredos TOTP com AES-GCM |
| `MFA_RECOVERY_PEPPER` | segredo exclusivo usado no HMAC dos recovery codes |
| `APP_ENV` | **obrigatória** em build de produção: `production`, `preview`, `staging`, `development` ou `test`. Sem declaração o boot falha. Na Vercel, `VERCEL_ENV` já cumpre esse papel |
| `STORAGE_DRIVER` + storage privado | `s3` + `S3_BUCKET` na Vercel; `local` exige `UPLOAD_DIR` em volume persistente self-hosted |
| `PAYMENTS_ENABLED` | opt-in: só `true` liga a cobrança, e exige os dois segredos Stripe. Ausente ou escrita errada = desligado |
| `EMAIL_ENABLED` | opt-in: só `true` envia de verdade, e exige `RESEND_API_KEY` + `MAIL_FROM`. Ausente ou escrita errada = desligado |

Necessárias conforme os recursos habilitados:

| Variável | Finalidade |
|---|---|
| `STRIPE_SECRET_KEY` | cartão e, quando habilitado na conta, Pix |
| `STRIPE_WEBHOOK_SECRET` | valida `/api/webhooks/stripe` |
| `RESEND_API_KEY` + `MAIL_FROM` | e-mails transacionais |
| `CRON_SECRET` | protege assinaturas, retenção e reconciliação de pagamentos/reservas |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN`, `KV_REST_API_*` ou `REDIS_URL` | rate limit durável; REST em serverless ou TCP no runtime Node |
| `NEXT_PUBLIC_BASE_URL` / `AUTH_URL` | URLs públicas HTTPS |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | monitoramento de erros |

O `vercel.json` usa frequências diárias porque o plano Hobby aceita uma
execução por dia por cron. A cadência desejada para `/api/cron/payments` é de
hora em hora: a reserva de estoque dura 25 h, e uma passada diária deixa pedido
pago preso e estoque bloqueado além do SLA. No plano Pro, troque a expressão
desse cron para `0 * * * *` — a lease em `JobLease` já impede sobreposição
entre execuções. Webhooks continuam sendo a confirmação financeira imediata em
todos os planos; o cron é a rede de segurança, não o caminho principal.

Desativação é explícita, não simulada: com `PAYMENTS_ENABLED=false`, o checkout
oferece somente dinheiro na entrega e o webhook Stripe responde indisponível;
com `EMAIL_ENABLED=false`, nenhum e-mail é alegado como enviado. Para uma loja
MIP-only sem acervo legado, `STORAGE_DRIVER=disabled` faz operações de arquivo
falharem fechado. Não use esse modo se ainda houver receitas antigas a consultar
ou excluir; nesse caso configure S3 antes do deploy.

O papel/usuário do bucket precisa permitir `s3:ListBucketVersions`,
`s3:DeleteObject` e `s3:DeleteObjectVersion` (além das permissões de leitura e
gravação). A fila de exclusão remove também versões e delete markers; sem essas
permissões a tarefa permanece com falha e é retomada pelo cron de retenção. Use
uma lifecycle policy do bucket como segunda camada, nunca como substituta da fila.

Os dados regulatórios devem ser preenchidos em **Admin → Configurações**. O
rodapé e a página Sobre só exibem valores configurados; se razão social, CNPJ,
endereço, horário, telefone, RT/CRF, licença sanitária ou AFE estiverem ausentes,
o site informa que o ambiente não está liberado para operação comercial.

Em produção, `AUTH_URL` (quando definido) precisa ter exatamente o mesmo
origin HTTPS de `NEXT_PUBLIC_BASE_URL`. Valide o rate limit remoto com
`npm run check:ratelimit`; uma variável presente, mas inválida, bloqueia o boot.
As duas raízes MFA devem ser diferentes de `AUTH_SECRET` e entre si. Durante
rotação, mantenha temporariamente os valores antigos em
`MFA_ENCRYPTION_KEY_PREVIOUS` e `MFA_RECOVERY_PEPPER_PREVIOUS`.

## 2. Migrations

A Vercel não executa migrations durante o build. Aplique migrations por uma
etapa controlada do release, usando a conexão direta:

```bash
npm run db:migrate:deploy
```

Use migrations retrocompatíveis quando aplicação e banco puderem ficar em
versões diferentes durante o deploy.

`/api/ready` só libera tráfego quando a última migration aplicada é exatamente
`EXPECTED_MIGRATION` (`src/lib/operations/readiness.ts`). Toda migration nova
precisa subir essa constante no mesmo commit: deixá-la para trás inverte o
sinal da sonda, que passa a recusar tráfego justamente depois de um release
aplicado com sucesso. `src/lib/operations/__tests__/readiness.test.ts` falha
quando as duas divergem.

O primeiro deploy da migration `20260822033000_session_mfa_policy` encerra os
JWTs emitidos pela versão anterior, que ainda não carregam `sessionVersion`.
Planeje a comunicação: clientes e equipe precisarão entrar novamente; em
produção, administradores sem MFA serão encaminhados ao enrollment.

A migration de busca instala a extensão confiável `pg_trgm`. Confirme antes do
release que a credencial de migration tem permissão para `CREATE EXTENSION` (ou
habilite a extensão no painel do PostgreSQL gerenciado) e agende os índices para
uma janela de baixo volume de escrita em catálogos grandes.

## 3. Seed destrutivo

`npm run db:seed` apaga dados antes de criar as fixtures. A proteção no código:

- recusa `NODE_ENV=production` e `VERCEL_ENV=production`;
- recusa todo host que não seja `localhost`, `127.0.0.1` ou `::1`;
- exige `ALLOW_DESTRUCTIVE_SEED=I_UNDERSTAND_THIS_WILL_DELETE_DATA`;
- gera senhas demo aleatórias, salvo quando `SEED_*_PASSWORD` é informado.

Nunca use o seed para inicializar produção. Cadastre o catálogo real pelo painel
ou por importação, sempre revisando a classificação de tarja.

## 4. Stripe

1. Configure `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` no cofre do provedor.
2. Registre o endpoint `https://SEU_DOMINIO/api/webhooks/stripe` no Stripe.
3. Assine no mínimo `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `payment_intent.canceled`, `checkout.session.completed`,
   `checkout.session.expired`, `checkout.session.async_payment_failed` e os
   eventos `refund.created`, `refund.updated` e `refund.failed`.
4. Em **Admin → Configurações**, teste a conexão e confirme o ambiente.
5. O Pix só é oferecido quando a capability da conta estiver ativa.
6. Valide cartão, Pix, expiração, cancelamento e reembolso com chaves de teste.

Sem credenciais válidas, pagamentos online permanecem indisponíveis; não existe
fallback de pagamento simulado em produção.

## 5. Política de catálogo

O canal é MIP-only e não recebe novas receitas. Produtos com
`requiresPrescription=true`:

- permanecem inativos;
- não aparecem em catálogo, busca, sitemap ou favoritos;
- não podem ser ativados pelo painel;
- não podem ser assinados ou repostos;
- são desativados quando o PDV os reclassifica como tarja.

O storage privado existente serve apenas ao histórico legado até a conclusão da
política de retenção/exclusão; não é requisito para novas compras.

## 6. Verificação do release

```bash
npm ci
npm run check
npm run build
npm run test:integration
npm run test:e2e
```

Os E2E que escrevem exigem `E2E_DATABASE_URL` apontando para PostgreSQL em
loopback, banco descartável com nome terminado em `_test` e
`E2E_ALLOW_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_DATABASE`. O Playwright
recusa escrita sem essas condições e inicia um servidor local próprio nesse
modo, sem reutilizar um processo existente. Nunca aponte testes para produção.
A suíte de integração também exige URL e confirmação próprias. Execute ambas
em ambiente descartável conforme [Desenvolvimento](./DEVELOPMENT.md), antes de
configurar o destino do deploy. Não rode testes mutáveis no ambiente de release.

Os procedimentos de backup, restauração, incidentes, webhook e conciliação
estão em [OPERATIONS.md](./OPERATIONS.md).

Antes de promover, nesta ordem e sem pular etapas:

1. `npm run check:ratelimit` contra as variáveis do ambiente de destino. Os
   caminhos de credencial (login, MFA, reset de senha, exclusão de conta)
   **falham fechado** em produção viva: sem armazenamento durável respondendo,
   a requisição é negada em vez de cair no contador local. Uma `REDIS_URL`
   apontando para host inexistente derruba o login — e apagar a variável não
   ajuda, porque a ausência de durável produz o mesmo resultado. Só um Redis
   que responde libera esse caminho.
2. `npm run db:migrate:deploy` pela conexão direta (seção 2).
3. Só então promova o deploy.

Inverter 2 e 3 coloca no ar um código que espera tabelas e enums que ainda não
existem no banco.

Após o deploy, confirme HTTPS, login, checkout, webhook, e-mail, os dois crons,
rate limit, `/api/health` (liveness), `/api/ready` (PostgreSQL + migration) e a
divulgação regulatória na home. Faça também exercícios periódicos de
restauração de backup. A semântica e os alertas dessas sondas estão no runbook
[OPERATIONS.md](./OPERATIONS.md).
