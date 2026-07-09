"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, KeyRound, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { generateIntegrationToken, retryOrderExport } from "@/actions/integration";
import { Button } from "@/components/ui/button";

/**
 * Gera o token do conector da unidade e o exibe UMA vez (com copiar).
 * Regenerar invalida o token anterior — o aviso deixa isso claro.
 */
export function GenerateTokenButton({
  pharmacyId,
  hasToken,
}: {
  pharmacyId: string;
  hasToken: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [token, setToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  function generate() {
    if (
      hasToken &&
      !window.confirm(
        "Regenerar o token invalida o anterior — o conector desta unidade vai parar até receber o novo. Continuar?"
      )
    ) {
      return;
    }
    start(async () => {
      const res = await generateIntegrationToken(pharmacyId);
      if (res.ok && res.token) {
        setToken(res.token);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao gerar o token.");
      }
    });
  }

  function copy() {
    if (!token) return;
    navigator.clipboard?.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (token) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          Copie agora — o token não será exibido de novo:
        </p>
        <div className="flex items-stretch gap-2">
          <code className="block max-w-full flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
            {token}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold transition hover:bg-muted"
          >
            {copied ? (
              <>
                <Check className="size-4 text-success-600" /> Copiado
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copiar
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Button onClick={generate} variant={hasToken ? "outline" : "primary"} size="sm" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
      {hasToken ? "Regenerar token" : "Gerar token do conector"}
    </Button>
  );
}

/** Recoloca um pedido com erro na fila de exportação. */
export function RetryExportButton({ orderExportId }: { orderExportId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function retry() {
    start(async () => {
      const res = await retryOrderExport(orderExportId);
      if (res.ok) {
        toast.success("Pedido de volta na fila — o conector tenta no próximo ciclo.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao reenfileirar.");
      }
    });
  }

  return (
    <Button onClick={retry} variant="outline" size="sm" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
      Reexportar
    </Button>
  );
}
