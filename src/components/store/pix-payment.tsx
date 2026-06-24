"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);

  function copy() {
    navigator.clipboard?.writeText(qrCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Poll do status: a cada 5s pergunta ao servidor; ao sair de PENDING, atualiza
  // a página (que então mostra "Pedido confirmado"). Para ao desmontar.
  React.useEffect(() => {
    let active = true;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (active && data.status && data.status !== "PENDING") {
          clearInterval(id);
          router.refresh();
        }
      } catch {
        // rede instável — tenta de novo no próximo tick.
      }
    }, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [orderNumber, router]);

  return (
    <div className="mt-6 rounded-2xl border border-brand-200 bg-card p-6 dark:border-brand-600/30">
      <div className="flex items-center gap-2">
        <QrCode className="size-5 text-brand-600 dark:text-brand-400" />
        <h2 className="font-bold">Pague com PIX para confirmar</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Escaneie o QR Code no app do seu banco ou use o copia-e-cola. A
        confirmação é automática —{" "}
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <Loader2 className="size-3.5 animate-spin" /> aguardando pagamento
        </span>
        .
      </p>

      <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        {qrCodeBase64 ? (
          <Image
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt={`QR Code PIX do pedido ${orderNumber}`}
            width={200}
            height={200}
            unoptimized
            className="mx-auto size-48 rounded-xl border border-border bg-white p-2"
          />
        ) : (
          <div className="mx-auto grid size-48 place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
            QR indisponível — use o código
          </div>
        )}

        <div className="space-y-3">
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
              <code className="block max-w-full flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                {qrCode}
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
        </div>
      </div>
    </div>
  );
}
