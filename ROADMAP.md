# Roadmap de melhorias — FarmaVida

> Estado atual: multi-farmácia no ar (matriz + filial), catálogo/preço compartilhados,
> estoque por unidade (`Inventory`), pedido roteado por CEP, admin escopado, pagamento
> via Mercado Pago, fidelidade, receitas e o visual **Aurora Glow**. Banco **PostgreSQL/Neon**,
> deploy **Vercel**.

Prioridade do mais urgente (P0) ao incremental (P4).

---

## P0 — Configuração operacional (destrava a operação real)

1. **Faixas de CEP por unidade.** Sem faixas, o roteamento sempre cai na matriz e a filial
   nunca recebe pedido automático. Cadastrar em **Admin → Unidades**.
   - Código: `resolvePharmacyByCep` em [src/lib/pharmacy.ts](src/lib/pharmacy.ts); CRUD em
     [src/components/admin/pharmacies-manager.tsx](src/components/admin/pharmacies-manager.tsx)
     (modelo `PharmacyCepRange`).
2. **Admin da filial.** Só existe o admin da matriz. Criar/vincular um usuário `ADMIN` com
   `pharmacyId` = filial (gerenciador de admins por unidade já existe no pharmacies-manager).
3. **Aplicar a migration pendente** `drop_legacy_product_stock` (`npm run db:migrate:deploy`)
   após o deploy do código atual — limpeza das colunas legadas `Product.stock/minStock`.

---

## P1 — Estrutural do multi-farmácia

4. **Frete por unidade/região.** Hoje o frete é global (`Setting` via
   [src/lib/settings.ts](src/lib/settings.ts) + cálculo em [src/lib/shipping.ts](src/lib/shipping.ts)).
   - Abordagem: campos de frete por unidade (`freeMin`, `flatFee`/tabela) no modelo `Pharmacy`
     ou tabela `ShippingRule(pharmacyId, …)`; `shippingFor()` passa a receber a unidade do
     carrinho (`cart.pharmacyId`); admin edita por unidade.
5. **Dados regulatórios por unidade (ANVISA).** CNPJ, **farmacêutico responsável (RT) + CRF**
   e horário hoje são globais via env (`NEXT_PUBLIC_PHARMACIST_*`, `NEXT_PUBLIC_CNPJ`).
   - Abordagem: o modelo `Pharmacy` já tem `phone/whatsapp/hours`; adicionar `cnpj`,
     `pharmacistName`, `pharmacistCrf`. Exibir os dados **da unidade que atende** no rodapé e
     no checkout (não os globais).

---

## P2 — Conversão & pós-venda

6. **PIX nativo com QR.** O enum `PIX` existe, mas o fluxo real é Mercado Pago/Checkout Pro.
   Pix direto (QR + copia-e-cola) reduz taxa e acelera a confirmação.
7. **Transferência de estoque entre unidades** (não só de pedido) + **reposição automática**
   quando o estoque bate `Inventory.minStock`.
8. **Notificar a equipe da unidade** ao receber/receber-por-transferência um pedido
   (e-mail via Resend já configurado; WhatsApp opcional).
9. **Assinatura / compra recorrente** de medicamento de uso contínuo (recompra previsível).

---

## P3 — Segurança & conformidade

10. **CSP em modo enforce com nonce.** Hoje é `Content-Security-Policy-Report-Only` em
    [next.config.ts](next.config.ts) — não bloqueia nada de fato.
11. **Log de auditoria do admin** (quem mudou status/estoque/preço e quando).
12. **LGPD self-service**: exportar e excluir dados do titular; consentimento granular.
13. **Medicamentos controlados**: receita retida / fluxo SNGPC, se for vender controlados.

---

## P4 — Busca, SEO, performance e qualidade

14. **Busca melhor**: hoje é `LIKE`; usar full-text / `pg_trgm` do Postgres + autocomplete.
15. **SEO**: já há JSON-LD; faltam `sitemap.xml`, OpenGraph por produto e metadata mais rica.
16. **Imagens**: blur placeholders no `next/image`; revisar emoji × foto.
17. **Testes e2e (Playwright)** dos fluxos críticos: login, checkout, transferência de pedido.
18. **CI com Postgres de serviço** para testes de integração (hoje os testes mockam o Prisma).
19. **Acessibilidade (a11y)**: foco, ARIA e contraste — revisar sob o tema Aurora Glow.

---

### Ordem sugerida de execução
P0 (1→2→3) → P1 (#4 frete por unidade, #5 dados regulatórios) → P2 (#6 PIX) → P3 (#10 CSP enforce).
