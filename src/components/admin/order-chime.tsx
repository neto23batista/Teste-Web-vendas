"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isNewOrder, type OrderSignal } from "@/lib/order-chime";

const STORAGE_KEY = "fv_order_chime";
const CHANGE_EVENT = "fv-chime-change";
const POLL_MS = 15_000;
const RING_EVERY_MS = 4_000;

// ── enabled persistido no localStorage, lido via useSyncExternalStore ──
// (evita setState em effect e mismatch de hidratação — o padrão do React p/
// fontes externas mutáveis).
function subscribeEnabled(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHANGE_EVENT, cb);
  };
}
const getEnabled = () =>
  typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "on";
const getEnabledServer = () => false;

function setEnabledPersist(on: boolean) {
  localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Som de "pedido novo" no painel (estilo iFood): sino no cabeçalho que, quando
 * ligado, consulta a cada 15s quantos pedidos há a processar e — se chegou um
 * novo — TOCA repetidamente (Web Audio, sem arquivo/CSP) + notificação do
 * sistema + toast, até o admin abrir os pedidos ou silenciar.
 */
export function OrderChime() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unit = searchParams.get("unit") ?? "";

  const enabled = React.useSyncExternalStore(
    subscribeEnabled,
    getEnabled,
    getEnabledServer
  );
  const [ringing, setRinging] = React.useState(false);

  const audioRef = React.useRef<AudioContext | null>(null);
  const prevSignal = React.useRef<OrderSignal | null>(null);
  const ringingRef = React.useRef(false);
  const ringStartCount = React.useRef(0);

  // ── Áudio: dois tons (ding-dong) com envelope p/ não estalar ──────────
  const ensureAudio = React.useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return null;
      audioRef.current = new Ctx();
    }
    return audioRef.current;
  }, []);

  const playChime = React.useCallback(() => {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    [
      { freq: 987.77, at: 0 }, // B5
      { freq: 1318.51, at: 0.18 }, // E6
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + at;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }, [ensureAudio]);

  const stopRinging = React.useCallback(() => {
    ringingRef.current = false;
    setRinging(false);
    toast.dismiss("novo-pedido");
  }, []);

  const startRinging = React.useCallback(
    (latestNumber: string | null, atCount: number) => {
      ringingRef.current = true;
      ringStartCount.current = atCount;
      setRinging(true);
      const titulo = latestNumber ? `Novo pedido ${latestNumber}` : "Novo pedido recebido";
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(titulo, {
            body: "Um novo pedido chegou no painel FarmaVida.",
            tag: "fv-novo-pedido",
            icon: "/icon-192.png",
          });
        } catch {
          // alguns navegadores exigem SW p/ Notification — som/toast cobrem
        }
      }
      toast.success(titulo, {
        id: "novo-pedido",
        duration: Infinity,
        action: {
          label: "Ver pedidos",
          onClick: () => {
            stopRinging();
            router.push("/admin/pedidos");
          },
        },
      });
    },
    [stopRinging, router]
  );

  // Enquanto "tocando": repete o chime a cada RING_EVERY_MS até parar.
  React.useEffect(() => {
    if (!ringing) return;
    playChime();
    navigator.vibrate?.([200, 100, 200]);
    const id = setInterval(() => {
      playChime();
      navigator.vibrate?.(200);
    }, RING_EVERY_MS);
    return () => clearInterval(id);
  }, [ringing, playChime]);

  // ── Poller: só quando ligado; NÃO pausa com a aba oculta ──────────────
  React.useEffect(() => {
    if (!enabled) return;
    let active = true;

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/admin/orders/pending${unit ? `?unit=${encodeURIComponent(unit)}` : ""}`,
          { cache: "no-store" }
        );
        if (!res.ok || !active) return;
        const data = (await res.json()) as OrderSignal & { latestNumber: string | null };
        const next: OrderSignal = { count: data.count, latestAt: data.latestAt };
        if (isNewOrder(prevSignal.current, next)) {
          startRinging(data.latestNumber, next.count);
        } else if (ringingRef.current && next.count < ringStartCount.current) {
          // Pedido tratado (a fila diminuiu) — silencia sozinho.
          stopRinging();
        }
        prevSignal.current = next;
      } catch {
        // rede instável — tenta no próximo tick
      }
    };

    void tick(); // baseline imediato (prev null → não toca)
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [enabled, unit, startRinging, stopRinging]);

  // Recarregou com o som ligado: re-destrava o áudio no 1º gesto do usuário.
  React.useEffect(() => {
    if (!enabled) return;
    const unlock = () => {
      const ctx = ensureAudio();
      if (ctx?.state === "suspended") void ctx.resume();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled, ensureAudio]);

  const toggle = React.useCallback(() => {
    if (enabled) {
      stopRinging();
      prevSignal.current = null;
      setEnabledPersist(false);
      return;
    }
    // Ligar: o clique É o gesto que autoriza áudio + notificação.
    const ctx = ensureAudio();
    if (ctx?.state === "suspended") void ctx.resume();
    playChime(); // blip de confirmação "funciona"
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    prevSignal.current = null; // próxima leitura vira baseline
    setEnabledPersist(true);
    toast.success("Som de novos pedidos ativado.");
  }, [enabled, ensureAudio, playChime, stopRinging]);

  const label = ringing
    ? "Novo pedido! Clique para silenciar"
    : enabled
      ? "Som de novos pedidos ligado — clique para desligar"
      : "Ativar som de novos pedidos";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      data-chime={ringing ? "ringing" : enabled ? "on" : "off"}
      onClick={ringing ? stopRinging : toggle}
      className={
        ringing
          ? "animate-pulse text-brand-600 dark:text-brand-400"
          : enabled
            ? "text-brand-600 dark:text-brand-400"
            : "text-muted-foreground hover:text-foreground"
      }
    >
      {ringing ? (
        <BellRing className="size-5" />
      ) : enabled ? (
        <Bell className="size-5" />
      ) : (
        <BellOff className="size-5" />
      )}
    </Button>
  );
}
