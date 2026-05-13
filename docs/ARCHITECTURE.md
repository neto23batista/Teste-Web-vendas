# FarmaVida - Arquitetura Geral

Esta primeira entrega define somente a arquitetura, a estrutura de pastas e o banco de dados. Nenhum modulo funcional foi implementado ainda.

## Visao Arquitetural

O FarmaVida sera uma aplicacao PHP 8.2+ modular, orientada a MVC, com separacao clara entre entrada HTTP, regras de negocio, persistencia, views e integracoes externas.

Fluxo principal:

1. Apache entrega todas as requisicoes publicas por `public/index.php`.
2. O roteador carrega rotas de `routes/web.php`, `routes/admin.php` e `routes/api.php`.
3. Middlewares aplicam sessao, CSRF, autenticacao, autorizacao, rate limit, headers de seguranca e contexto LGPD.
4. Controllers recebem a requisicao validada e delegam regras para Services.
5. Services concentram regras de negocio, transacoes, auditoria e integracoes.
6. Repositories encapsulam consultas PDO com prepared statements.
7. Models representam entidades e objetos de dominio simples.
8. Views ficam em `resources/views`, sem regra de negocio.
9. Logs, uploads privados e cache ficam fora de `public`, em `storage`.

## Camadas

- `Controllers`: adaptadores HTTP para loja, cliente, admin e API.
- `Middlewares`: autenticacao, permissao, CSRF, rate limit, headers e API key.
- `Services`: regras de negocio e orquestracao transacional.
- `Repositories`: acesso ao MySQL/MariaDB via PDO.
- `Models`: entidades, enums simples e mapeamentos de dominio.
- `Validators`: validacao de entrada, CPF, upload, checkout e API.
- `Helpers`: funcoes pequenas para response, sanitizacao, moeda, datas e logs.
- `Views`: HTML/PHP renderizado com dados ja preparados.
- `Routes`: declaracao explicita das rotas web, admin, auth, API e webhooks.
- `Database`: migrations versionadas e seeders controlados.

## Servicos Planejados

- `AuthService`: cadastro, login, sessoes, recuperacao de senha, rate limit e permissoes.
- `CartService`: carrinho persistente, recalculo de totais e carrinho abandonado.
- `CheckoutService`: validacao de estoque, CPF, LGPD, entrega, cupom e receita.
- `OrderService`: criacao, status, timeline, cancelamento e auditoria de pedidos.
- `StockService`: lotes, validade, movimentos, inventario e bloqueios de venda.
- `PaymentService`: Mercado Pago, idempotencia, webhook, conciliacao e divergencias.
- `PrescriptionService`: upload protegido, validacao farmaceutica e bloqueios clinicos.
- `InvoiceService`: NF-e simulada, DANFE simulada e preparo para provedor fiscal real.
- `EmailService`: PHPMailer, templates, fallback e logs.
- `WebhookService`: webhooks de entrada/saida, retry, backoff e payload sanitizado.
- `LoyaltyService`: pontos, historico, expiracao e recompra.
- `ReportService`: indicadores administrativos e datasets para Chart.js.
- `AuditService`: eventos administrativos, farmaceuticos e de dados sensiveis.
- `LGPDService`: consentimentos, exportacao, exclusao/anonimizacao e finalidade.
- `ProductService`: catalogo, busca, filtros, imagens, genericos e kits.
- `DeliveryService`: areas, taxas, entregadores, retirada e janela operacional.
- `CouponService`: cupons, promocoes, elegibilidade e antifraude basico.
- `NotificationService`: notificacoes por e-mail e preparacao para WhatsApp/API futura.

## Modulos

- Loja e catalogo
- Carrinho e checkout
- Cliente e LGPD
- Admin e operacao farmaceutica
- Produtos, categorias, marcas, imagens, kits e recomendacoes
- Estoque profissional com lote e validade
- Pedidos e timeline operacional
- Pagamentos Mercado Pago
- Receitas e validacao farmaceutica
- NF-e/DANFE simulada
- API REST, ERP e webhooks
- E-mails transacionais
- Fidelidade e marketing responsavel
- Relatorios e indicadores
- Observabilidade, seguranca e readiness checks

## Seguranca Base

- Senhas com `password_hash`/bcrypt.
- PDO com prepared statements em todos os acessos.
- CSRF em formularios POST.
- Rate limit persistido em banco para login, checkout, API e recuperacao de senha.
- Uploads sensiveis fora de `public`.
- Logs sem dados sensiveis brutos.
- API keys armazenadas somente por hash.
- Tokens de recuperacao e carrinho abandonado armazenados somente por hash.
- Permissoes por role e escopo.
- Auditoria para acoes administrativas, farmaceuticas e acesso a dados sensiveis.

## Compliance Farmaceutico

- Produtos possuem classificacao de receita e politica de venda remota.
- Medicamento controlado nao deve ser liberado automaticamente.
- Receitas ficam em storage protegido e exigem validacao farmaceutica.
- Toda decisao farmaceutica gera auditoria.
- Produtos termossensiveis possuem faixa de temperatura e alertas operacionais.
- Dados institucionais da farmacia ficam em `pharmacy_profiles`.
- A interface futura deve exibir termos, politica, AFE/AE, CRF e canal farmaceutico.

## Banco e Migrations

As migrations estao em `database/migrations`, separadas por modulo e executadas em ordem numerica. O runner futuro devera registrar cada arquivo na tabela `migrations`, com checksum, status, batch e tempo de execucao.

Em producao, nao deve haver `ALTER TABLE` automatico fora do fluxo de migration versionada. Mudancas estruturais futuras devem ser novos arquivos de migration.

