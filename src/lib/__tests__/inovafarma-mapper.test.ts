import { describe, it, expect } from "vitest";
// Mapeadores do conector (Node puro — mesmo código que roda no PC da farmácia).
import {
  produtoParaCatalogo,
  pedidoParaVenda,
} from "../../../connector/mapeadores.mjs";

describe("produtoParaCatalogo (InovaFarma → FarmaVida)", () => {
  it("mapeia os campos do contrato assumido", () => {
    const r = produtoParaCatalogo({
      codigo: "IF-0003",
      ean: "7896112402301",
      descricao: "Amoxicilina 500mg",
      preco_venda: 34.9,
      preco_promocional: 29.9,
      estoque_atual: 25,
      tarja: "vermelha",
      grupo: "Antibióticos",
    });
    expect(r).toEqual({
      sku: "IF-0003",
      ean: "7896112402301",
      nome: "Amoxicilina 500mg",
      preco: 34.9,
      promo: 29.9,
      estoque: 25,
      tarja: true,
      categoria: "Antibióticos",
    });
  });

  it("sem tarja → tarja null (não força false em produto curado)", () => {
    const r = produtoParaCatalogo({
      codigo: "1",
      descricao: "Soro",
      preco_venda: 6.5,
      estoque_atual: 10,
      tarja: null,
    });
    expect(r?.tarja).toBeNull();
  });

  it("estoque negativo/quebrado vira 0; produto sem código é descartado", () => {
    expect(
      produtoParaCatalogo({ codigo: "2", descricao: "X", preco_venda: 1, estoque_atual: -5 })
        ?.estoque
    ).toBe(0);
    expect(produtoParaCatalogo({ descricao: "sem codigo", preco_venda: 1 })).toBeNull();
  });
});

describe("pedidoParaVenda (FarmaVida → InovaFarma)", () => {
  const pedido = {
    numero: "FV123",
    total: 84.8,
    frete: 14.9,
    desconto: 0,
    formaPagamento: "pix",
    cliente: { nome: "Maria", cpf: "52998224725" },
    itens: [{ sku: "IF-0001", ean: null, nome: "Dipirona", qtd: 2, preco: 34.95 }],
  };

  it("usa o número do pedido como referência externa (idempotência no PDV)", () => {
    const v = pedidoParaVenda(pedido);
    expect(v.referencia_externa).toBe("FV123");
    expect(v.itens).toEqual([
      { codigo: "IF-0001", ean: undefined, descricao: "Dipirona", quantidade: 2, preco_unitario: 34.95 },
    ]);
    expect(v.total).toBe(84.8);
    expect(v.taxa_entrega).toBe(14.9);
  });

  it("mapeia formas de pagamento (pix/card/cash) e cai em OUTROS no resto", () => {
    expect(pedidoParaVenda(pedido).forma_pagamento).toBe("PIX");
    expect(pedidoParaVenda({ ...pedido, formaPagamento: "card" }).forma_pagamento).toBe("CARTAO");
    expect(pedidoParaVenda({ ...pedido, formaPagamento: "cash" }).forma_pagamento).toBe("DINHEIRO");
    expect(pedidoParaVenda({ ...pedido, formaPagamento: "boleto" }).forma_pagamento).toBe("OUTROS");
  });
});
