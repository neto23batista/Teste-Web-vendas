# FarmaVida Next — guia para o Claude Code

Projeto novo (Next.js 16 + React 19 + TS + Prisma/MySQL) que reconstrói o e-commerce de farmácia com visual **app premium (estilo iFood Farmácia)**. O sistema PHP em `../Teste-Web-vendas` é apenas **referência de regras de negócio**.

## Convenções

- **Idioma:** UI e textos em **pt-BR**.
- **Estilo:** Tailwind v4 + tokens em `src/app/globals.css`. Use os utilitários `gradient-brand`, `container-page`, cores `brand-*`/`accent-*` e tokens semânticos (`bg-card`, `text-muted-foreground`, `border-border`). Dark mode por classe (`next-themes`).
- **UI kit:** componentes próprios em `src/components/ui` (sobre Radix). Helper `cn` em `src/lib/utils.ts`.
- **Dados:** Prisma via singleton `src/lib/prisma.ts`. Server Components para ler, Server Actions para mutar.
- **Dinheiro:** `formatBRL` em `src/lib/utils.ts`.

## Comandos

- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`
- `npm run db:migrate` · `npm run db:seed` · `npm run db:studio`
- `npm run shots` → screenshots de QA em `screenshots/` (Edge). Sempre revise o visual por screenshot ao mexer em telas.

## Ambiente

- MySQL do **XAMPP** (porta 3306). `DATABASE_URL` no `.env`.
- Não comitar `.env` (apenas `.env.example`).
