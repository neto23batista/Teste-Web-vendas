"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
          <AlertTriangle className="size-7" />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold">Erro no painel</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
          Não foi possível concluir esta operação. Tente novamente.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground">
            Código: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset} variant="primary" size="lg">
            <RotateCcw className="size-5" /> Tentar novamente
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/admin">
              <LayoutDashboard className="size-5" /> Voltar ao painel
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
