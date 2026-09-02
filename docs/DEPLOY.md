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
| `APP_ENV=production` | identifica produção em hospedagem própria; a Vercel usa `VERCEL_ENV` |
| `STORAGE_DRIVER` + storage privado | `s3` + `S3_BUCKET` na Vercel; `local` exige `UPLOAD_DIR` em volume persistente self-hosted |

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

O `vercel.json` usa frequências diárias compatíveis com o plano Hobby. Para
reconciliar pagamentos a cada 10 minutos, migre o projeto para o plano Pro e
altere somente a expressão do cron `/api/cron/payments`; webhooks continuam
sendo a confirmação financeira imediata em todos os planos.

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
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Os E2E que escrevem exigem `E2E_DATABASE_URL` apontando para um PostgreSQL
descartável e
`E2E_ALLOW_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_DATABASE`. O Playwright
recusa escrita sem essas duas condições e não permite reutilizar servidor
externo nesse modo. Nunca aponte testes para produção.

Os procedimentos de backup, restauração, incidentes, webhook e conciliação
estão em [OPERATIONS.md](./OPERATIONS.md).

Após o deploy, confirme HTTPS, login, checkout, webhook, e-mail, os dois crons,
rate limit, `/api/health` (liveness), `/api/ready` (PostgreSQL + migration) e a
divulgação regulatória na home. Faça também exercícios periódicos de
restauração de backup. A semântica e os alertas dessas sondas estão no runbook
[OPERATIONS.md](./OPERATIONS.md).
