# Desenvolvimento local e testes

## Ambiente de desenvolvimento

Use **Node 22** e npm; confirme `node --version` antes das validações. No
PowerShell, prefira `npm.cmd` para evitar conflitos com a política de scripts.
O CI usa PostgreSQL 16.

1. Se ainda não existir, crie `.env` a partir de `.env.example`. Não sobrescreva
   `.env` ou `.env.local` existentes.
2. Configure `DATABASE_URL` e `DATABASE_URL_UNPOOLED` para seu banco de
   desenvolvimento, além de um `AUTH_SECRET` aleatório com pelo menos 32
   caracteres. Não use segredos ou dados pessoais de produção.
3. Mantenha `PAYMENTS_ENABLED=false` e `EMAIL_ENABLED=false` enquanto os
   provedores não estiverem configurados e homologados.
4. Instale dependências e aplique as migrações no banco escolhido:

```powershell
npm.cmd ci
npm.cmd run db:migrate:deploy
npm.cmd run dev
```

Acesse `http://localhost:3000`. O CLI do Prisma carrega `.env` pelo
`prisma.config.ts`; o Next também lê `.env.local`. Evite URLs de banco
conflitantes nesses arquivos. Variáveis fornecidas ao processo têm precedência.

`db:migrate:deploy` aplica migrações existentes. `db:migrate` serve para criar
novas migrações durante desenvolvimento. Não use `db:push` como substituto de
migrações em ambiente compartilhado. O seed é destrutivo e não faz parte da
inicialização normal da aplicação.

## Validação sem banco disponível

```powershell
npm.cmd run check
npm.cmd audit --omit=dev --audit-level=high
npm.cmd exec -- prisma validate
npm.cmd run build
```

`check` executa arquitetura, lint, tipos, testes da arquitetura e a suíte local
com dependências simuladas. A validação do schema e a build podem exigir as
variáveis de ambiente sintaticamente válidas mesmo sem consultar o banco.
Uma URL local de validação não comprova conexão, migração ou funcionamento
integrado. Não configure credenciais reais apenas para fazer uma build passar.

## PostgreSQL descartável para integração

Abra o Docker Desktop e use **um terminal separado**. O arquivo
`compose.test.yml` publica somente em `127.0.0.1:55432`, com credenciais públicas
exclusivas de teste e banco `farmavida_test`. O armazenamento é `tmpfs`: os dados
são descartáveis e podem desaparecer ao parar o serviço. Nunca coloque dados
reais nele.

```powershell
docker compose -f compose.test.yml up -d --wait
$env:INTEGRATION_DATABASE_URL = 'postgresql://farmavida:farmavida@127.0.0.1:55432/farmavida_test'
$env:INTEGRATION_ALLOW_WRITES = 'I_UNDERSTAND_THIS_IS_A_DISPOSABLE_DATABASE'
$env:DATABASE_URL = $env:INTEGRATION_DATABASE_URL
$env:DATABASE_URL_UNPOOLED = $env:INTEGRATION_DATABASE_URL
npm.cmd run db:migrate:deploy
npm.cmd run test:integration
```

A suíte aceita apenas PostgreSQL em loopback, nome de banco terminado em
`_test`, confirmação exata e ambiente não marcado como produção. Parâmetros da
URL que redirecionem host/banco são recusados. Isso reduz enganos, mas não
substitui a conferência do destino: um túnel local também pode atingir dados
reais. Use o serviço descartável acima, sem túneis.

Os cenários cobrem transferência FEFO, conflito de validade com rollback,
reservas concorrentes, liberação exatamente uma vez, lote vencido, contagem de
catálogo inválida e transferências em direções opostas. Os testes criam IDs
próprios e limpam apenas suas fixtures; não executam seed nem limpeza global.

Ao terminar, este comando remove o serviço de teste e descarta seus dados:

```powershell
docker compose -f compose.test.yml down
```

Feche esse terminal para não reutilizar suas variáveis de teste no trabalho
normal. Não execute o comando de descarte contra outro arquivo Compose.

## E2E com escrita

Use o mesmo banco descartável, já migrado. No terminal isolado, configure
senhas demo efêmeras; o seed e o Playwright precisam receber os mesmos valores:

```powershell
$env:E2E_DATABASE_URL = $env:INTEGRATION_DATABASE_URL
$env:E2E_DATABASE_URL_UNPOOLED = $env:INTEGRATION_DATABASE_URL
$env:E2E_ALLOW_WRITES = 'I_UNDERSTAND_THIS_IS_A_DISPOSABLE_DATABASE'
$env:ALLOW_DESTRUCTIVE_SEED = 'I_UNDERSTAND_THIS_WILL_DELETE_DATA'
$env:SEED_OWNER_PASSWORD = [guid]::NewGuid().ToString('N')
$env:SEED_BRANCH_PASSWORD = [guid]::NewGuid().ToString('N')
$env:SEED_CUSTOMER_PASSWORD = [guid]::NewGuid().ToString('N')
$env:AUTH_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:AUTH_TRUST_HOST = 'true'
$env:AUTH_URL = 'http://localhost:3210'
$env:NEXT_PUBLIC_BASE_URL = 'http://localhost:3210'
$env:PAYMENTS_ENABLED = 'false'
$env:EMAIL_ENABLED = 'false'
$env:PW_WEB_COMMAND = 'npx next start -p 3210'
npm.cmd run db:seed
npm.cmd run build
npm.cmd run test:e2e
```

O seed **apaga os dados do banco configurado**. Confirme o destino antes de
usá-lo. Nunca execute esse bloco em produção, contra banco compartilhado ou
com `APP_ENV`/`VERCEL_ENV` de produção. Não salve as senhas geradas no Git.

O Playwright inicia um servidor próprio para testes de escrita; não reutiliza
um servidor existente e recusa `PW_NO_SERVER`, URL de servidor remota ou banco
fora das condições de segurança. Deixe a porta 3210 livre. Localmente usa
Microsoft Edge; o CI instala Chromium. Sem confirmação, cenários mutáveis são
ignorados — isso não equivale à aprovação desses fluxos.

O workflow em `.github/workflows/ci.yml` prepara PostgreSQL, aplica migrações,
roda integração, seed, build e E2E. A presença dessa configuração não comprova
que uma execução remota tenha passado; consulte o resultado do job e os
artefatos de falha.

## Manutenção

Consulte [Arquitetura](ARCHITECTURE.md) antes de adicionar módulos. Não mova
rotas nem arquivos exigidos pelo framework por razões estéticas. Não versione
`.next/`, `node_modules/`, relatórios gerados, arquivos privados ou `.env*`
reais. Ferramentas de `scripts/ops/` são manuais e sensíveis; leia o runbook
[Operação](OPERATIONS.md) antes de qualquer ação destrutiva.
