# Deploy na Vercel — FarmaVida

Checklist para colocar a loja no ar. O código já está pronto (`lint`/`typecheck`/`build` verdes,
headers de segurança, validação de webhook, env validado no boot). O que falta é **configuração**.

---

## 0. Pré-requisitos
- Repositório no GitHub (já existe).
- **Banco MySQL gerenciado** (PlanetScale, Railway, Aiven, etc.). O XAMPP é só para desenvolvimento.
- **Bucket S3 ou Cloudflare R2** para as receitas (ver passo 2 — obrigatório na Vercel).

---

## 1. Banco de dados (produção)
1. Crie um MySQL gerenciado e copie a *connection string*.
2. **Serverless precisa de pool de conexões** — senão a Vercel estoura o limite do MySQL:
   - acrescente `?connection_limit=5` ao fim da `DATABASE_URL`, **ou**
   - use **PlanetScale** (pool nativo) / **Prisma Accelerate**.
3. Aplique as migrations no banco de produção (rode uma vez, da sua máquina):
   ```bash
   # PowerShell:
   $env:DATABASE_URL="mysql://...prod..."; npx prisma migrate deploy
   ```
4. (Opcional) Popular catálogo demo: `npm run db:seed` com a mesma `DATABASE_URL`.

---

## 2. Armazenamento de receitas — ⚠️ CRÍTICO na Vercel
A Vercel é **serverless**: o disco é apagado a cada requisição/deploy. O driver padrão (`local`)
**perde os arquivos**. Use S3/R2:
- Crie um bucket **privado** (R2 da Cloudflare é barato e tem free tier).
- Variáveis: `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
  (para R2/MinIO, também `S3_ENDPOINT`).

---

## 3. Importar na Vercel
1. https://vercel.com → **New Project** → importe o repositório do GitHub.
2. Framework detectado: **Next.js** (build/output padrão — não mexa).

---

## 4. Variáveis de ambiente (Settings → Environment Variables)
**Obrigatórias:**
- `DATABASE_URL` — string do passo 1 (com pool).
- `AUTH_SECRET` — gere com `npx auth secret`.
- `NEXT_PUBLIC_BASE_URL` — `https://seu-projeto.vercel.app` (**https!** os cookies seguros dependem disso).
- `AUTH_URL` — a mesma URL `https://...` (recomendado na Vercel).

**Pagamento (para vender de verdade):**
- `MERCADO_PAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`, `MERCADO_PAGO_WEBHOOK_SECRET`.

**Receitas:** `STORAGE_DRIVER=s3` + `S3_*` (passo 2).

**Opcionais:** `RESEND_API_KEY` + `MAIL_FROM` (e-mails), `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` (erros),
`NEXT_PUBLIC_PHARMACIST_NAME` / `NEXT_PUBLIC_PHARMACIST_CRF` / `NEXT_PUBLIC_CNPJ` (rodapé/ANVISA).

---

## 5. Migrations a cada deploy
A Vercel **não** roda migrations sozinha. Escolha:
- **A — manual (mais simples):** rode `prisma migrate deploy` (passo 1.3) sempre que mudar o schema.
- **B — automático:** em *Settings → Build & Development → Build Command*, use:
  `prisma migrate deploy && next build`
  (roda a migration em todo deploy; ok para um único ambiente de produção).

---

## 6. Mercado Pago (webhook)
1. Painel do Mercado Pago → **Webhooks** → URL: `https://seu-dominio/api/webhooks/mercadopago`.
2. Copie o **segredo de assinatura** para `MERCADO_PAGO_WEBHOOK_SECRET`.
3. Em produção o pagamento é **real** — o atalho de pagamento simulado fica **desativado** (`NODE_ENV=production`).

---

## 7. Pós-deploy (checklist)
- [ ] Home carrega e o login funciona.
- [ ] **Troque/remova as contas demo do seed** (`owner@farmavida.local`, `cliente@farmavida.local`).
- [ ] Fazer um pedido de teste → pagamento real aprovado no Mercado Pago.
- [ ] Upload de receita no checkout → o admin consegue abrir (confirma que o S3 está ok).
- [ ] Conferir o rodapé com os dados regulatórios da farmácia (CNPJ/farmacêutico).

### Features de praticidade (cliente e dono)
- [ ] **Busca instantânea:** digitar 2+ letras no header mostra o dropdown de sugestões.
- [ ] **Favoritos:** o coração nos cards/produto salva e a página `/conta/favoritos` lista.
- [ ] **Comprar novamente:** botão em um pedido antigo repõe os itens na sacola.
- [ ] **Dashboard:** `/admin` mostra ticket médio e as variações de 30 dias (▲▼).
- [ ] **Badges no admin:** a sidebar mostra contadores (pedidos/receitas/estoque).
- [ ] **Exportar CSV:** `/admin/pedidos` → "Exportar CSV" baixa o arquivo (respeita o filtro).

---

## Recomendação importante
**Tire o projeto da pasta do OneDrive.** O OneDrive já apagou/sincronizou arquivos do projeto uma vez
(recuperados pelo git). Para desenvolver local com segurança, mova para algo como `C:\dev\farmavida`
(fora de pastas sincronizadas).
