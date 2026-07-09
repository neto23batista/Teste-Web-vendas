// Fase 2 — Catálogo/estoque/preço: InovaFarma → FarmaVida.
// Puxa os produtos da API local e envia em lote para a nuvem.

import { inovafarma, farmavida } from "./client.mjs";
import { produtoParaCatalogo } from "./mapeadores.mjs";

export async function sincronizarCatalogo() {
  const inicio = Date.now();
  const data = await inovafarma("GET", "/produtos");
  const lista = Array.isArray(data?.produtos) ? data.produtos : [];
  const produtos = lista.map(produtoParaCatalogo).filter(Boolean);

  if (produtos.length === 0) {
    console.log("[catalogo] nada a sincronizar");
    return { enviados: 0 };
  }

  // Lotes de 500 (o FarmaVida aceita até 2000; 500 mantém a request leve).
  let criados = 0;
  let atualizados = 0;
  for (let i = 0; i < produtos.length; i += 500) {
    const res = await farmavida("POST", "/api/integracao/catalogo", {
      produtos: produtos.slice(i, i + 500),
    });
    criados += res.criados ?? 0;
    atualizados += res.atualizados ?? 0;
    if (res.erros?.length) {
      console.warn(`[catalogo] erros no lote: ${res.erros.join("; ")}`);
    }
  }

  console.log(
    `[catalogo] ok em ${Date.now() - inicio}ms — ${criados} criados, ${atualizados} atualizados (${produtos.length} no total)`
  );
  return { enviados: produtos.length, criados, atualizados };
}
