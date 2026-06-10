/**
 * Parser de CSV simples e sem dependências. Suporta:
 *  - aspas duplas para campos com vírgula, quebra de linha ou aspas
 *  - aspas escapadas dobrando (`""` → `"`)
 *  - separador vírgula e quebras `\n` ou `\r\n`
 * Retorna uma matriz de linhas (cada linha é um array de células string).
 * Linhas totalmente vazias são descartadas.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Remove BOM se presente (Excel costuma adicionar).
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++; // pula a segunda aspa do par escapado
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Fecha a célula/linha; trata \r\n como uma quebra só.
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  // Última célula/linha (arquivo sem quebra final).
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }

  return rows;
}

/**
 * Converte um CSV em uma lista de objetos usando a primeira linha como
 * cabeçalho. As chaves do cabeçalho são normalizadas (minúsculas, sem acento,
 * espaços → "_") para casar com nomes de coluna previsíveis.
 */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(normalizeKey);
  return rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    header.forEach((key, idx) => {
      rec[key] = (cells[idx] ?? "").trim();
    });
    return rec;
  });
}

/**
 * Serializa uma matriz em CSV (RFC 4180). Células com vírgula, aspas ou quebra
 * de linha são envoltas em aspas, com aspas internas dobradas. Separador vírgula
 * — par do `parseCsv` acima.
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(escape).join(",")).join("\r\n");
}

function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos combinantes
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}
