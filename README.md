# FarmaVida Next

E-commerce de farmácia com **cara de app premium** — reconstrução do zero em **Next.js 16 + React 19 + TypeScript + Prisma (MySQL)**.

> Substitui o sistema PHP `Teste-Web-vendas`, que permanece como **referência de regras de negócio**.

## Stack

- **Next.js 16** (App Router, Server Components/Actions) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + UI kit próprio sobre **Radix** · ícones **lucide-react** · animações **framer-motion** · toasts **sonner**
- **Prisma 6** → **MySQL** (XAMPP local)
- **Auth.js v5** (credentials, papéis CUSTOMER/ADMIN)
- **Mercado Pago** (pagamento) · **recharts** (gráficos do admin)

## Pré-requisitos

- **Node 20+** (testado em 25; se houver atrito, use Node 22 LTS)
- **MySQL do XAMPP** rodando na porta 3306 (Laragon MySQL e XAMPP disputam a porta → use um de cada vez)

## Setup

```bash
npm install
cp .env.example .env        # ajuste DATABASE_URL e AUTH_SECRET (npx auth secret)
# crie o banco no XAMPP (phpMyAdmin) OU:
#   "C:\xampp\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE farmavida_next CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npm run db:migrate          # cria as tabelas
npm run db:seed             # catálogo demo + admin + cliente
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

1. **Banco:** crie um MySQL gerenciado (PlanetScale, Railway, Aiven…). Aponte `DATABASE_URL`.
2. **App:** publique na **Vercel** (ou outro host Node). Configure as variáveis do `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_BASE_URL`, tokens do Mercado Pago).
3. **Migrations:** rode `npx prisma migrate deploy` no ambiente de produção (ou via build step).
4. `npm run build` já gera o Prisma Client (`postinstall`).

> Diferente do sistema PHP, este projeto roda em ambiente **Node**, não em hospedagem PHP compartilhada.
