# Front-end: implementação e validação — 03/09/2026

Este registro complementa a validação histórica de 02/09. Não representa
deploy, homologação de provedores financeiros ou aprovação de produção.

## Entrega

- Zero imports de Prisma/chamadas ao banco em páginas e layouts; 10 módulos
  de queries `server-only` com autorização/escopo e DTOs de apresentação.
- Zero imports diretos de Server Actions e `fetch` em componentes/hooks.
  `client/api` centraliza catálogo, sacola, checkout, pedidos, conta e admin.
- Contratos públicos independentes do ORM, códigos estáveis e mensagens
  seguras, preservando a compatibilidade dos formulários existentes.
- Separação dos componentes da loja em cart/checkout/orders/account e dos
  administrativos em inventory/orders/deliveries/finance/team.
- Trava síncrona em mutações, confirmação contextual, motivo quando suportado,
  recuperação após conflito e atualização com dados autoritativos.
- Cache curto por unidade, invalidação observável, leitura privada sem cache,
  descarte de respostas obsoletas e polling sem sobreposição.
- Pagamento em análise, confirmação, reembolso pendente/falho/concluído têm
  apresentação segura. Mudanças financeiras são acompanhadas independentemente
  do status do pedido; QR PIX antigo sai da tela após mudança confirmada.
- Cotação expira localmente após 12 segundos sem resposta. Não se inventa
  sucesso, não se repete mutação automaticamente e não se troca a chave
  idempotente após erro de confirmação incerta.
- UI/UX revisada com foco em teclado, diálogos, mensagens acessíveis, alvos de
  toque, contraste e preservação da identidade visual existente.

## Ambiente e evidências

Node 22.23.2 no processo, sem alterar o Node global. PostgreSQL 18.4 temporário
em loopback, banco `farmavida_frontend_test`, com as 37 migrations aplicadas e
fixtures de demonstração. Pagamentos/e-mail desativados. Nenhum banco remoto,
credencial de produção ou serviço financeiro real foi usado para mutações.

O Docker local falhou ao iniciar; foi usado
[embedded-postgres](https://github.com/leinelissen/embedded-postgres), instalado
somente em diretório temporário, sem adicionar dependências ao projeto.

Resultados da rodada final:

- `npm run check`: passou — arquitetura (341 módulos), lint, TypeScript,
  12 testes de arquitetura e 522 testes em 87 arquivos.
- `npm run build`: passou sobre o código final de produção.
- Playwright/Microsoft Edge: 26 cenários executados. A rodada final passou em
  25 e encontrou um seletor ambíguo do teste de dashboard, porque a nova tabela
  acessível repete o texto do título. O seletor foi corrigido para `heading`
  com nome exato; a reexecução passou (1/1). Assim, os 26 cenários ficaram
  validados sobre o build final, sem falhas pendentes.
- Compra com dinheiro até o pedido, login/logout, autorização do painel,
  perfil, catálogo, console/CSP e navegação por teclado exercitados.
- Checkout em 390 px com cotação atrasada e recuperação de cupom inválido;
  busca sem JavaScript; resposta antiga da busca descartada.
- Confirmação de estoque em 390 px: foco inicial no cancelamento, motivo
  obrigatório, nenhuma mutação sem motivo, Escape e retorno ao gatilho.
- Temas claro/escuro do diálogo capturados e inspecionados; teste de contraste
  do título em modo escuro exige pelo menos 4,5:1. Isso não é uma certificação
  WCAG de todas as combinações de cores do sistema.
- Revisão adicional no navegador integrado com a conta administrativa de
  demonstração, sem confirmar ajustes de estoque.
- `git diff --check`: passou; alterações anteriores preservadas. Sem commit,
  push ou deploy.

Capturas locais ficam em `screenshots/frontend/` (ignoradas pelo Git).
O servidor de QA e o PostgreSQL temporário foram encerrados após a validação;
não ficou um serviço de teste escutando nas portas 3210 ou 55439.

## Limites restantes

O aplicativo continua em um único deploy Next.js. A interface já usa
adaptadores/queries, mas parte do transporte ainda é Server Action por trás
dos adaptadores. Criar um back-end HTTP independente é uma etapa posterior.

Não foram homologados Stripe/PIX/reembolsos com provedores externos, leitores
de tela reais, todos os navegadores/dispositivos, nem a operação de produção.
Os E2E usam fixtures; os estados financeiros excepcionais são também cobertos
pelos testes de queries/contratos. Não foram executados nesta rodada os testes
de integração dedicados à concorrência transacional do back-end.
