# FarmaVida — validação da revisão de design

Data: 03/09/2026. Escopo: implementação visual, interação, acessibilidade
automatizada e regressão local. Não houve deploy nem alteração do banco de produção.

## Resultado final

| Verificação | Resultado |
| --- | --- |
| Build de produção Next.js 16.3.3, incluindo TypeScript | Aprovado |
| ESLint | Aprovado |
| Testes unitários, de ações e componentes | 535 aprovados, em 90 arquivos |
| Testes das regras de arquitetura | 12 aprovados |
| Verificação de dependências de arquitetura | 341 módulos verificados |
| E2E completos no Microsoft Edge | 36 aprovados; execução final em 2,8 minutos |
| Cenários novos específicos de design | 10, incluídos nos 36 E2E |
| axe nos estados cobertos pelos testes | Nenhuma violação detectada |

O build e os E2E foram repetidos após os últimos ajustes de legibilidade.
A documentação foi finalizada depois dessa execução, sem mudanças adicionais
no código de execução. Nenhum commit, push ou publicação foi realizado.

## Cobertura visual e de interação

- Página inicial em 375 px, 844 px em paisagem, 768 px e 1440 px, em temas claro
  e escuro, com preferência por movimento reduzido e checagem de erros de página.
- Fonte raiz ampliada a 200%, cores forçadas e foco em viewport móvel.
- Checkout por etapas: preservação de valores, abertura da etapa inválida,
  foco, revisão e confirmação sem sobreposição da navegação inferior.
- Compra de ponta a ponta no ambiente isolado, com pagamento externo desabilitado.
- Tabelas alternativas dos gráficos administrativos e inspeção com axe.
- HTML legível de início, catálogo e produto com JavaScript desabilitado.
- Falha de carregamento de foto e recuperação com placeholder acessível.
- Confirmação destrutiva em ambos os temas, cancelada sem efetivar ajuste de estoque.
- Regressões existentes de vitrine, busca, CSP, teclado e layout móvel.

Axe foi executado com regras WCAG 2 A/AA e WCAG 2.1 AA nas telas e estados
definidos em `e2e/design-quality.spec.ts`. Isso não equivale a certificação de
acessibilidade nem cobre todos os caminhos, conteúdos e tecnologias assistivas.

## Problemas encontrados e corrigidos durante a validação

- Contraste dos controles do carrossel e legibilidade dos selos pequenos.
- Quebras de texto e disposição de cartões com fonte ampliada.
- Conteúdo preso no skeleton sem JavaScript: removidas as três fronteiras
  `loading.tsx` da loja, catálogo e produto. São recuperáveis pelo histórico Git.
  A loja agora aguarda os dados para entregar HTML resolvido; o painel mantém
  seu loading independente.
- Divergência de hidratação ao ler preferência por movimento reduzido.
- Elemento focável dentro da representação visual oculta de gráfico de pizza.
- Espaço vazio em slides de alturas diferentes.

## Ambiente e segurança

Os testes usaram Node.js 22.23.2, servidor local em `localhost:3210` e um cluster
PostgreSQL descartável em `127.0.0.1:55439`, com banco UTF-8 exclusivo de teste.
Foram aplicadas 37 migrações e carregados 38 produtos fictícios de demonstração.
Pagamentos e e-mail externos ficaram desabilitados. Credenciais e dados de
produção não foram utilizados. O ambiente de teste foi encerrado ao concluir.

Para repetir, configure o ambiente isolado conforme `DEVELOPMENT.md` e use
`npm run test:design`, ou `npm run test:e2e` para toda a suíte de navegador.
Não execute seed ou testes de escrita contra banco de produção.

## Evidências visuais locais

Capturas reais do navegador ficam em `screenshots/design/`, fora do versionamento:

- `home-desktop-light.png` e `home-desktop-dark.png`;
- `home-mobile-light.png` e `home-mobile-dark.png`;
- `home-tablet-light.png` e `home-landscape-light.png`;
- `checkout-light.png`, `checkout-dark.png` e `checkout-confirmacao-mobile.png`;
- `confirmacao-destrutiva-light.png` e `confirmacao-destrutiva-dark.png`;
- `catalogo-high-contrast-200.png` e `admin-desktop.png`.

As capturas de viewport evitam interpretações incorretas de elementos sticky
que podem ocorrer em imagens compostas de página inteira.

## Limites e trabalho externo necessário

1. **Fotos reais:** o código está preparado, mas as imagens oficiais/licenciadas
   de cada apresentação de produto precisam ser fornecidas e revisadas.
   Não foram inventadas embalagens ou usadas fotos de medicamentos parecidos.
2. **Acessibilidade humana:** NVDA/VoiceOver, dispositivos físicos, zoom a 400%
   e testes com usuários continuam necessários.
3. **Desempenho real:** LCP, INP e CLS de campo, aparelho intermediário e redes
   lentas não foram medidos nesta rodada. Os valores em `DESIGN-SYSTEM.md` são metas.
4. **Operação:** provedores financeiros, reembolsos reais, dados regulatórios,
   produção e homologação não são certificados por estes testes locais.
5. **Dependências:** NextAuth continua em 5.0.0-beta.32; uma migração de autenticação
   exige revisão própria. Atualização visual não significa atualizar todas as
   bibliotecas para versões maiores ou experimentais.

A direção de design segue clareza e confiança adequadas a uma farmácia:
superfícies neutras, identidade vermelha, informação azul, movimento discreto
e estados explícitos. “10/10” permanece uma meta de qualidade, não uma nota
comprovada por testes automatizados.
