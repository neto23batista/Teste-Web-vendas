# Integração FarmaVida × InovaFarma

A InovaFarma (Precisão Sistemas) é o sistema de gestão/PDV que roda **no computador da
farmácia** (on-premise, Windows). A integração liga o PDV à loja online:

- **Catálogo, estoque e preço** entram automaticamente do PDV para o site (a cada 5 min).
- **Pedidos pagos** no site viram **venda no caixa** da InovaFarma (a cada 30 s).

## Arquitetura — por que existe um "conector"

O FarmaVida roda na nuvem (Vercel); a API da InovaFarma (`inovafarma-api`) roda em
`localhost` na máquina da farmácia. A nuvem **não alcança** a farmácia. Por isso existe o
**conector** (pasta [`connector/`](../connector/README.md)): um serviço Node instalado no
PC da farmácia que só faz conexões de **saída** — sem IP fixo, port-forward ou VPN.

```
[FarmaVida — Vercel]  ◄─HTTPS──  [Conector no PC da farmácia]  ──localhost──►  [inovafarma-api]
  /api/integracao/*                sync 5min · poll 30s              Client ID/Secret/Loja
```

Cada **unidade** (matriz/filial) tem sua própria InovaFarma → seu próprio conector e seu
próprio **token** (gerado em **Admin → Integração**; aparece uma única vez).

## O que já está pronto (neste repositório)

| Peça | Onde |
|---|---|
| Endpoints da nuvem (token por unidade, rate-limit) | `src/app/api/integracao/{catalogo,pedidos,pedidos/[number]/resultado}` |
| Upsert de catálogo (match por SKU/EAN; novos entram **inativos** p/ curadoria) | `src/lib/integration-catalog.ts` |
| Fila de exportação idempotente (pedido nunca vira venda 2×) + telemetria | modelos `OrderExport`/`SyncRun` |
| Conector (auth, retry exponencial, mapeadores num lugar só) | `connector/` |
| **Mock da inovafarma-api** (desenvolver sem credenciais) | `connector/mock/server.mjs` |
| Painel de status + geração de token + reexportar erro | Admin → Integração |

Regras de curadoria: produto novo vindo do PDV chega **inativo** e sem foto — o admin
revisa (emoji/foto/categoria) e ativa. Nome/descrição/foto de produto já existente **não**
são sobrescritos pelo sync; só preço, promoção, estoque e tarja.

## Checklist do dono (passos comerciais — sem eles não há homologação)

- [ ] **Credenciamento como parceiro** no **Portal PS** (Precisão Sistemas) — pode ter
      adicional na mensalidade da farmácia.
- [ ] Receber **Client ID, Client Secret e ID da Loja**.
- [ ] Pedir a **documentação oficial da Web API** (endpoints, autenticação, formatos).
- [ ] Ambiente de teste: InovaFarma instalada com a `inovafarma-api` rodando + **endereço
      e porta** na rede local.
- [ ] Definir com a Precisão **como o pedido entra no caixa**: efetivação automática ou
      manual? emite cupom fiscal na hora?
- [ ] Confirmar se a leitura de catálogo é melhor por API ou por **Views de banco**
      (se Views, a leitura muda de lado — falar com o desenvolvedor).

## Fases (estado atual)

| Fase | Conteúdo | Estado |
|---|---|---|
| 0 — Setup | Estrutura, mock, envs | ✅ pronto |
| 1 — Cliente da API | Auth, retry, ping (`node index.mjs --ping`) | ✅ pronto (contra o mock) |
| 2 — Catálogo → site | Sync 5 min, upsert por SKU/EAN, estoque por unidade | ✅ pronto (contra o mock) |
| 3 — Pedidos → PDV | Poll 30 s, venda com `referencia_externa`, resultado reportado | ✅ pronto (contra o mock) |
| 4 — Resiliência | Fila persistente, retry, idempotência nas duas pontas | ✅ pronto |
| 5 — Testes/observabilidade | Testes unitários + painel Admin → Integração | ✅ pronto |
| 6 — **Homologação** | Credenciais reais, ajustar contratos, pedido ponta a ponta até o cupom | ⏳ **depende do checklist acima** |

## Fase 6 — roteiro de homologação (quando as credenciais chegarem)

1. Instalar o conector no PC da farmácia ([passo a passo](../connector/README.md)).
2. `node index.mjs --ping` — validar as duas conexões.
3. Comparar a **doc oficial** com os contratos assumidos e ajustar:
   - dados/formato → `connector/mapeadores.mjs`
   - autenticação/endpoints → `connector/client.mjs`
4. Sync de catálogo real → conferir produtos/estoque/preço no site (novos ficam inativos).
5. Pedido-teste pago no site → conferir a venda no caixa da InovaFarma (e o cupom, se
   configurado) → status em Admin → Integração deve ficar "exportado".
6. Teste de resiliência: desligar a `inovafarma-api`, fazer um pedido, religar — o pedido
   deve ser exportado no ciclo seguinte, **uma única vez**.

## Segurança

- O token do conector identifica a unidade; só o **hash** fica no banco. Regenerar
  invalida o anterior.
- Client ID/Secret da InovaFarma ficam **apenas** no `.env` do PC da farmácia (nunca no
  Git, nunca na Vercel).
- As rotas `/api/integracao/*` têm rate-limit e respondem 401 sem token válido.
