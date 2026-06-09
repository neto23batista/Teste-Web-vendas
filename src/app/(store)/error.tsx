"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Loga para o console/monitoramento; não expõe detalhes ao usuário.
    console.error(error);
  }, [error]);

  return (
    <div className="container-page grid place-items-center py-20">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
          <AlertTriangle className="size-7" />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold">Algo deu errado</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
          Tivemos um problema ao carregar esta página. Você pode tentar de novo
          ou voltar ao início.
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
            <Link href="/">
              <Home className="size-5" /> Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
