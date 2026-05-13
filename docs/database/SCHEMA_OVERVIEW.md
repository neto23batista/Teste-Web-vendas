# FarmaVida - Visao do Banco de Dados

O banco foi modelado para MySQL/MariaDB com InnoDB e `utf8mb4`. As tabelas usam chaves primarias numericas, chaves estrangeiras, indices de busca e timestamps padronizados.

## Ordem de Migrations

1. `000_migrations.sql`
2. `001_auth_security.sql`
3. `002_customers_lgpd.sql`
4. `003_catalog_products.sql`
5. `004_carts_orders.sql`
6. `005_stock.sql`
7. `006_payments.sql`
8. `007_prescriptions_clinical.sql`
9. `008_invoices_nfe_simulated.sql`
10. `009_integrations_api_webhooks_erp.sql`
11. `010_loyalty_marketing.sql`
12. `011_delivery_operations_support.sql`
13. `012_observability_logs_settings.sql`
14. `013_reporting_views.sql`
15. `014_customer_engagement.sql`

## Principais Relacionamentos

- `users` e a identidade base para clientes, admins e usuarios de sistema.
- `customers` e `admins` sao perfis especializados de `users`.
- `roles`, `permissions`, `user_roles` e `role_permissions` formam o RBAC.
- `products` referencia `categories`, `brands` e produto generico relacionado.
- `product_batches` controla lote, validade e estoque fisico.
- `orders` referencia cliente, endereco, responsavel e totais recalculados no backend.
- `order_items` guarda snapshot de produto e preco para historico fiscal/operacional.
- `payments` referencia pedido e centraliza status de Mercado Pago.
- `prescriptions` referencia pedido/cliente e armazena caminho privado do arquivo.
- `invoices` e `invoice_items` guardam NF-e simulada e DANFE futura.
- `stock_movements` registra entradas, saidas, perdas, devolucoes, inventarios e estornos.
- `api_keys`, `api_logs`, `incoming_webhooks` e `outgoing_webhooks` compoem a camada ERP/API.
- `loyalty_movements`, `coupons`, `promotions` e `replenishment_reminders` suportam fidelidade e marketing sem uso indevido de dados sensiveis.
- `admin_action_logs`, `sensitive_data_access_logs`, `payment_webhooks`, `webhook_logs` e `email_logs` compoem auditoria e observabilidade.

## Decisoes de Privacidade

- CPF deve ser armazenado mascarado, com hash para busca exata e campo criptografado somente se houver chave segura configurada.
- API keys, tokens de reset, tokens de carrinho abandonado e segredos de webhook ficam apenas como hash.
- Payloads de webhooks e API logs devem ser sanitizados antes de persistir.
- Receitas e arquivos fiscais simulados ficam em `storage`, fora de `public`.

## Status Criticos

- Pedido: recebido, aguardando pagamento, pagamento em analise, pagamento confirmado, aguardando receita, receita enviada, receita em validacao, receita aprovada, receita rejeitada, liberado pelo farmaceutico, em separacao, conferido, saiu para entrega, pronto para retirada, entregue, cancelado.
- Pagamento: aguardando pagamento, em analise, aprovado, recusado, cancelado, estornado, expirado, divergente.
- Clinico: nao exige receita, aguardando receita, receita enviada, em validacao, liberado, rejeitado, bloqueado para orientacao farmaceutica.
- NF-e simulada: emitida, cancelada.
