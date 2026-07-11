# FarmaVida Next — guia para o Claude Code

E-commerce de farmácia (Next.js 16 + React 19 + TS + Prisma/**PostgreSQL Neon**) com visual
**app premium** (vermelho dark). Multi-unidade (matriz + filial), estoque por unidade,
pedido roteado por CEP, admin escopado, Mercado Pago (Checkout Pro + PIX), assinaturas de
reposição e CSP estrita por nonce (montada no middleware `src/proxy.ts`).

## Convenções

- **Idioma:** UI e textos em **pt-BR**.
- **Estilo:** Tailwind v4 + tokens em `src/app/globals.css`. Use os utilitários `gradient-brand`, `container-page`, cores `brand-*`/`accent-*` e tokens semânticos (`bg-card`, `text-muted-foreground`, `border-border`). Dark mode por classe (`next-themes`). Marca = **vermelho** (`brand-*`, primary `#c81328`); azul-céu (`accent-*`) como apoio; **âmbar/dourado** (`promo-*`) só para ofertas. (Reversão em 10/07/2026 da marca teal-menta anterior, por decisão do dono.)
- **UI kit:** componentes próprios em `src/components/ui` (sobre Radix). Helper `cn` em `src/lib/utils.ts`.
- **Dados:** Prisma via singleton `src/lib/prisma.ts`. Server Components para ler, Server Actions para mutar.
- **Dinheiro:** `formatBRL` em `src/lib/utils.ts`.

## Comandos

- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test`
- `npm run db:migrate` · `npm run db:studio` (· `db:seed` **só em banco de dev**)
- `npm run test:e2e` → Playwright; local roda só specs de leitura, o fluxo completo (escritas) roda no CI com Postgres descartável
- `npm run shots` → screenshots de QA em `screenshots/` (Edge). Sempre revise o visual por screenshot ao mexer em telas.

## Ambiente — ATENÇÃO

- `DATABASE_URL` no `.env` aponta para o **Neon de PRODUÇÃO** (o mesmo do site no ar).
  Trate qualquer escrita como escrita em produção: **nunca** rode `db:seed`, e migrations
  só via `prisma migrate deploy` com autorização explícita do dono.
- Não comitar `.env` (apenas `.env.example`). Backups locais ficam em `backups/` (gitignored).
- Deploy: push na `main` → Vercel (automático). CI no GitHub Actions valida lint, tipos,
  unitários e e2e a cada push.
