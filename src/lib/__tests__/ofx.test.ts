import { describe, it, expect } from "vitest";
import {
  parseOfx,
  parseStatementCsv,
  parseStatement,
  matchStatement,
} from "@/lib/ofx";

const OFX_SAMPLE = `OFXHEADER:100
DATA:OFXSGML

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260705120000[-3:BRT]
<TRNAMT>159.90
<FITID>PIX0001
<MEMO>PIX RECEBIDO FARMAVIDA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260706
<TRNAMT>-45.50
<FITID>TAR0002
<NAME>TARIFA BANCARIA
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe("parseOfx", () => {
  it("lê lançamentos SGML (sem tags de fechamento), data, valor e FITID", () => {
    const txs = parseOfx(OFX_SAMPLE);
    expect(txs).toEqual([
      {
        externalId: "PIX0001",
        date: "2026-07-05",
        description: "PIX RECEBIDO FARMAVIDA",
        amount: 159.9,
      },
      {
        externalId: "TAR0002",
        date: "2026-07-06",
        description: "TARIFA BANCARIA",
        amount: -45.5,
      },
    ]);
  });

  it("descarta lançamento sem data ou valor legíveis", () => {
    expect(parseOfx("<STMTTRN><TRNAMT>abc<FITID>X</STMTTRN>")).toEqual([]);
  });
});

describe("parseStatementCsv", () => {
  it("lê CSV de banco BR: separador ';', data dd/mm/yyyy e decimal com vírgula", () => {
    const csv = [
      "Data;Histórico;Valor;Documento",
      "05/07/2026;PIX RECEBIDO;1.234,56;DOC1",
      "06/07/2026;TARIFA;-12,00;DOC2",
    ].join("\n");
    expect(parseStatementCsv(csv)).toEqual([
      { externalId: "DOC1", date: "2026-07-05", description: "PIX RECEBIDO", amount: 1234.56 },
      { externalId: "DOC2", date: "2026-07-06", description: "TARIFA", amount: -12 },
    ]);
  });

  it("aceita separador vírgula com data ISO e sem coluna de identificador", () => {
    const csv = ["date,description,amount", "2026-07-05,VENDA,100.50"].join("\n");
    expect(parseStatementCsv(csv)).toEqual([
      { externalId: null, date: "2026-07-05", description: "VENDA", amount: 100.5 },
    ]);
  });

  it("sem colunas de data e valor no cabeçalho → vazio", () => {
    expect(parseStatementCsv("foo;bar\n1;2")).toEqual([]);
  });
});

describe("parseStatement", () => {
  it("detecta OFX pelo conteúdo e CSV como fallback", () => {
    expect(parseStatement(OFX_SAMPLE)).toHaveLength(2);
    expect(
      parseStatement("Data;Valor\n05/07/2026;10,00")
    ).toEqual([
      { externalId: null, date: "2026-07-05", description: "Lançamento", amount: 10 },
    ]);
  });
});

describe("matchStatement", () => {
  const tx = (date: string, amount: number) => ({
    externalId: null,
    date,
    description: "PIX",
    amount,
  });

  it("casa crédito com pagamento de mesmo valor e data dentro da janela", () => {
    const matches = matchStatement(
      [tx("2026-07-05", 159.9)],
      [{ id: "pay1", amount: 159.9, date: "2026-07-04" }]
    );
    expect(matches.get(0)).toBe("pay1");
  });

  it("fora da janela de dias → não casa", () => {
    const matches = matchStatement(
      [tx("2026-07-05", 159.9)],
      [{ id: "pay1", amount: 159.9, date: "2026-06-20" }]
    );
    expect(matches.size).toBe(0);
  });

  it("valor diferente além de 1 centavo → não casa", () => {
    const matches = matchStatement(
      [tx("2026-07-05", 159.9)],
      [{ id: "pay1", amount: 160.9, date: "2026-07-05" }]
    );
    expect(matches.size).toBe(0);
  });

  it("débito (valor negativo) nunca é conciliado com pagamento", () => {
    const matches = matchStatement(
      [tx("2026-07-05", -45.5)],
      [{ id: "pay1", amount: 45.5, date: "2026-07-05" }]
    );
    expect(matches.size).toBe(0);
  });

  it("cada pagamento casa com no máximo um lançamento; empate vai para a data mais próxima", () => {
    const matches = matchStatement(
      [tx("2026-07-05", 100), tx("2026-07-08", 100)],
      [
        { id: "perto", amount: 100, date: "2026-07-05" },
        { id: "longe", amount: 100, date: "2026-07-09" },
      ]
    );
    expect(matches.get(0)).toBe("perto");
    expect(matches.get(1)).toBe("longe");
  });
});
