"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { importStatement } from "@/client/api/admin";
import { Button } from "@/components/ui/button";

/** Upload do extrato bancário (OFX/CSV) com conciliação automática. */
export function StatementImport() {
  const { pending, confirm, dialog } = useConfirmAction();
  const [summary, setSummary] = React.useState<{ imported: number; matched: number; duplicated: number } | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onImport(fd: FormData) {
    const file = fd.get("file");
    confirm({
      title: "Importar extrato e conciliar lançamentos",
      confirmLabel: "Importar extrato",
      confirmMessage: `Importar ${file instanceof File ? file.name : "este extrato"}? Os novos lançamentos serão incluídos e conciliados quando houver correspondência. Esta operação não executa pagamentos bancários.`,
      action: async () => {
        const res = await importStatement(fd);
        if (res.ok) {
          setSummary({ imported: res.imported, matched: res.matched, duplicated: res.duplicated });
          formRef.current?.reset();
        }
        return res;
      },
      successMessage: "Extrato importado. Confira o resultado da conciliação.",
    });
  }

  return (
    <div className="space-y-3">{dialog}<form
      ref={formRef}
      onSubmit={(event) => { event.preventDefault(); onImport(new FormData(event.currentTarget)); }}
      className="flex flex-wrap items-center gap-3"
    >
      <input
        type="file"
        aria-label="Extrato bancário OFX ou CSV"
        name="file"
        accept=".ofx,.csv,.txt"
        required
        disabled={pending}
        className="text-sm file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-muted file:px-4 file:py-2.5 file:text-sm file:font-semibold hover:file:bg-muted/70"
      />
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Importar extrato
      </Button>
    </form>
    {summary && <p role="status" className="text-sm text-muted-foreground">Importação confirmada: {summary.imported} lançamento(s) novo(s), {summary.matched} conciliado(s) e {summary.duplicated} já existente(s).</p>}
    </div>
  );
}
