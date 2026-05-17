# FarmaVida

Sistema modular em PHP 8.2+ para farmacia online, pedidos, estoque, pagamentos, receitas, NF-e simulada, ERP/API, fidelidade, marketing, relatorios, LGPD e operacao farmaceutica.

## Stack

- PHP 8.2+
- MySQL ou MariaDB
- Apache com `.htaccess`
- Composer
- PDO com prepared statements
- PHPMailer
- Mercado Pago via SDK/REST
- HTML5, CSS3, JavaScript puro, Fetch API
- Chart.js no painel administrativo

## Instalacao

1. Aponte o DocumentRoot do Apache para `public/`.
2. Copie `.env.example` para `.env`.
3. Configure banco, `APP_KEY`, SMTP e Mercado Pago.
4. Instale dependencias:

```bash
composer install
```

5. Execute migrations:

```bash
php scripts/migrate.php
```

6. Execute seeders:

```bash
php scripts/seed.php
```

7. Crie o primeiro admin:

```bash
php scripts/create_admin.php "Dono FarmaVida" dono@farmavida.com SenhaForte123
```

8. Acesse `/admin/login`.

## Configuracao do Banco

No `.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=farmavida
DB_USERNAME=root
DB_PASSWORD=
```

As migrations ficam em `database/migrations` e sao registradas na tabela `migrations`. Em producao, alteracoes estruturais devem ser novas migrations versionadas.

## Mercado Pago

Sandbox:

```env
MERCADO_PAGO_MODE=sandbox
MERCADO_PAGO_ACCESS_TOKEN=TEST-token-da-aplicacao
MERCADO_PAGO_WEBHOOK_SECRET=segredo-do-webhook
MERCADO_PAGO_NOTIFICATION_URL=
```

Producao:

```env
MERCADO_PAGO_MODE=production
MERCADO_PAGO_ACCESS_TOKEN=token-producao
MERCADO_PAGO_WEBHOOK_SECRET=segredo-producao
MERCADO_PAGO_NOTIFICATION_URL=https://seu-dominio.com/webhooks/mercado-pago
```

Em `APP_ENV=local` ou `MERCADO_PAGO_MODE=sandbox`, a aplicacao nao envia `notification_url` automaticamente a partir de `APP_URL`. Isso evita `invalid_notification_url` quando `APP_URL` aponta para localhost, tunnel temporario ou URL que o Mercado Pago recusa. Para testar webhook local, exponha a aplicacao por HTTPS publico e defina explicitamente:

```env
MERCADO_PAGO_NOTIFICATION_URL=https://seu-tunnel-publico/webhooks/mercado-pago
```

O endpoint adiciona `source_news=webhooks` na URL enviada por preferencia. Para sandbox, use credenciais de teste e valide o recebimento pelo simulador de Webhooks em Suas integracoes do Mercado Pago, pois pagamentos de teste nao disparam webhooks reais. A validacao usa `x-signature`, `x-request-id` e HMAC SHA-256 conforme documentacao oficial do Mercado Pago.

Antes de liberar pagamento, execute:

```bash
php market_readiness_checks.php
```

Esse check valida modo, formato de token, URL de notificacao e faz uma chamada remota leve para detectar `invalid access token` antes do usuario chegar ao checkout.

## SMTP

```env
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_USERNAME=usuario
SMTP_PASSWORD=senha
SMTP_FROM_EMAIL=nao-responda@seudominio.com
SMTP_FROM_NAME=FarmaVida
```

Se PHPMailer/SMTP nao estiver configurado, o sistema tenta fallback com `mail()` e registra falhas em `email_logs`.

## Painel Administrativo

Areas criadas:

- Dashboard operacional
- Multi-filial com isolamento por loja
- Produtos e categorias
- Pedidos e timeline
- Estoque e movimentacoes
- Receitas e validacao farmaceutica
- Pagamentos
- NF-e simulada
- Relatorios com Chart.js
- Integracoes/API/Webhooks
- Marketing: cupons, promocoes e banners
- Avaliacoes de produtos com moderacao
- Servicos clinicos e agenda por filial
- Transferencias formais de estoque entre filiais
- Entrega: zonas e entregadores
- Configuracoes e migrations
- Logs e auditorias
- Caixa por filial, compras, jobs assincronos e preparacao fiscal real

## Loja do Cliente

Fluxos criados:

- Home
- Catalogo com busca/filtros
- Pagina de produto
- Carrinho AJAX
- Checkout com CPF, LGPD, entrega, cupom e upload de receita
- Checkout com resgate de pontos de fidelidade
- Acompanhamento de pedido com endpoint de status a cada 30s
- Painel do cliente com pedidos, perfil, pontos, servicos agendados e solicitacoes LGPD

## API REST

Autenticacao via header:

```http
X-API-Key: fv_xxxxxxxxx
```

Crie uma chave:

```bash
php scripts/create_api_key.php "ERP Bling" '["products:read","orders:read","stock:write"]'
```

Endpoints:

- `GET /api/produtos`
- `GET /api/produtos/{id}`
- `POST /api/produtos`
- `PUT /api/produtos/{id}`
- `DELETE /api/produtos/{id}`
- `GET /api/pedidos`
- `GET /api/pedidos/{id}`
- `POST /api/pedidos`
- `PUT /api/pedidos/{id}/status`
- `GET /api/estoque`
- `GET /api/estoque/{produto_id}`
- `POST /api/estoque/movimentacao`
- `GET /api/clientes`
- `GET /api/clientes/{id}`
- `GET /api/financeiro/pagamentos`
- `GET /api/financeiro/vendas`
- `GET /api/nfe`
- `GET /api/nfe/{id}`

## Fiscal

O modulo fiscal nao finge emissao real. `FiscalService` grava solicitacoes em `notas_fiscais`; sem credenciais de provedor fiscal, a nota fica em modo `homologacao_simulada`. Configure provedor fiscal, token e ambiente antes de operar em producao.

## LGPD e Receitas

- Consentimento LGPD e registrado no cadastro.
- CPF fica mascarado e com hash para busca.
- Receitas ficam em `storage/uploads/prescriptions`, fora de `public`.
- Acesso a dados sensiveis deve gerar auditoria.
- Medicamentos controlados ficam bloqueados para venda automatica.
- Dados de saude/compra de medicamentos nao devem ser usados para marketing indevido.

## Qualidade

```bash
php scripts/lint_php.php
php tests/Feature/auth_security_test.php
php tests/Feature/cart_checkout_test.php
php tests/Feature/payment_webhook_test.php
php tests/Feature/api_permissions_test.php
php tests/Feature/customer_experience_workflows_test.php
php market_readiness_checks.php
```

`market_readiness_checks.php` verifica PHP, extensoes, banco, tabelas, migrations, SMTP, Mercado Pago, diretorios, uploads protegidos, CSRF, rotas, templates e exposicao de chaves.

## Jobs Operacionais

Processar webhooks de saida com retry/backoff:

```bash
php scripts/process_webhooks.php
```

Processar jobs de e-mail, WhatsApp e fiscal:

```bash
php scripts/process_jobs.php
```

Em producao, configure cron para executar esse script a cada minuto.

## Multi-filial

As migrations `018_multi_branch_operations.sql` e `019_customer_experience_workflows.sql` criam `filiais`, `estoque_filial`, `id_filial` nas tabelas criticas, views segregadas, caixa/compras/fiscal/jobs, resgate de pontos, avaliacoes, agenda e transferencias formais. Veja `docs/MULTI_BRANCH.md`.

## Deploy

- DocumentRoot deve ser `public/`.
- `APP_DEBUG=false` em producao.
- Configure HTTPS.
- Configure `SESSION_SECURE=true`.
- Proteja `.env`, `storage`, `database`, `app`, `config`, `routes`, `vendor`.
- Configure backup do banco.
- Configure rotacao de logs.
- Execute readiness check antes da publicacao.

## Estrutura

Veja `docs/FOLDER_STRUCTURE.md`.

## Observacoes

Este projeto foi estruturado sem framework pesado. Regras de negocio ficam em Services, SQL em Repositories ou Services transacionais, views nao contem regras criticas, e todos os POST web usam CSRF.
