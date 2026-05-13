# FarmaVida - Estrutura de Pastas

```text
/
  app/
    Controllers/
      Admin/
      Api/
      Auth/
      Customer/
    DTO/
    Exceptions/
    Helpers/
    Middlewares/
    Models/
    Repositories/
    Services/
    Validators/
  bootstrap/
  config/
  database/
    factories/
    migrations/
    seeders/
  docs/
    database/
  public/
    assets/
      css/
      icons/
      img/
      js/
    uploads-disabled/
  resources/
    emails/
      layouts/
      partials/
    views/
      admin/
      auth/
      components/
      customer/
      layouts/
      store/
  routes/
  scripts/
  storage/
    cache/
      views/
    logs/
      app/
      audit/
      emails/
      payments/
      security/
      webhooks/
    uploads/
      invoices/
      prescriptions/
      products/
      tmp/
  tests/
    Feature/
    Unit/
    fixtures/
```

## Regras de Organizacao

- Apenas `public/` deve ser exposto pelo Apache.
- `storage/uploads/prescriptions` e `storage/uploads/invoices` sao privados e nunca devem ser acessados por URL direta.
- Controllers nao devem acessar `$_POST`, `$_GET` ou SQL diretamente fora dos objetos de request/validacao definidos no modulo futuro.
- Services executam regras e transacoes.
- Repositories concentram PDO e queries.
- Views recebem dados prontos e nao executam regra de negocio.
- Rotas admin, loja, cliente, auth, API e webhooks ficarao separadas por arquivo.
- Migrations e seeders devem ser executados por runner controlado, registrando status em `migrations`.

## Entrega Atual

Esta entrega cria a base para os proximos modulos. Arquivos de configuracao, roteador, controllers, services, views, testes funcionais e README completo serao entregues nas proximas etapas solicitadas.

