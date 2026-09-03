"use client";

import * as React from "react";
import { Download, Loader2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOperation } from "@/hooks/use-operation";
import { readDataExport, requestDataExport, DATA_EXPORT_DOWNLOAD_URL } from "@/client/api/account";
import type { ExportState } from "@/contracts/account";
export type { ExportState } from "@/contracts/account";

const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR");

/**
 * Portabilidade de dados em duas etapas: solicitar e, depois, baixar.
 *
 * O arquivo é montado fora da requisição porque o histórico de um titular
 * antigo não cabe numa resposta HTTP. A tela precisa contar isso — um botão que
 * some por trinta segundos e depois falha é pior do que um estado explícito.
 */
export function DataExport({ initial }: { initial: ExportState }) {
  // O estado inicial vem do servidor: a página já sabe se existe exportação
  // pronta, então a tela não pisca "sem pedido" antes de descobrir que há.
  const [state, setState] = React.useState<ExportState>(initial);
  const { pending, run } = useOperation();
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    const result = await readDataExport({ signal });
    if (signal?.aborted) return;
    if (result.ok) {
      setState(result.data);
      setLoadError(null);
    } else {
      // Keep the last confirmed state. A network failure is not an empty request.
      setLoadError(result.message);
    }
  }, []);

  React.useEffect(() => {
    if (state.status !== "PENDING") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") await load(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(() => void tick(), 30_000);
    };
    timer = setTimeout(() => void tick(), 30_000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [state.status, load]);

  function request() {
    run(async () => {
      const result = await requestDataExport();
      if (!result.ok) toast.error(result.message);
      else toast.success("Pedido registrado. Avisaremos aqui quando o arquivo ficar pronto.");
      await load();
    });
  }

  return (
    <div className="space-y-3" aria-busy={pending}>
      {loadError && <div role="alert" className="text-sm"><p>{loadError} O último estado confirmado foi preservado.</p><Button variant="outline" onClick={() => run(() => load())} disabled={pending}>Atualizar andamento</Button></div>}
      {state.status === "PENDING" && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            Em preparo desde {dateTime(state.requestedAt)}. O arquivo aparece
            aqui assim que ficar pronto — pode levar algumas horas.
          </span>
        </p>
      )}

      {(state.status === "FAILED" || state.status === "EXPIRED") && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            {state.status === "EXPIRED"
              ? "O arquivo anterior expirou e foi apagado. Solicite novamente."
              : "A geração não foi concluída. Solicite novamente."}
          </span>
        </p>
      )}

      {state.status === "READY" ? (
        <div className="space-y-2">
          <Button asChild variant="outline">
            <a href={DATA_EXPORT_DOWNLOAD_URL} download>
              <Download className="size-4" /> Baixar meus dados (JSON)
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Gerado em {dateTime(state.readyAt)}. Disponível até{" "}
            {dateTime(state.expiresAt)} — depois disso o arquivo é apagado do
            nosso armazenamento.
          </p>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={pending || state.status === "PENDING"}
          onClick={request}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Solicitar exportação dos meus dados
        </Button>
      )}
    </div>
  );
}
