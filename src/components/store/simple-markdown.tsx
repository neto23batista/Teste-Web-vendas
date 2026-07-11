import * as React from "react";

// Renderizador de Markdown mínimo (sem dependências): títulos ##/###, listas
// com "-", parágrafos e negrito **texto**. Suficiente para textos editáveis no
// admin (política de devolução etc.) sem introduzir lib nem risco de HTML cru.

function inline(text: string, keyBase: string): React.ReactNode[] {
  // Quebra em **negrito** preservando o resto como texto.
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(part);
    if (m) return <strong key={`${keyBase}-${i}`}>{m[1]}</strong>;
    return <React.Fragment key={`${keyBase}-${i}`}>{part}</React.Fragment>;
  });
}

export function SimpleMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!list.length) return;
    const items = list;
    blocks.push(
      <ul key={`ul-${key++}`} className="ml-5 list-disc space-y-1.5 text-sm leading-relaxed text-muted-foreground">
        {items.map((it, i) => (
          <li key={i}>{inline(it, `li-${key}-${i}`)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      flushList();
      blocks.push(
        <h3 key={`h3-${key++}`} className="pt-2 text-base font-bold">
          {inline(line.replace(/^###\s+/, ""), `h3-${key}`)}
        </h3>
      );
    } else if (/^##\s+/.test(line)) {
      flushList();
      blocks.push(
        <h2 key={`h2-${key++}`} className="pt-3 text-xl font-extrabold">
          {inline(line.replace(/^##\s+/, ""), `h2-${key}`)}
        </h2>
      );
    } else if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={`p-${key++}`} className="text-sm leading-relaxed text-muted-foreground">
          {inline(line, `p-${key}`)}
        </p>
      );
    }
  }
  flushList();

  return <div className="space-y-3">{blocks}</div>;
}
