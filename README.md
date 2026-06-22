# FarmaVida Next

E-commerce de farmácia com **cara de app premium** — reconstrução do zero em **Next.js 16 + React 19 + TypeScript + Prisma (PostgreSQL/Neon)**.

> Substitui o sistema PHP `Teste-Web-vendas`, que permanece como **referência de regras de negócio**.

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
npm run db:seed             # catálogo demo + admin + cliente — NÃO rode contra produção
npm run dev                 # http://localhost:3000
```

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `start` | Build e execução de produção |
| `npm run lint` / `typecheck` | ESLint / checagem de tipos |
| `npm run db:migrate` | Aplica migrations (Prisma) |
| `npm run db:seed` | Popula dados demo |
| `npm run db:studio` | Abre o Prisma Studio |
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

## Contas de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| **Admin** | `owner@farmavida.local` | `Dono@Farma2026` |
| **Cliente** | `cliente@farmavida.local` | `Cliente@2026` |

> Admin entra direto no painel (`/admin`); cliente vai para a conta (`/conta`).

## Pagamento (Mercado Pago)

O checkout já está integrado ao Mercado Pago (preferência + webhook). **Sem um Access Token válido** no `.env` (`MERCADO_PAGO_ACCESS_TOKEN`), o fluxo cai num **pagamento simulado** na página do pedido — útil para demonstração. Com um token válido, o cliente é redirecionado ao Checkout Pro e o webhook confirma o pedido.

## Deploy

Hospedado na **Vercel** (deploy automático a cada push na `main`).

1. **Banco:** **PostgreSQL na Neon**. Use a integração **Storage → Neon** da Vercel — ela injeta `DATABASE_URL` (pooled) e `DATABASE_URL_UNPOOLED` (direta) automaticamente no ambiente.
2. **App:** importe o repositório na Vercel e configure as demais variáveis do `.env.example` (`AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_BASE_URL`, tokens do Mercado Pago, etc.).
3. **Migrations:** após o deploy do código, rode `npm run db:migrate:deploy` (= `prisma migrate deploy`) apontando para a Neon. O build **não** depende do banco.
4. `npm run build` já gera o Prisma Client (também no `postinstall`).

> Diferente do sistema PHP, este projeto roda em ambiente **Node** (serverless na Vercel), não em hospedagem PHP compartilhada.
