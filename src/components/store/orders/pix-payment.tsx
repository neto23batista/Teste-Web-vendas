"use client";

import * as React from "react";
import Image from "next/image";
import { useOrderPolling } from "@/hooks/use-order-polling";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, Check, QrCode, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";

/**
 * Pagamento PIX nativo na página do pedido: mostra o QR Code e o copia-e-cola,
 * e faz polling do status do pedido — quando o webhook confirma, a página
 * avança sozinha (router.refresh).
 */
export function PixPayment({
  orderNumber,
  amount,
  qrCode,
  qrCodeBase64,
}: {
  orderNumber: string;
  amount: number;
  qrCode: string;
  qrCodeBase64: string;
}) {
  const { unavailable, changed, refresh } = useOrderPolling(orderNumber, "PENDING", 5000, "PENDING");
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código PIX e copie manualmente.");
    }
  }

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (changed) return (
    <div role="status" className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm">
      O servidor informou uma mudança neste pagamento. Não use o código anterior nem pague novamente.
      <Button onClick={refresh} variant="outline" className="mt-3">Consultar estado atualizado</Button>
    </div>
  );

  return (
    <div className="mt-6 rounded-2xl border border-brand-200 bg-card p-6 dark:border-brand-600/30">
      <div className="flex items-center gap-2">
        <QrCode className="size-5 text-brand-600 dark:text-brand-400" />
        <h2 className="font-bold">Pague com PIX para confirmar</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Escaneie o QR Code no app do seu banco ou use o copia-e-cola. A
        confirmação é automática —{" "}
        <span role="status" className="inline-flex items-center gap-1 font-medium text-foreground">
          <Loader2 className="size-3.5 animate-spin" /> aguardando pagamento
        </span>
        .
      </p>

      {unavailable && (
        <div role="status" className="mt-3 text-sm">
          Não foi possível consultar a confirmação. Não pague novamente; confira o estado do pedido.
          <Button variant="outline" onClick={refresh} className="mt-2">Atualizar pedido</Button>
        </div>
      )}
      <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        {qrCodeBase64 ? (
          <div className="relative size-48 shrink-0 overflow-hidden rounded-xl border border-border bg-white">
            <Image
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt={`QR Code PIX do pedido ${orderNumber}`}
              fill
              unoptimized
              sizes="192px"
              className="object-contain p-2"
            />
          </div>
        ) : (
          <div className="grid size-48 shrink-0 place-items-center rounded-xl border border-dashed border-border px-3 text-center text-xs text-muted-foreground">
            QR indisponível — use o código
          </div>
        )}

        <div className="w-full min-w-0 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Valor
            </p>
            <p className="text-xl font-extrabold text-brand-700 dark:text-brand-400">
              {formatBRL(amount)}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              PIX copia e cola
            </p>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                {qrCode}
              </code>
              <button
                type="button"
                onClick={copy}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold transition hover:bg-muted"
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
        </div>
      </div>
    </div>
  );
}
