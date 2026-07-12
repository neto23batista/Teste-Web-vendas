"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { importProducts, type ImportResult } from "@/actions/admin-products";
import { Button } from "@/components/ui/button";

const TEMPLATE_HEADER =
  "nome,sku,ean,preco,promo,estoque,categoria,marca,principio_ativo,descricao,generico";
const TEMPLATE_ROWS = [
  'Dipirona 500mg 10 comprimidos,DIP500,7891234567890,9.90,7.90,50,Medicamentos,EMS,Dipirona sódica,"Analgésico e antitérmico",nao,sim',
  "Protetor Solar FPS 50,PROT50,7890000000001,49.90,,30,Dermocosméticos,Nivea,,Proteção UVA/UVB,nao,nao",
];

export function ProductImport() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Selecione um arquivo CSV.");
      return;
    }
    start(async () => {
      const res = await importProducts(fd);
      setResult(res);
      if (res.ok && res.created + res.updated > 0) {
        toast.success(`${res.created} criados · ${res.updated} atualizados`);
        router.refresh();
      } else if (res.ok) {
        toast.warning("Nenhum produto importado. Verifique os erros.");
      } else {
        toast.error(res.errors[0] ?? "Falha na importação.");
      }
    });
  }

  function downloadTemplate() {
    const csv = [TEMPLATE_HEADER, ...TEMPLATE_ROWS].join("\r\n");
    // BOM para o Excel reconhecer UTF-8.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Arquivo CSV</label>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              className="block w-full cursor-pointer rounded-xl border border-border bg-background text-sm file:mr-4 file:cursor-pointer file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:font-semibold file:text-white hover:file:bg-brand-700"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Máx. 2 MB. A primeira linha deve ser o cabeçalho. Categoria e marca
              precisam já existir no sistema (busca por nome ou slug).
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Upload className="size-5" />
              )}
              Importar
            </Button>
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download className="size-5" /> Baixar modelo CSV
            </Button>
          </div>
        </form>
      </div>

      {result && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <CheckCircle2 className="size-4" /> {result.created} criados
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-brand-100 px-4 py-2 text-sm font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
              <CheckCircle2 className="size-4" /> {result.updated} atualizados
            </div>
            {result.errors.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                <AlertTriangle className="size-4" /> {result.errors.length} avisos
              </div>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Avisos / linhas ignoradas</p>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {result.errors.map((err, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
