// Tradução entre o modelo da InovaFarma e o do FarmaVida — TUDO num lugar só.
// Quando a documentação oficial divergir dos contratos assumidos, é AQUI que
// se ajusta (mais o client.mjs, se a autenticação mudar).

/**
 * Produto da InovaFarma → item do catálogo do FarmaVida.
 * Contrato assumido do GET /produtos:
 * { codigo, ean?, descricao, preco_venda, preco_promocional?, estoque_atual,
 *   tarja? ("vermelha"|"preta"|null), grupo? }
 */
export function produtoParaCatalogo(p) {
  if (!p || !p.codigo || !p.descricao) return null;
  return {
    sku: String(p.codigo),
    ean: p.ean ? String(p.ean) : null,
    nome: String(p.descricao),
    preco: Number(p.preco_venda) || 0,
    promo: p.preco_promocional != null ? Number(p.preco_promocional) : null,
    estoque: Math.max(0, Math.trunc(Number(p.estoque_atual) || 0)),
    tarja: p.tarja != null ? p.tarja !== "" && p.tarja !== null : null,
    categoria: p.grupo ? String(p.grupo) : null,
  };
}

/**
 * Pedido do FarmaVida → venda da InovaFarma.
 * Contrato assumido do POST /vendas:
 * { referencia_externa, cliente: {nome, cpf?}, itens: [{codigo?, ean?,
 *   descricao, quantidade, preco_unitario}], taxa_entrega, desconto,
 *   forma_pagamento ("PIX"|"CARTAO"|"DINHEIRO"), total }
 * `referencia_externa` = número do pedido → idempotência do lado do PDV.
 */
export function pedidoParaVenda(pedido) {
  const formas = { pix: "PIX", card: "CARTAO", cash: "DINHEIRO" };
  return {
    referencia_externa: pedido.numero,
    cliente: {
      nome: pedido.cliente?.nome ?? "Cliente",
      cpf: pedido.cliente?.cpf ?? undefined,
    },
    itens: pedido.itens.map((i) => ({
      codigo: i.sku ?? undefined,
      ean: i.ean ?? undefined,
      descricao: i.nome,
      quantidade: i.qtd,
      preco_unitario: i.preco,
    })),
    taxa_entrega: pedido.frete ?? 0,
    desconto: pedido.desconto ?? 0,
    forma_pagamento: formas[pedido.formaPagamento] ?? "OUTROS",
    total: pedido.total,
  };
}
