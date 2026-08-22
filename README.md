# FarmaVida Next

E-commerce de farmácia com **cara de app premium** — **Next.js 16 + React 19 + TypeScript + Prisma (PostgreSQL/Neon)**.

## Stack

- **Next.js 16** (App Router, Server Components/Actions) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + UI kit próprio sobre **Radix** · ícones **lucide-react** · animações **framer-motion** · toasts **sonner**
- **Prisma 6** → **PostgreSQL** (Neon serverless; conexão *pooled* na app + *direta* nas migrations)
- **Auth.js v5** (credentials, papéis CUSTOMER/ADMIN)
- **Stripe** (cartão e Pix, quando habilitado) · **recharts** (gráficos do admin)

## Pré-requisitos

- **Node 22 LTS** (engine do projeto: `22.x`)
- Um banco **PostgreSQL** — recomendado **Neon** (console.neon.tech). Copie do painel as strings `DATABASE_URL` (*pooled*, com `-pooler` no host) e `DATABASE_URL_UNPOOLED` (direta).

## Setup

```bash
npm install
cp .env.example .env        # cole DATABASE_URL + DATABASE_URL_UNPOOLED (Neon) e gere AUTH_SECRET (npx auth secret)
npm run db:migrate          # aplica as migrations (cria as tabelas)
# SOMENTE com PostgreSQL local descartável; exige confirmação explícita:
$env:ALLOW_DESTRUCTIVE_SEED="I_UNDERSTAND_THIS_WILL_DELETE_DATA" # PowerShell
npm run db:seed
npm run dev                 # http://localhost:3000
```

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `start` | Build e execução de produção |
| `npm run lint` / `typecheck` | ESLint / checagem de tipos |
| `npm run db:migrate` | Aplica migrations (Prisma) |
| `npm run db:seed` | Recria dados demo; exige confirmação explícita e recusa produção/hosts remotos |
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
repositório**. Troque-a no primeiro acesso (*Minha conta → Segurança*) e cadastre
os demais usuários pelo próprio painel. Na loja pública, o primeiro login
administrativo é direcionado ao cadastro de MFA antes de liberar `/admin`;
clientes seguem para `/conta`.

## Pagamento (Stripe)

O checkout usa Stripe: cartão pela página hospedada e Pix nativo quando a conta
tem essa capability habilitada. Configure `STRIPE_SECRET_KEY` e
`STRIPE_WEBHOOK_SECRET` no secret manager e teste a conexão no painel. Sem
credenciais válidas, pagamentos online ficam indisponíveis.

## Política de catálogo

O canal é **MIP-only**: produtos classificados com `requiresPrescription=true`
ficam inativos e são excluídos do catálogo, busca, favoritos, assinaturas e
sitemap. O sistema não recebe nem valida novas receitas.

## Deploy

Hospedado na **Vercel** (deploy automático a cada push na `main`).

1. **Banco:** **PostgreSQL na Neon**. Use a integração **Storage → Neon** da Vercel — ela injeta `DATABASE_URL` (pooled) e `DATABASE_URL_UNPOOLED` (direta) automaticamente no ambiente.
2. **App:** importe o repositório na Vercel e configure as demais variáveis do `.env.example` (`AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_BASE_URL`, `STRIPE_SECRET_KEY`, etc.).
3. **Migrations:** após o deploy do código, rode `npm run db:migrate:deploy` (= `prisma migrate deploy`) apontando para a Neon. O build **não** depende do banco.
4. `npm run build` já gera o Prisma Client (também no `postinstall`).

Detalhes de variáveis e operação: ver [docs/DEPLOY.md](docs/DEPLOY.md) (técnico) e [docs/GO-LIVE.md](docs/GO-LIVE.md) (checklist regulatório + operacional).
