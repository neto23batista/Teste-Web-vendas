# Deploy & operação — FarmaVida (Vercel + Neon)

O sistema **já está no ar**: push na `main` → GitHub Actions (CI) → deploy automático na
Vercel. Banco **PostgreSQL na Neon** (integração *Storage → Neon* da Vercel injeta
`DATABASE_URL` e `DATABASE_URL_UNPOOLED`). Este guia é a referência de operação.

---

## 1. Variáveis de ambiente (Vercel → Settings → Environment Variables)

### Obrigatórias (o boot falha sem elas)
| Variável | O quê |
|---|---|
| `DATABASE_URL` | Postgres Neon, string *pooled* (injetada pela integração) |
| `AUTH_SECRET` | segredo do Auth.js — `npx auth secret` |

### Para operar de verdade
| Variável | Destrava | Sem ela |
|---|---|---|
| `PAGBANK_TOKEN` | cartão e PIX reais (PagBank) | só "dinheiro na entrega" |
| `RESEND_API_KEY` + `MAIL_FROM` | e-mails (pedido, reset, assinaturas) | e-mails só no log |
| `CRON_SECRET` | cron diário de assinaturas (`vercel.json`, 8h SP) | lembretes desligados |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | rate-limit durável entre instâncias | limite só por instância |
| `STORAGE_DRIVER=s3` + `S3_*` | upload de receitas persistente | ⚠️ em serverless as receitas **somem** |
| `NEXT_PUBLIC_BASE_URL` / `AUTH_URL` | URL pública `https://…` | cookies/links quebrados |

Opcionais: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (erros), `NEXT_PUBLIC_PHARMACIST_*` /
`NEXT_PUBLIC_CNPJ` (fallback do rodapé — o painel *Admin → Configurações* também define).

---

## 2. Migrations (a cada mudança de schema)

A Vercel **não** roda migrations no build (proposital: o build não depende do banco).
Depois de mergear uma migration nova, rode **uma vez** da sua máquina:

```bash
npx prisma migrate deploy   # usa DATABASE_URL_UNPOOLED do .env
```

**Nunca** rode `npm run db:seed` em produção — ele apaga tudo e recria dados demo.
Catálogo real: *Admin → Produtos* (ou **Importar CSV** em `/admin/produtos/importar`).

---

## 3. PagBank (quando ativar pagamento)

1. Painel PagBank → **Integrações** → gere o token de API e configure `PAGBANK_TOKEN`.
2. O webhook é registrado automaticamente a cada cobrança (`notification_urls` → `https://SEU_DOMINIO/api/webhooks/pagbank`); a notificação é validada por re-consulta na API (não confia no payload).
3. Para testar sem dinheiro real, use `PAGBANK_SANDBOX=1` com um token de sandbox.
4. Em produção o pagamento é real (o simulado só existe fora de produção).

---

## 4. Primeiro acesso / usuários

O banco foi entregue limpo: um único admin inicial (`admin@farmavida.local`, senha
entregue fora do repositório — **trocar no primeiro acesso**). Novos admins de unidade
são criados em *Admin → Configurações* (unidades) pelo admin da matriz.

---

## 5. Checklist pós-mudança

- [ ] CI verde no GitHub (jobs **qualidade** e **e2e**).
- [ ] Home e login funcionando no domínio de produção.
- [ ] Se mexeu em schema: `prisma migrate deploy` executado (passo 2).
- [ ] Se mexeu em tela: `npm run shots` e conferir os screenshots.

## Recomendação

Para desenvolver local com segurança, evite pastas sincronizadas (OneDrive) — o *cloud
sync* já causou lentidão e locks de arquivos; prefira algo como `C:\dev\farmavida`.
