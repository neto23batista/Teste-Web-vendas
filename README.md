# FarmaVida Next

E-commerce de farmácia com **cara de app premium** — **Next.js 16 + React 19 + TypeScript + Prisma (PostgreSQL/Neon)**.

## Stack

- **Next.js 16** (App Router, Server Components/Actions) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + UI kit próprio sobre **Radix** · ícones **lucide-react** · animações **framer-motion** · toasts **sonner**
- **Prisma 6** → **PostgreSQL** (Neon serverless; conexão *pooled* na app + *direta* nas migrations)
- **Auth.js v5** (credentials, papéis CUSTOMER/ADMIN)
- **Mercado Pago** (pagamento) · **recharts** (gráficos do admin)

## Pré-requisitos

- **Node 22 LTS** (engine do projeto: `22.x`)
- Um banco **PostgreSQL** — recomendado **Neon** (console.neon.tech). Copie do painel as strings `DATABASE_URL` (*pooled*, com `-pooler` no host) e `DATABASE_URL_UNPOOLED` (direta).

## Setup

```bash
npm install
cp .env.example .env        # cole DATABASE_URL + DATABASE_URL_UNPOOLED (Neon) e gere AUTH_SECRET (npx auth secret)
npm run db:migrate          # aplica as migrations (cria as tabelas)
npm run db:seed             # SÓ em banco de desenvolvimento — NUNCA em produção (recria demos e apaga dados reais)
npm run dev                 # http://localhost:3000
```

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `start` | Build e execução de produção |
| `npm run lint` / `typecheck` | ESLint / checagem de tipos |
| `npm run db:migrate` | Aplica migrations (Prisma) |
| `npm run db:seed` | Popula dados demo (**apenas** banco de desenvolvimento) |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes de navegador (Playwright) — fluxo completo roda no CI |
| `npm run shots` | Screenshots de QA (Edge + Playwright) em `screenshots/` |

## Estrutura

```
src/
  app/(store)/      loja (home, catálogo, produto, sacola, checkout)
  app/(account)/    conta do cliente
  app/admin/        painel administrativo
  app/api/          auth, webhooks
  components/       ui/ (kit) + store/ + admin/
  lib/              prisma, auth, utils, validators
prisma/             schema.prisma, seed.ts
```

## Primeiro acesso (produção)

O banco de produção é entregue **limpo** (sem dados de demonstração), com um único
administrador inicial — `admin@farmavida.local` — cuja senha é entregue **fora do
repositório**. Troque-a no primeiro acesso (*Minha conta → Meus dados*) e cadastre
os demais usuários pelo próprio painel. Admin entra direto em `/admin`; cliente vai
para `/conta`.

## Pagamento (Mercado Pago)

O checkout já está integrado ao Mercado Pago (preferência + webhook). **Sem um Access Token válido** no `.env` (`MERCADO_PAGO_ACCESS_TOKEN`), o fluxo cai num **pagamento simulado** na página do pedido — útil para demonstração. Com um token válido, o cliente é redirecionado ao Checkout Pro e o webhook confirma o pedido.

## Deploy

Hospedado na **Vercel** (deploy automático a cada push na `main`).

1. **Banco:** **PostgreSQL na Neon**. Use a integração **Storage → Neon** da Vercel — ela injeta `DATABASE_URL` (pooled) e `DATABASE_URL_UNPOOLED` (direta) automaticamente no ambiente.
2. **App:** importe o repositório na Vercel e configure as demais variáveis do `.env.example` (`AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_BASE_URL`, tokens do Mercado Pago, etc.).
3. **Migrations:** após o deploy do código, rode `npm run db:migrate:deploy` (= `prisma migrate deploy`) apontando para a Neon. O build **não** depende do banco.
4. `npm run build` já gera o Prisma Client (também no `postinstall`).

Detalhes de variáveis e operação: ver **DEPLOY.md** (técnico) e **GO-LIVE.md** (checklist regulatório + operacional).
