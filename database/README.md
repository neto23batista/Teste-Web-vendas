# FarmaVida - Banco de Dados

## Como usar nesta fase

Execute as migrations em ordem numerica a partir de `database/migrations`. Em uma etapa futura sera entregue o runner PHP com painel visual e controle pela tabela `migrations`.

Ordem:

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

Depois execute os seeders em `database/seeders`, tambem em ordem numerica.

Seeders de demonstracao:

- `004_admin_operational_orders_demo.sql` popula nove pedidos realistas para a fila operacional do admin: pagamento pendente, pagamento aprovado, receita em validacao, item controlado bloqueado, urgente, com problema, separacao, expedicao e concluido. Ao ser reexecutado, ele atualiza os pedidos `FV-DEMO-OP-*` e recria apenas os detalhes filhos desses cenarios.

## Observacoes

- Os seeders nao incluem credenciais reais.
- Configuracoes sensiveis sao criadas com valor `NULL`; os modulos futuros carregarao valores via `.env` ou painel seguro.
- A NF-e desta modelagem e apenas simulada.
- Uploads de receitas e DANFE simulada devem ficar em `storage`, fora de `public`.
