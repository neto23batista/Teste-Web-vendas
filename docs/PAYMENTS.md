# Pagamentos e homologação

O código mantém o adaptador Stripe existente. A organização das pastas não
ativa pagamentos, não cria conta no provedor e não configura credenciais.
Mantenha `PAYMENTS_ENABLED=false` até concluir a homologação autorizada.

## Onde está o código

- `src/lib/payments/stripe.ts`: comunicação com o provedor.
- `src/lib/payments/methods.ts`: métodos disponíveis conforme configuração.
- `src/lib/payments/reconciliation.ts`: recuperação e conciliação de estados.
- `src/lib/payments/return-refunds.ts`: liquidação de devoluções.
- `src/lib/orders/payment-events.ts` e `refunds.ts`: transições do pedido.
- `src/app/api/webhooks/stripe/route.ts`: entrada de eventos assinados.
- `src/app/api/cron/payments/route.ts`: conciliação periódica.

Os segredos ficam nas variáveis do ambiente/cofre, nunca em componentes,
documentação, commits ou capturas de tela. Na homologação, use credenciais de
teste. A configuração de produção é uma etapa separada e explícita.

Cartão/Pix só devem aparecer quando o servidor informa disponibilidade. Pix
também depende da habilitação na conta. Dinheiro na entrega, quando permitido
pelo fluxo atual, não representa uma confirmação financeira online.

O checkout não promete parcelamento: o adaptador atual não configura essa
modalidade. Quantidade de parcelas, juros e condições comerciais precisam ser
decididos e implementados antes de qualquer anúncio na interface.

## Checklist antes de habilitar pagamentos reais

- [ ] Confirmar conta, capacidades, moeda e métodos habilitados no provedor.
- [ ] Configurar segredos de teste e endpoint de webhook assinado.
- [ ] Validar cartão aprovado, recusado e sessão expirada.
- [ ] Validar Pix pendente, confirmado e expirado quando disponível.
- [ ] Validar eventos repetidos e recebidos fora de ordem.
- [ ] Validar confirmação tardia de pedido cancelado e tratamento financeiro.
- [ ] Validar reembolso confirmado, pendente e falho sem repetição de estoque.
- [ ] Exercitar conciliação, cron, alertas e retomada de falhas.
- [ ] Conferir totais de itens, frete, cupons, pontos e relatório financeiro.
- [ ] Registrar evidências e aprovação dos responsáveis por negócio e operação.
- [ ] Configurar produção por canal protegido e executar o smoke test aprovado.

Testes unitários e uma build verde não substituem o sandbox do provedor. Sem
credenciais e execução dessas etapas, a homologação permanece pendente.
Veja também [Operação](OPERATIONS.md) e [Go-live](GO-LIVE.md).
