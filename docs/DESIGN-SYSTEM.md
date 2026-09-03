# FarmaVida — sistema de design

## Princípio

Saúde exige clareza, confiança e previsibilidade. A identidade vermelha permanece;
cores de apoio, fotografia real e conteúdo legível têm prioridade sobre efeitos.
Nenhuma nota estética substitui testes com clientes, pessoas com deficiência e
condições reais de rede. Esta especificação não é uma certificação WCAG.

## Cores e hierarquia

| Papel | Uso | Implementação |
| --- | --- | --- |
| Marca | CTA principal, identidade, preço | `brand-600` sobre branco; branco sobre `brand-600` |
| Informação | Instruções, entrega, segurança, número de etapa | `info` sobre `info-surface` |
| Sucesso | Confirmação recebida, economia confirmada | `success-600`; botão usa `success-solid` com branco |
| Erro | Texto e ícone de erro | `danger-500`, adaptado ao tema |
| Destrutivo | Exclusão, cancelamento, revogação | `destructive` / `destructive-foreground`, ícone de alerta, confirmação contextual |
| Superfícies | Formulários, tabelas, cartões | `background`, `card`, `muted`, `border` |

Não usar cor como único sinal. Combine status com texto e ícone. Não aplicar
`text-white` sobre `danger-500` ou `success-600`: esses tokens clareiam no escuro.
Foco usa azul, outline de 3 px e offset; nunca remover sem substituição visível.

## Tipografia e medidas

- Hanken Grotesk no corpo; Space Grotesk nos títulos, via `next/font`.
- Corpo e campos mobile: 16 px ou maior. Texto auxiliar: 14 px; rótulos muito
  compactos: pelo menos 12 px. Navegação inferior: 13 px.
- Nome completo, dosagem, apresentação e quantidade do produto não são ocultados
  por truncamento nos cartões. Valores numéricos usam formatação pt-BR.
- Alvos: mínimo 44 × 44 px; CTA principal e inputs: 48–52 px ou mais.
- Ritmo: múltiplos de 4 px; 16/24/32/48 px entre grupos de informação.
- Layout usa `minmax(0, 1fr)`, quebras de texto e altura mínima, não altura fixa
  para botões com texto. Zoom e tamanho de fonte não devem cortar ações.

## Movimento e composição

- Conteúdo e produtos já aparecem no HTML, antes de JavaScript/hidratação.
- As três fronteiras `loading.tsx` da loja foram removidas: o swap de HTML
  transmitido por Suspense depende de script e deixava a página em skeleton
  com JavaScript desativado. A loja entrega o HTML resolvido; o custo é aguardar
  a consulta inicial em vez de mostrar um skeleton vazio. Operações de API
  continuam com progresso/erro, e o painel conserva seu loading independente.
- Hero estático, neutro, com bloco azul informativo. Sem blobs, aurora colorida
  ou gradiente animado. Formulários e painel não recebem decoração contínua.
- Microinterações entre 150–300 ms; animação infinita somente para progresso.
- Carrossel parado por padrão; usuário pode iniciar, parar ou mudar slide.
- `prefers-reduced-motion` é respeitado no CSS e no provedor de movimento.
- Vidro fica restrito à navegação; superfície 94% opaca mantém legibilidade.

## Imagens

Use a embalagem real e exata. Não invente embalagens nem substitua por produto
parecido. `ProductImage` preserva a embalagem com `object-contain`, reserva espaço
e recupera falha de rede com placeholder neutro, ícone vetorial e nome acessível.
O rótulo visual é escondido em miniaturas, mas sua descrição acessível permanece.

Fotos próprias revisadas podem ficar em `public/products/`; veja seu README.
O cadastro aceita até 8 imagens. Caminhos locais aceitam somente arquivo raster
direto em `/products/`, sem query, traversal, SVG ou URL arbitrária. CDNs externas
continuam na allowlist existente. A existência/licença da imagem exige revisão editorial.

## Formulários e checkout

- Use `Field` com `htmlFor`, filho com o mesmo `id`, `hint`, `error` e `required`.
  Dicas e erros são associados por `aria-describedby`; descrições prévias são preservadas.
- Checkout: endereço → entrega → pagamento → revisão. Cabeçalhos são botões
  com `aria-expanded` e `aria-controls`; recolher não desmonta nem limpa campos.
- Continuar valida campos locais. Campo inválido em etapa recolhida abre a etapa
  e recebe foco. Revisão permanece disponível e mostra apenas total autoritativo.
- Observações opcionais ficam recolhidas. Não há segundo botão fixo de envio:
  isso evita duplicidade e colisão com a navegação inferior.
- Não habilitar compra sem cotação válida, repetir mutação automaticamente ou
  declarar pagamento aprovado antes da confirmação do servidor.
- Confirmações destrutivas têm resumo do efeito, alerta, cancelamento como foco
  inicial, trava de envio, recuperação de erro e retorno ao gatilho.

## Gráficos e desempenho

Recharts fica em módulo dinâmico administrativo. Gráficos não animam a entrada;
todo gráfico possui tabela expansível visível e acessível, sem depender de hover.
Tooltips usam superfície e texto do tema. HomeHero e BottomNav não importam Motion.

Metas de produção: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 no percentil 75 em dados
de campo. Esses números são metas, não resultados desta rodada. Use Speed Insights
e teste aparelho intermediário/4G. Compare JS transferido por rota antes/depois
de bibliotecas novas; investigar aumento > 20%. Não carregar engine de gráficos
ou módulos administrativos na loja. Evitar scripts novos sem justificativa.

## Gates de entrega

1. `npm run check` e `npm run build`.
2. E2E completos com banco descartável; `e2e/design-quality.spec.ts` cobre
   mobile/landscape/tablet/desktop, claro/escuro, axe, zoom, cores forçadas,
   teclado, conteúdo sem JS e preservação do checkout.
3. Inspecionar capturas em `screenshots/design/` (não versionadas).
4. Revisão humana: NVDA/VoiceOver, aparelhos reais, zoom 400%, longos conteúdos,
   rede lenta, processamento financeiro e dados regulatórios.
5. Não chamar axe sem violações de “certificação”; registrar escopo e limites.

## Manutenção de dependências

Next.js e `eslint-config-next` atualizados juntos para 16.3.3 nesta revisão.
Antes de um patch: aviso oficial, changelog, lockfile, check/build e E2E.
Não migrar bibliotecas maiores somente para obter uma versão mais nova.

NextAuth permanece em 5.0.0-beta.32: a revisão visual não altera sessões nem a
arquitetura de autenticação. Na manutenção de releases, verificar canal oficial,
changelog e estabilidade; migração exige regressão de login, MFA, sessão,
revogação e perfis. Não foi criado monitor recorrente nem feita migração especulativa.
