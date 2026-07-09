# Conector FarmaVida × InovaFarma

Serviço pequeno (Node 18+, sem dependências) que roda **no PC da farmácia** e liga a
InovaFarma (PDV on-premise da Precisão Sistemas) ao FarmaVida (nuvem). Ele só faz
conexões de **saída** — não precisa de IP fixo, port-forward nem VPN:

```
[FarmaVida/Vercel] ◄─HTTPS── [este conector] ──localhost/rede──► [inovafarma-api]
```

**O que ele faz**
- A cada **5 min**: puxa produtos/estoque/preço da InovaFarma e envia ao FarmaVida
  (`POST /api/integracao/catalogo`). Produtos novos entram **inativos** para o
  admin revisar antes de aparecer na loja.
- A cada **30 s**: busca pedidos **pagos** no FarmaVida e cria a **venda**
  correspondente na InovaFarma. Um pedido nunca vira venda duas vezes (fila
  `OrderExport` na nuvem + `referencia_externa` no PDV).

## Instalação (Windows da farmácia)

1. Instale o [Node.js LTS](https://nodejs.org) (18+).
2. Copie esta pasta `connector/` para o PC (ex.: `C:\farmavida-conector`).
3. `copy .env.example .env` e preencha:
   - `INOVAFARMA_*` — credenciais do credenciamento no **Portal PS** e o endereço
     da Web API local (ex.: `http://localhost:PORTA`).
   - `FARMAVIDA_URL` — URL pública do site.
   - `FARMAVIDA_TOKEN` — gere em **Admin → Integração** (aparece uma única vez).
4. Teste as conexões: `node index.mjs --ping`
5. Rode um ciclo: `node index.mjs --once`
6. Deixe rodando como serviço:
   - **Agendador de Tarefas**: nova tarefa → "Ao iniciar o computador" →
     programa `node`, argumento `C:\farmavida-conector\index.mjs`, marcar
     "Reiniciar em caso de falha"; **ou**
   - **NSSM** (nssm.cc): `nssm install FarmaVidaConector "C:\Program Files\nodejs\node.exe" "C:\farmavida-conector\index.mjs"`.

## Desenvolvimento sem credenciais (mock)

Enquanto o credenciamento no Portal PS não sai, use o mock da API local:

```bash
node mock/server.mjs             # inovafarma-api de mentira na porta 9800
# .env: INOVAFARMA_URL=http://localhost:9800 e INOVAFARMA_* com qualquer valor
node index.mjs --once
```

## Quando a documentação oficial chegar (Fase 6 — homologação)

Os contratos da API local foram **assumidos** (`/auth/token`, `/produtos`,
`/vendas`). O que divergir da doc real se ajusta em **um lugar só**:
- formato dos dados → `mapeadores.mjs`
- autenticação/endpoints → `client.mjs` (+ `catalogo.mjs`/`pedidos.mjs` se os caminhos mudarem)

Checklist completo da homologação: `docs/INTEGRACAO-INOVAFARMA.md` na raiz do repo.
