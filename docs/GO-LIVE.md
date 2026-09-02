# Checklist de go-live — FarmaVida

O software auxilia a operação, mas não substitui validação jurídica, sanitária,
farmacêutica, fiscal e de proteção de dados.

## 1. Bloqueadores regulatórios

- [ ] O catálogo online contém apenas produtos que **não exigem receita**.
- [ ] Produtos de tarja estão marcados com `requiresPrescription=true` e inativos.
- [ ] Razão social, CNPJ, endereço completo, horário e telefone estão preenchidos.
- [ ] Responsável técnico e CRF vigentes estão preenchidos.
- [ ] Licença sanitária e AFE vigentes estão preenchidas; AE, quando aplicável.
- [ ] Domínio e operação atendem à RDC Anvisa nº 44/2009.
- [ ] Emissão de NF-e e conciliação financeira foram homologadas.
- [ ] Termos e Política de Privacidade têm versão/data reais e revisão jurídica.
- [ ] Existe canal para titulares LGPD e responsável interno definido. Para agentes
      de pequeno porte, verifique com jurídico quando a indicação formal de DPO é
      dispensada; o canal de comunicação e as medidas de segurança continuam necessários.
- [ ] Existe política de retenção, exclusão e incidente para dados pessoais e
      documentos legados de saúde.

Em **Admin → Configurações**, preencha todos os dados regulatórios. Enquanto os
campos obrigatórios estiverem incompletos, o site mostra que o ambiente não está
liberado para operação comercial.

## 2. Infraestrutura e segredos

- [ ] `DATABASE_URL` e `DATABASE_URL_UNPOOLED` apontam para o banco correto.
- [ ] `AUTH_SECRET` é forte e exclusivo do ambiente.
- [ ] `MFA_ENCRYPTION_KEY` e `MFA_RECOVERY_PEPPER` são fortes, diferentes
      entre si e de `AUTH_SECRET`, e estão somente no secret manager.
- [ ] `NEXT_PUBLIC_BASE_URL` e `AUTH_URL` usam o domínio HTTPS real.
- [ ] `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` estão no cofre do provedor.
- [ ] O webhook `https://SEU_DOMINIO/api/webhooks/stripe` foi registrado e testado.
- [ ] Pix só aparece depois de a capability da conta Stripe ser confirmada.
- [ ] `RESEND_API_KEY`, `MAIL_FROM` e domínio remetente foram validados.
- [ ] `CRON_SECRET` protege os crons de assinaturas, retenção e pagamentos/reservas.
- [ ] Redis/Upstash durável foi configurado para rate limit serverless.
- [ ] Sentry/alertas, backups, PITR e procedimento de restauração foram testados.
- [ ] `/api/health` responde liveness e `/api/ready` confirma banco e migration.
- [ ] Nenhum segredo de produção está salvo no repositório ou em dados demo.

## 3. Deploy

1. Instale dependências com Node 22.
2. Aplique `npm run db:migrate:deploy` em uma etapa controlada.
3. Execute `npm run build` e publique a aplicação.
4. **Não execute `db:seed` em produção.** O seed recusa produção e bancos remotos,
   mas essa proteção não substitui separação de credenciais.

## 4. Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

- [ ] Cadastro, login, logout e recuperação de senha funcionam.
- [ ] Produto MIP pode ser comprado normalmente.
- [ ] Produto com receita não aparece em catálogo, URL, busca, favoritos ou sitemap.
- [ ] Tentativas diretas de assinar, repor ou ativar produto com receita são recusadas.
- [ ] Importação/sync com `tarja=true` desativa o produto imediatamente.
- [ ] Cupom, pontos, CEP, frete e total cobrado coincidem com o total confirmado.
- [ ] Cartão e Pix de teste são confirmados somente pelo webhook válido.
- [ ] Falha de pagamento/reembolso é visível e reconciliável.
- [ ] Cancelamento restaura estoque, pontos e cupom uma única vez.
- [ ] Rotas e Server Actions administrativas validam autorização no servidor.
- [ ] Todo OWNER e membro da equipe ativou MFA TOTP, guardou os códigos de
      recuperação fora do dispositivo principal e testou um novo login.
- [ ] Navegação por teclado, contraste, leitores de tela e larguras móveis foram testados.

## 5. Evidências para liberar vendas

Registre quem aprovou e quando:

- [ ] Jurídico/regulatório
- [ ] Responsável técnico
- [ ] Segurança/LGPD
- [ ] Financeiro/conciliação
- [ ] Operação/logística
- [ ] Engenharia/observabilidade

Somente remova o aviso de ambiente não liberado preenchendo dados verdadeiros e
após concluir todos os bloqueadores aplicáveis.
