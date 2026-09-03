# Validação local — 02/09/2026

> Registro histórico. A implementação e os testes posteriores do front-end,
> incluindo execução em navegador com banco temporário, estão em
> [FRONTEND-VALIDATION.md](FRONTEND-VALIDATION.md).

Registro da reorganização e das correções locais. Este documento não é uma
aprovação de go-live nem comprova uma execução de CI, staging ou produção.

## Escopo entregue

- Server Actions separadas em administração, conta e loja; regras e serviços
  separados por domínio. Imports e testes acompanharam as mudanças.
- Módulos extensos de pedidos, catálogo e consultas administrativas divididos
  por responsabilidade, mantendo entradas públicas explícitas.
- Checkout separado em seções e hook de cotação; tratamento de falha/retry,
  rótulos e foco acessíveis, sem promessa de parcelamento não implementado.
- Política de assinaturas separada das consultas restritas ao servidor.
- Cadastro/edição/importação de produtos integrados ao livro-razão de estoque.
  Saldo antigo do formulário não é reaplicado na edição; CSV vazio preserva o
  saldo, contagens inválidas são recusadas e alterações da linha são atômicas.
- Correções anteriores de lotes, validade, reservas, transferências, devoluções
  e fluxo dedicado de entrega preservadas com seus testes.
- Scripts organizados por função, checagem de arquitetura incorporada ao
  comando `check`, documentação renovada e ambiente descartável de testes
  preparado para uso local e CI.

## Resultados observados

Comandos executados com **Node v22.23.2**, compatível com `engines` e `.nvmrc`.
Esse runtime foi usado no processo de validação; a instalação global do Node
da máquina não foi alterada.

| Verificação                                         | Resultado                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run check:architecture`                        | Aprovada: 296 módulos de produção                                            |
| `npm run lint`                                      | Aprovada                                                                     |
| `npm run typecheck`                                 | Aprovada                                                                     |
| `npm run test:architecture`                         | 10 testes aprovados                                                          |
| `npm test`                                          | 441 testes aprovados em 73 arquivos                                          |
| `npm run check`                                     | Sequência completa aprovada após as últimas correções de código              |
| `npm run build`                                     | Build de produção Next.js concluída após as últimas correções                |
| `prisma validate`                                   | Schema válido                                                                |
| `npm audit --omit=dev --audit-level=high`           | Nenhuma vulnerabilidade nas dependências de produção                         |
| `npm ls fast-uri --all`                             | Versão instalada 3.1.7                                                       |
| `docker compose -f compose.test.yml config --quiet` | Configuração aceita; não inicia o banco                                      |
| `vitest list --config vitest.integration.config.ts` | 7 cenários coletados; não executados                                         |
| `playwright test --list`                            | 22 cenários coletados em 5 arquivos; não executados                          |
| `git diff --check`                                  | Sem erros de whitespace nas alterações rastreadas                            |
| Conferência das realocações                         | 125 arquivos rastreados removidos dos caminhos antigos têm destino existente |
| Links locais da documentação                        | Sem destinos ausentes na conferência final                                   |

A build e a validação do schema usaram URL PostgreSQL local de validação e
segredo efêmero somente no processo. Não usaram credenciais de produção nem
aplicaram migrações. As rotas dinâmicas compiladas não foram, por isso,
comprovadas contra um banco real.

## Pendências que exigem ambiente

- **PostgreSQL real:** Docker Desktop está instalado, mas o engine não está
  disponível. Os 7 cenários de integração ainda precisam ser executados após
  subir o serviço descartável e aplicar migrações. Concorrência/rollback reais
  não estão certificados apenas pelos mocks.
- **Navegador/E2E:** os 22 cenários foram apenas listados. Falta servidor com
  banco migrado e fixtures para validar compra, login, administração e layout
  no navegador. Não foi deixado um servidor local em execução.
- **Pagamentos e e-mail:** não há credenciais de homologação configuradas neste
  ambiente. Nenhum pagamento real foi ativado ou provedor certificado.
- **Operação/go-live:** migrações de staging, sandbox dos provedores, backup,
  restauração e aprovação dos responsáveis continuam pendentes conforme
  [GO-LIVE.md](GO-LIVE.md).

O procedimento para banco descartável e E2E está em
[DEVELOPMENT.md](DEVELOPMENT.md); a homologação financeira está em
[PAYMENTS.md](PAYMENTS.md). Não envie segredos pelo chat nem os versione.

## Preservação e limites da limpeza

Schema e migrações históricas foram preservados. Nenhum reset de Git, commit,
push, deploy, seed ou limpeza de banco foi executado. Arquivos de ambiente,
uploads privados, dependências e artefatos locais não foram apagados.

Pastas vazias legadas, como `connector/mock`, permanecem no disco porque o
ambiente bloqueou sua exclusão. Elas não contêm código a migrar e não são
versionadas pelo Git. A organização do código não depende dessa remoção.
