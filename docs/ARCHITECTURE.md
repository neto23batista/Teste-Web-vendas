# Arquitetura e convenções

O projeto continua sendo uma aplicação Next.js com App Router. A organização
separa entradas de servidor, interface e regras de negócio, sem mudar as URLs
nem a localização exigida pelo framework para rotas, `auth.ts`, `proxy.ts` e
instrumentação.

## Responsabilidades

- `src/app/`: páginas, layouts, Route Handlers e composição dos fluxos.
- `src/actions/admin/`: operações da equipe, sempre com autorização por
  perfil/unidade; catálogo, estoque, compras, pedidos, entregas e gestão.
- `src/actions/account/`: operações do cliente autenticado e ciclo de identidade.
- `src/actions/store/`: carrinho, checkout, unidade ativa e ações da loja.
- `src/components/`: apresentação e interação, divididas pelas áreas existentes.
- `src/hooks/`: estado e efeitos reutilizáveis do cliente.
- `src/lib/`: políticas, consultas, transações e adaptadores de infraestrutura.
- `src/types/`: tipos compartilhados de integrações e augmentations.

Server Actions são entradas remotas: todo export de execução de um arquivo com
`"use server"` deve ser uma função assíncrona autorizada e validada. Helpers não
devem ser exportados desses arquivos; ficam em `lib/`. A diretiva não substitui
controle de acesso, validação de payload nem transações.

`lib/` não importa código de execução de `actions/`, `app/`, `components/` ou
`hooks/`. A interface pode chamar uma Server Action pela fronteira RPC do Next,
mas não pode carregar Prisma, segredos privados ou APIs de servidor no bundle
do navegador. Imports exclusivos de tipos não criam dependências de execução.

## Domínios de `lib/`

| Pasta             | Responsabilidade                                                          |
| ----------------- | ------------------------------------------------------------------------- |
| `auth/`           | Sessões, senhas, MFA, permissões e validação de identidade                |
| `catalog/`        | Consulta, busca, detalhes, imagens, política MIP e formulários de produto |
| `commerce/`       | Carrinho, cupons, cotação, fidelidade e reposição recorrente              |
| `inventory/`      | Movimentos, lotes, reservas, transferências e estoque do catálogo         |
| `orders/`         | Criação, atendimento, cancelamento, reembolso e eventos de pagamento      |
| `payments/`       | Stripe, métodos disponíveis, conciliação e liquidação de devoluções       |
| `admin/`          | Consultas e relatórios administrativos, escopo e dashboard                |
| `shipping/`       | Endereços, persistência, frete e consulta de CEP                          |
| `communications/` | E-mails, templates e notificações                                         |
| `storage/`        | Arquivos, uploads e exclusões controladas                                 |
| `security/`       | Rate limit, autenticação de cron e limites de requisição                  |
| `operations/`     | Readiness e proteções de seed, handover e bancos de teste                 |

Infraestrutura transversal pequena, como `prisma`, `env`, `audit`, `settings`,
`monitoring` e utilitários de dinheiro, permanece na raiz de `lib/`. Não crie
uma pasta para cada função nem use essa raiz para novos módulos extensos.

Os `index.ts` de `catalog/`, `orders/` e `admin/` mantêm exports públicos
explícitos. Dentro do mesmo domínio, importe o módulo responsável diretamente
para evitar ciclos. Evite barris amplos que misturem cliente e servidor.

Políticas compartilhadas com o cliente precisam ser puras. Por exemplo,
`commerce/subscription-policy.ts` contém intervalos e rótulos, enquanto
`commerce/subscriptions.ts` é restrito ao servidor e consulta o banco.

## Estoque e checkout

Mudanças de saldo precisam registrar movimentos dentro da mesma transação que
altera o estoque. O estoque agregado é travado antes dos lotes. Transferências
travam as duas unidades em ordem estável; validade e rastreabilidade não podem
ser descartadas para fazer uma operação passar.

O cadastro registra o estoque inicial. A edição de produto altera dados e
oferta, mas não reaplica o saldo de um formulário que pode estar desatualizado.
Importações com contagem explícita geram o movimento da diferença e recusam
saldo inferior às quantidades rastreadas em lotes.

`components/store/checkout-form.tsx` coordena o estado e o envio. As seções em
`components/store/checkout/` cuidam de endereço, entrega, pagamento e resumo;
`hooks/use-checkout-quote.ts` coordena a cotação, descarta respostas obsoletas e
permite nova tentativa após falha. O servidor continua sendo a autoridade sobre
preço, frete, pontos e métodos de pagamento.

## Convenções e verificação

- Arquivos e pastas em `kebab-case`; componentes e tipos em `PascalCase`.
- Alias `@/` para referências entre áreas; caminhos relativos curtos dentro do
  mesmo módulo são aceitáveis.
- Testes locais próximos do código em `__tests__/`; PostgreSQL real em
  `integration/`; fluxos de navegador em `e2e/`.
- `.editorconfig`: UTF-8, finais de linha LF, dois espaços e newline final.
- `scripts/quality/`: checagens; `scripts/qa/`: ferramentas de QA;
  `scripts/assets/`: geração de assets; `scripts/ops/`: operação sensível manual.
- Migrações históricas são imutáveis. A remoção da integração InovaFarma não
  autoriza apagar as migrações que a criaram e depois a removeram.

`npm run check:architecture` verifica resolução e caixa dos imports locais,
fronteiras cliente/servidor, direção das dependências, exports das ações, ciclos
de execução entre módulos de `lib/` e limite de 650 linhas por módulo de
produção. Seus próprios testes rodam em `npm run test:architecture`.

Essa checagem é estática e deliberadamente limitada; não é prova de segurança,
autorização correta nem isolamento de dados. Ela complementa revisão, testes
de comportamento, testes com banco e a build do Next.js.
