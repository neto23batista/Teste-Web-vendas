"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { importStatement } from "@/actions/admin-finance";
import { Button } from "@/components/ui/button";

/** Upload do extrato bancário (OFX/CSV) com conciliação automática. */
export function StatementImport() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  function onImport(fd: FormData) {
    start(async () => {
      const res = await importStatement(fd);
      if (res.ok) {
        toast.success(
          `Extrato importado: ${res.imported} lançamentos novos, ${res.matched} conciliados` +
            (res.duplicated > 0 ? `, ${res.duplicated} já existiam` : "") +
            "."
        );
        formRef.current?.reset();
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao importar o extrato.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={onImport}
      className="flex flex-wrap items-center gap-3"
    >
      <input
        type="file"
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
  );
}
