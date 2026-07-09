// Fase 3 — Pedidos: FarmaVida → InovaFarma.
// Poll na nuvem; cada pedido pago vira uma venda na API local. O resultado
// (id da venda OU erro) é reportado de volta — a fila fica no FarmaVida
// (OrderExport) e um pedido nunca é exportado duas vezes.

import { inovafarma, farmavida } from "./client.mjs";
import { pedidoParaVenda } from "./mapeadores.mjs";

export async function exportarPedidos() {
  const data = await farmavida("GET", "/api/integracao/pedidos");
  const pedidos = Array.isArray(data?.pedidos) ? data.pedidos : [];
  if (pedidos.length === 0) return { exportados: 0 };

  let exportados = 0;
  for (const pedido of pedidos) {
    try {
      const venda = await inovafarma("POST", "/vendas", pedidoParaVenda(pedido));
      const idVenda = venda?.id_venda ? String(venda.id_venda) : null;
      await farmavida("POST", `/api/integracao/pedidos/${pedido.numero}/resultado`, {
        ok: true,
        idVenda,
      });
      exportados++;
      console.log(`[pedidos] ${pedido.numero} → venda ${idVenda ?? "(sem id)"} ✔`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[pedidos] ${pedido.numero} FALHOU: ${msg}`);
      // Reporta o erro (best-effort) — o FarmaVida registra e re-oferece depois.
      try {
        await farmavida("POST", `/api/integracao/pedidos/${pedido.numero}/resultado`, {
          ok: false,
          erro: msg,
        });
      } catch {
        // nuvem fora do ar: o pedido continua PENDING e volta no próximo poll
      }
    }
  }
  return { exportados, total: pedidos.length };
}
