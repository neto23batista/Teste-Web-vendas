/**
 * Leitura de extrato bancário (OFX e CSV) e casamento com os pagamentos do
 * sistema — a base da conciliação bancária. Tudo puro (sem IO), testável.
 */

export type StatementTx = {
  /** FITID no OFX / coluna de identificador no CSV — evita reimportar. */
  externalId: string | null;
  /** Dia do lançamento no formato yyyy-mm-dd. */
  date: string;
  description: string;
  /** Positivo = crédito (entrada); negativo = débito. */
  amount: number;
};

// ─────────────────────────── OFX ───────────────────────────

const tagValue = (block: string, tag: string): string | null => {
  // OFX clássico é SGML: <TAG>valor sem fechamento. Aceita também XML fechado.
  const m = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
  const v = m?.[1].trim();
  return v ? v : null;
};

/** Converte DTPOSTED ("20260705..." com ou sem hora/fuso) em yyyy-mm-dd. */
const ofxDate = (raw: string | null): string | null => {
  const m = raw?.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** Extrai os lançamentos (<STMTTRN>) de um arquivo OFX. Lançamentos sem data
 *  ou valor legíveis são descartados. */
export function parseOfx(text: string): StatementTx[] {
  const txs: StatementTx[] = [];
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|$)/gi) ?? [];
  for (const block of blocks) {
    const date = ofxDate(tagValue(block, "DTPOSTED"));
    const amount = Number((tagValue(block, "TRNAMT") ?? "").replace(",", "."));
    if (!date || !Number.isFinite(amount)) continue;
    txs.push({
      externalId: tagValue(block, "FITID"),
      date,
      description:
        tagValue(block, "MEMO") ?? tagValue(block, "NAME") ?? "Lançamento",
      amount,
    });
  }
  return txs;
}

// ─────────────────────────── CSV ───────────────────────────

const normKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

/** Número em pt-BR ("1.234,56") ou com ponto decimal ("1234.56"). */
const brNumber = (raw: string): number | null => {
  const v = (raw ?? "").replace(/R\$\s?/i, "").trim();
  if (v === "") return null;
  const candidate = /,/.test(v) ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(candidate);
  return Number.isFinite(n) ? n : null;
};

/** Data "dd/mm/yyyy" ou "yyyy-mm-dd" → yyyy-mm-dd. */
const brDate = (raw: string): string | null => {
  const v = (raw ?? "").trim();
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
};

const DATE_KEYS = ["data", "dt", "date", "data_lancamento"];
const DESC_KEYS = ["descricao", "historico", "lancamento", "memo", "detalhes", "description"];
const VALUE_KEYS = ["valor", "montante", "amount", "credito", "valor_(r$)"];
const ID_KEYS = ["identificador", "id", "documento", "doc", "fitid", "numero_documento"];

/**
 * Extrato em CSV: detecta o separador (";" comum em bancos BR, senão ","),
 * localiza as colunas pelo cabeçalho (data / descrição-histórico / valor /
 * identificador) e converte datas e números do formato brasileiro.
 */
export function parseStatementCsv(text: string): StatementTx[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = src.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const sep =
    (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  // Divisor com suporte a aspas (campos com o separador dentro).
  const split = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === sep) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  };

  const header = split(lines[0]).map(normKey);
  const findCol = (keys: string[]) => header.findIndex((h) => keys.includes(h));
  const dateCol = findCol(DATE_KEYS);
  const descCol = findCol(DESC_KEYS);
  const valueCol = findCol(VALUE_KEYS);
  const idCol = findCol(ID_KEYS);
  if (dateCol < 0 || valueCol < 0) return [];

  const txs: StatementTx[] = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const date = brDate(cells[dateCol] ?? "");
    const amount = brNumber(cells[valueCol] ?? "");
    if (!date || amount === null) continue;
    txs.push({
      externalId: idCol >= 0 ? (cells[idCol] ?? "").trim() || null : null,
      date,
      description:
        descCol >= 0 ? (cells[descCol] ?? "").trim() || "Lançamento" : "Lançamento",
      amount,
    });
  }
  return txs;
}

/** Decide o formato pelo conteúdo: OFX quando há <STMTTRN>/<OFX>, senão CSV. */
export function parseStatement(text: string): StatementTx[] {
  return /<(OFX|STMTTRN)>/i.test(text) ? parseOfx(text) : parseStatementCsv(text);
}

// ─────────────────────── Conciliação (matching) ───────────────────────

export type MatchCandidate = {
  id: string;
  amount: number;
  /** Dia do pagamento no formato yyyy-mm-dd. */
  date: string;
};

const dayMs = 24 * 60 * 60 * 1000;
const diffDays = (a: string, b: string): number =>
  Math.abs((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / dayMs);

/**
 * Casa lançamentos de crédito do extrato com pagamentos do sistema:
 * mesmo valor (tolerância de 1 centavo) e data dentro da janela (± dias).
 * Cada pagamento casa com no máximo um lançamento; empate vai para a data
 * mais próxima. Retorna índice do lançamento → id do pagamento.
 */
export function matchStatement(
  txs: StatementTx[],
  payments: MatchCandidate[],
  windowDays = 3
): Map<number, string> {
  const matches = new Map<number, string>();
  const used = new Set<string>();
  txs.forEach((tx, i) => {
    if (tx.amount <= 0) return;
    let best: MatchCandidate | null = null;
    let bestDiff = Infinity;
    for (const p of payments) {
      if (used.has(p.id)) continue;
      if (Math.abs(p.amount - tx.amount) > 0.01) continue;
      const d = diffDays(tx.date, p.date);
      if (d > windowDays || d >= bestDiff) continue;
      best = p;
      bestDiff = d;
    }
    if (best) {
      matches.set(i, best.id);
      used.add(best.id);
    }
  });
  return matches;
}
