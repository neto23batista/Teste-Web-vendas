# Checklist de go-live — FarmaVida

Guia para colocar a loja no ar como **farmácia real**. Três blocos: regulatório
(jurídico/operacional), técnico (deploy + variáveis) e verificação final.

---

## 1. Regulatório (obrigatório antes de vender medicamento no Brasil)

> Isto é jurídico/operacional — o software dá suporte, mas a responsabilidade é da operação.

- [ ] **CNPJ** ativo com atividade de comércio varejista de produtos farmacêuticos.
- [ ] **Licença/AFE da ANVISA** e licença sanitária estadual/municipal vigentes.
- [ ] **Farmacêutico(a) responsável técnico(a)** com CRF ativo (exibido no rodapé do site).
- [ ] Conformidade com a **RDC ANVISA nº 44/2009** (dispensação a distância de medicamentos).
- [ ] **SNGPC** configurado para escrituração de medicamentos controlados (se for vender).
- [ ] **Nota fiscal (NF-e)** integrada ao faturamento.
- [ ] **Termos de uso** e **Política de Privacidade (LGPD)** revisados por jurídico
      (páginas já existem em `/termos` e `/privacidade`).
- [ ] Encarregado de dados (DPO) definido para a LGPD.

Configurar no `.env` (aparecem no rodapé):
`NEXT_PUBLIC_PHARMACIST_NAME`, `NEXT_PUBLIC_PHARMACIST_CRF`, `NEXT_PUBLIC_CNPJ`.

---

## 2. Técnico — variáveis de ambiente

Copie `.env.example` → `.env` (produção) e preencha:

### Obrigatórias (o boot falha sem elas — ver `src/lib/env.ts`)
| Variável | O quê |
|---|---|
| `DATABASE_URL` | PostgreSQL de produção (Neon, string *pooled*; junto com `DATABASE_URL_UNPOOLED` para migrations) |
| `AUTH_SECRET` | gere com `npx auth secret` |

### Recomendadas para produção
| Variável | O quê | Sem ela |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | URL pública `https://...` | cookies seguros / links de e-mail quebram |
| `AUTH_TRUST_HOST` | `"true"` atrás de proxy | login pode falhar |
| `PAGBANK_TOKEN` | pagamento real (PIX + cartão via PagBank) | checkout cai no **pagamento simulado** |
| `PAGBANK_SANDBOX=1` | aponta para o sandbox do PagBank (testes) | usa produção |
| `RESEND_API_KEY` + `MAIL_FROM` | e-mails transacionais (Resend) | e-mails só no console |
| `STORAGE_DRIVER=s3` + `S3_*` | storage de receitas (S3/R2/MinIO) | em serverless as receitas **somem** |

### Opcionais
| Variável | O quê |
|---|---|
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | monitoramento de erros |
| `UPLOAD_DIR` | pasta de uploads no driver local (VPS/Docker) |

> **Storage:** em **serverless** (Vercel/Netlify) o disco é efêmero — use
> `STORAGE_DRIVER=s3`. Em **VPS/Docker**, o driver local com `UPLOAD_DIR` num volume
> persistente também serve.

---

## 3. Deploy

### 3a. Vercel (recomendado — runtime Next nativo)

A Vercel roda o Next nativamente, então **não** habilite `output: "standalone"`
(isso é para Docker/VPS). Passos:

1. **Banco gerenciado**: PostgreSQL na **Neon**. Use a integração **Storage → Neon**
   da Vercel — ela injeta `DATABASE_URL` (pooled/pgbouncer) e `DATABASE_URL_UNPOOLED`
   (direta, usada pelas migrations) automaticamente.
2. **Migrations** (passo manual, **fora do build** — o build da Vercel não deve
   migrar): a partir da sua máquina, com a `DATABASE_URL` de produção:
   ```bash
   npm run db:migrate:deploy
   ```
3. **Storage obrigatório**: o FS da Vercel é efêmero → defina `STORAGE_DRIVER=s3`
   + `S3_*` (S3/R2/MinIO). Sem isso, as receitas enviadas **somem** entre requests.
4. **Importe o projeto** na Vercel (Git) e configure as variáveis de ambiente no
   dashboard (Production):
   - `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`
   - `NEXT_PUBLIC_BASE_URL=https://SEU_DOMINIO`, `AUTH_URL=https://SEU_DOMINIO`
   - `PAGBANK_TOKEN`
   - `RESEND_API_KEY`, `MAIL_FROM`
   - `STORAGE_DRIVER=s3`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
     `S3_SECRET_ACCESS_KEY` (e `S3_ENDPOINT` se for R2/MinIO)
   - `NEXT_PUBLIC_PHARMACIST_NAME`, `NEXT_PUBLIC_PHARMACIST_CRF`, `NEXT_PUBLIC_CNPJ`
   - (opcional) `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
5. **Build & deploy**: a Vercel roda `next build` automaticamente (o `postinstall`
   gera o Prisma client). Não rode `db:seed` em produção — cadastre o catálogo real
   pelo admin ou pela **importação CSV** (`/admin/produtos/importar`).

### 3b. VPS / Docker (alternativa)

```bash
npm ci                     # instala deps (gera o Prisma client)
npm run db:migrate:deploy  # aplica migrations no banco de produção
npm run build
npm run start              # ou o runtime do provedor
```
Para container, descomente `output: "standalone"` em `next.config.ts`.

### Checklist pós-deploy (qualquer provedor)

- [ ] HTTPS ativo (cookies seguros do Auth.js dependem disso).
- [ ] `PAGBANK_TOKEN` configurado (o webhook `https://SEU_DOMINIO/api/webhooks/pagbank`
      é informado automaticamente em cada cobrança e validado por re-consulta na API).
- [ ] Domínio do remetente verificado no Resend (para `MAIL_FROM`).
- [ ] Bucket S3/R2 criado e credenciais com permissão de leitura/escrita.
- [ ] Catálogo real cadastrado — via admin ou **Importar CSV** em
      `/admin/produtos/importar` (categorias e marcas precisam existir antes).

---

## 4. Verificação final

```bash
npm run lint
npm run typecheck
npm test          # unitários (Vitest)
npm run build
npm run test:e2e  # E2E (Playwright) — ver nota abaixo
```

> **E2E (Playwright):** local usa o **Edge do sistema** (sem baixar Chromium) e roda
> apenas os specs de **leitura** — os que escrevem no banco (compra, perfil) são
> pulados sem `E2E_ALLOW_WRITES=1`, porque o banco local é o de produção. O fluxo
> completo roda no **CI** (Postgres descartável). Para rodar contra um servidor já
> no ar: `PW_NO_SERVER=1 PW_BASE_URL=http://localhost:3210 npx playwright test`.

Fluxos para testar manualmente em produção:
- [ ] Cadastro → recebe e-mail de boas-vindas.
- [ ] **Recuperar senha** → recebe link → redefine → loga.
- [ ] Comprar item **com receita** → checkout exige o arquivo → admin aprova → status avança.
- [ ] Comprar item comum → **pagamento real (MP)** → webhook confirma → e-mail de status.
- [ ] CEP no checkout **autopreenche** o endereço e ajusta o **frete por região**.
- [ ] Resgatar pontos de fidelidade abate do total.
- [ ] **Cancelar pedido** (cliente ou admin) → estoque volta, pontos/cupom estornam,
      pagamento vira `REFUNDED` (e reembolso no MP se era online).
- [ ] **Admin → Clientes**: lista, busca e detalhe (pedidos, endereços, pontos).
- [ ] **Admin → Produtos → Importar CSV**: baixar modelo, importar, conferir o relatório.

---

## 5. CI

`.github/workflows/ci.yml` roda dois jobs em cada push/PR:
- **qualidade**: `lint → typecheck → test → build`;
- **e2e**: Postgres de serviço (descartável) + `migrate deploy` + seed + build de
  produção + Playwright/Chromium com os fluxos completos (incluindo compra).

---

## 6. Performance & disponibilidade

O que já está configurado e o que o operador precisa manter:

- **Região BR (feito):** as funções da Vercel rodam em `gru1` (São Paulo), mesma
  região do Neon (`sa-east-1`) — ver `regions` em `vercel.json`. Isso mantém o
  caminho usuário → função → banco **100% no Brasil**. **Não** remova o `gru1` nem
  mova o Neon de região; se um dia configurar o Upstash (rate-limit durável),
  escolha também uma região **South America**.

- [ ] **Keep-warm do banco (ação recomendada):** no plano free/Launch o Neon
      **suspende** o compute após ~5 min ocioso, deixando a 1ª visita lenta. Para
      evitar, aponte um **pinger externo grátis** para o endpoint de saúde, a cada
      ~4 minutos:
      - URL: `https://SEU_DOMINIO/api/health` (responde `{ ok: true }` e "acorda" o banco)
      - Serviços: **cron-job.org** (intervalo de 4 min) ou **UptimeRobot** (5 min).
      - No plano **Vercel Pro**, dá para usar um cron `*/4 * * * *` → `/api/health`
        no `vercel.json` (no Hobby o cron da Vercel só roda 1×/dia).
      - Solução de raiz: aumentar/desligar o *"Suspend compute after"* no painel do
        Neon (requer plano pago) — aí o keep-warm deixa de ser necessário.

- **Monitorar:** Vercel **Speed Insights** (TTFB/LCP) e **Analytics** já estão
  ativos no projeto (aparecem só quando publicado na Vercel).
