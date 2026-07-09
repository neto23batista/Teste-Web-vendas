#!/usr/bin/env node
// MOCK da inovafarma-api — desenvolve/testa a integração SEM as credenciais
// reais (Fase 0 do guia). Os contratos daqui são ASSUMIDOS; na homologação
// (Fase 6) o que divergir da doc oficial se ajusta em mapeadores.mjs/client.mjs.
//
//   node mock/server.mjs          → porta 9800
//   PORT=9900 node mock/server.mjs
//
// Endpoints: POST /auth/token · GET /produtos · POST /vendas

import http from "node:http";

const PORT = Number(process.env.PORT) || 9800;
const TOKEN = "mock-token-inovafarma";

// Catálogo de exemplo (o que uma farmácia teria no PDV).
const produtos = [
  { codigo: "IF-0001", ean: "7891000315507", descricao: "Dipirona Sódica 500mg 20 comprimidos", preco_venda: 8.9, preco_promocional: null, estoque_atual: 120, tarja: null, grupo: "Medicamentos" },
  { codigo: "IF-0002", ean: "7896004815242", descricao: "Paracetamol 750mg 20 comprimidos", preco_venda: 12.5, preco_promocional: 9.99, estoque_atual: 80, tarja: null, grupo: "Medicamentos" },
  { codigo: "IF-0003", ean: "7896112402301", descricao: "Amoxicilina 500mg 21 cápsulas", preco_venda: 34.9, preco_promocional: null, estoque_atual: 25, tarja: "vermelha", grupo: "Antibióticos" },
  { codigo: "IF-0004", ean: "7891010245689", descricao: "Soro Fisiológico 0,9% 500ml", preco_venda: 6.5, preco_promocional: null, estoque_atual: 200, tarja: null, grupo: "Primeiros Socorros" },
  { codigo: "IF-0005", ean: "7896094908734", descricao: "Vitamina C 1g 30 comprimidos efervescentes", preco_venda: 24.9, preco_promocional: 19.9, estoque_atual: 45, tarja: null, grupo: "Vitaminas" },
];

// Vendas registradas (idempotente por referencia_externa, como um PDV real).
const vendas = new Map();
let proximaVenda = 1000;

const json = (res, code, data) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

const lerCorpo = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });

const autorizado = (req) =>
  (req.headers.authorization ?? "") === `Bearer ${TOKEN}`;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    console.log(`[mock] ${req.method} ${url.pathname}`);

    if (req.method === "POST" && url.pathname === "/auth/token") {
      const body = await lerCorpo(req);
      if (!body?.client_id || !body?.client_secret || !body?.loja_id) {
        return json(res, 400, { erro: "client_id, client_secret e loja_id são obrigatórios" });
      }
      return json(res, 200, { access_token: TOKEN, expires_in: 3600 });
    }

    if (!autorizado(req)) return json(res, 401, { erro: "não autorizado" });

    if (req.method === "GET" && url.pathname === "/produtos") {
      return json(res, 200, { produtos });
    }

    if (req.method === "POST" && url.pathname === "/vendas") {
      const body = await lerCorpo(req);
      if (!body?.referencia_externa || !Array.isArray(body.itens) || body.itens.length === 0) {
        return json(res, 400, { erro: "referencia_externa e itens são obrigatórios" });
      }
      // Idempotência: mesma referência devolve a MESMA venda (não duplica).
      if (vendas.has(body.referencia_externa)) {
        return json(res, 200, vendas.get(body.referencia_externa));
      }
      const venda = { id_venda: `VENDA-${proximaVenda++}`, status: "EFETIVADA" };
      vendas.set(body.referencia_externa, venda);
      console.log(
        `[mock] venda ${venda.id_venda} criada — pedido ${body.referencia_externa}, ` +
          `${body.itens.length} item(ns), total R$ ${body.total}, pagamento ${body.forma_pagamento}`
      );
      return json(res, 201, venda);
    }

    json(res, 404, { erro: "rota não existe no mock" });
  })
  .listen(PORT, () => {
    console.log(`[mock] inovafarma-api de mentira na porta ${PORT} (${produtos.length} produtos)`);
  });
