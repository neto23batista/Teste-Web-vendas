# Multi-filial FarmaVida

## Diagnostico

O sistema tinha catalogo, carrinho, pedidos, pagamentos, receitas, estoque e relatorios operando como loja unica. As tabelas criticas nao carregavam `id_filial`, e o estoque real era `products.current_stock`, o que faria duas lojas compartilharem saldo, pedidos e indicadores.

## Modelo aplicado

- `filiais`: cadastro operacional da loja.
- `estoque_filial`: saldo, minimo, maximo e localizacao por produto e filial.
- `id_filial` nas tabelas criticas: `users`, `admins`, `carts`, `orders`, `payments`, `payment_webhooks`, `prescriptions`, `prescription_audits`, `stock_movements`, `stock_alerts`, `stock_inventories`, `delivery_zones`, `delivery_people`, `delivery_assignments`, `operating_hours`, `invoices`, `email_logs`, `admin_action_logs` e `api_keys`.
- Views de relatorio recriadas com `id_filial`.
- Modulos novos: fornecedores, ordens de compra, caixa, notas fiscais preparadas para provedor real, zonas/entregas em portugues, jobs, cache, WhatsApp logs, servicos clinicos, agenda por filial, transferencia formal de estoque, resgate de pontos e avaliacoes moderadas.

## Seguranca

- `BranchService` centraliza filial atual, filtro selecionado e bloqueio de acesso cruzado.
- `admin_geral`/`owner` pode ver todas as filiais.
- `gerente_loja`, `farmaceutico` e `funcionario` ficam limitados a `id_filial`.
- `OrderService`, `StockService`, `PrescriptionService`, `ReportService`, API e telas administrativas validam filial no backend.
- Receitas acessadas por arquivo passam por auditoria sensivel.

## Estoque

`estoque_filial` passa a ser a fonte operacional. `products.current_stock` e sincronizado como soma de compatibilidade para telas antigas e catalogo.

## Fiscal

`FiscalService` registra solicitacoes em `notas_fiscais`. Sem `FISCAL_API_TOKEN`, o status fica `homologacao_simulada`; o sistema nao afirma emissao fiscal real.

## Jobs

E-mails e WhatsApp sao enfileirados em `jobs`. Execute:

```bash
php scripts/process_jobs.php
```

## Migracao

```bash
php scripts/migrate.php
```

A migration `018_multi_branch_operations.sql` e idempotente: checa colunas, indices e constraints antes de criar.
A migration `019_customer_experience_workflows.sql` completa os fluxos de experiencia: desconto por pontos no pedido, campos de moderacao, indice de agenda e permissoes de avaliacoes/servicos.

## Testes

```bash
php tests/Feature/multi_branch_operations_test.php
php tests/Feature/customer_experience_workflows_test.php
php tests/Feature/stock_prescription_webhook_test.php
php scripts/lint_php.php
```

## Validacao manual

1. Crie ou confirme uma filial em `/admin/configuracoes` executando a migration.
2. Entre como admin geral e alterne a filial no topo do admin.
3. Cadastre estoque diferente do mesmo produto por filial.
4. Crie pedido na filial A e aprove pagamento: apenas o saldo da filial A deve baixar.
5. Entre como gerente/farmaceutico vinculado a filial A e tente abrir pedido/receita da filial B: o backend deve negar.
6. Abra `/admin/relatorios` e compare "Todas as filiais" contra uma filial especifica.
7. Abra e feche caixa em `/admin/caixa` para uma filial.
8. Cadastre fornecedor e ordem em `/admin/compras`; ao receber, o estoque da filial selecionada e movimentado.
9. Acesse `/cliente/pontos`, resgate pontos no checkout e confirme que `orders.loyalty_discount` e `loyalty_redemptions` foram preenchidos.
10. Acesse `/cliente/servicos`, agende um servico por filial e acompanhe em `/admin/servicos`.
11. Envie avaliacao a partir de um pedido aprovado/entregue e modere em `/admin/avaliacoes`; apenas avaliacoes aprovadas aparecem no produto.
12. Solicite transferencia em `/admin/estoque/transferencias`, avance por aprovada, em transporte e concluida; a origem baixa no envio e o destino entra na conclusao.
