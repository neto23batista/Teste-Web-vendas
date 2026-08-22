#!/usr/bin/env node
// Conector FarmaVida × InovaFarma — roda no PC da farmácia (Windows).
//
//   node index.mjs           → loop contínuo (catálogo 5min, pedidos 30s)
//   node index.mjs --once    → um ciclo de cada e sai (útil p/ testes)
//   node index.mjs --ping    → testa as duas conexões e sai
//
// Instalação como serviço: ver README.md desta pasta.

import { config } from "./config.mjs";
import { pingAll } from "./client.mjs";
import { sincronizarCatalogo } from "./catalogo.mjs";
import { exportarPedidos } from "./pedidos.mjs";
import {
  createSerialExecutor,
  safeErrorMessage,
  scheduleAfterCompletion,
} from "./security.mjs";

const arg = process.argv[2];

async function cicloCatalogo() {
  try {
    await sincronizarCatalogo();
  } catch (err) {
    console.error(`[catalogo] ERRO: ${safeErrorMessage(err)}`);
  }
}

async function cicloPedidos() {
  try {
    await exportarPedidos();
  } catch (err) {
    console.error(`[pedidos] ERRO: ${safeErrorMessage(err)}`);
  }
}

if (arg === "--ping") {
  await pingAll();
  // Saída natural (sem process.exit): evita crash do libuv no Windows com
  // sockets keep-alive do fetch ainda fechando.
  process.exitCode = 0;
} else if (arg === "--once") {
  await cicloCatalogo();
  await cicloPedidos();
  process.exitCode = 0;
} else {
  console.log(
    `[conector] iniciado — catálogo a cada ${config.catalogEveryMin}min, pedidos a cada ${config.ordersEverySec}s`
  );
  console.log("[conector] endpoints validados; valores omitidos dos logs");

  const execute = createSerialExecutor();
  await execute(cicloCatalogo);
  await execute(cicloPedidos);
  scheduleAfterCompletion(
    () => execute(cicloCatalogo),
    config.catalogEveryMin * 60_000
  );
  scheduleAfterCompletion(
    () => execute(cicloPedidos),
    config.ordersEverySec * 1_000
  );
}
