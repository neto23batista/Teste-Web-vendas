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

// Curva de saturação suave (tanh) p/ o soft-clipper: deixa o som ALTO
// "empurrando" o sinal, mas os picos saturam de forma macia — nunca passam de
// ±1 (sem o clipping áspero de um ganho simples). drive maior = mais alto/grave.
function makeSoftClipCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x);
  }
  return curve;
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
  const busRef = React.useRef<AudioNode | null>(null);
  const prevSignal = React.useRef<OrderSignal | null>(null);
  const ringingRef = React.useRef(false);
  const ringStartCount = React.useRef(0);

  // ── Áudio: jingle "novo pedido" estilo iFood, em VOLUME ALTO ──────────
  const ensureAudio = React.useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      // Barramento p/ ficar ALTO sem estourar: notas → soft-clipper (tanh) →
      // saída. O drive alto (3.0) deixa o alerta ~2× mais alto que o antigo,
      // saturando os picos de forma macia (nunca ultrapassa ±1 = sem clipping).
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeSoftClipCurve(3);
      shaper.oversample = "2x";
      shaper.connect(ctx.destination);
      audioRef.current = ctx;
      busRef.current = shaper;
    }
    return audioRef.current;
  }, []);

  const playChime = React.useCallback(() => {
    const ctx = ensureAudio();
    const bus = busRef.current;
    if (!ctx || !bus) return;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;

    // Jingle no estilo iFood: arpejo maior brilhante subindo (C-E-G-C) com a
    // batidinha dupla no fim. Notas percussivas (ataque rápido + decaída curta)
    // dão o timbre alegre de marimba/sino, chamativo num balcão movimentado.
    const NOTES = [
      { f: 1046.5, t: 0.0 }, // C6
      { f: 1318.51, t: 0.1 }, // E6
      { f: 1567.98, t: 0.2 }, // G6
      { f: 2093.0, t: 0.32 }, // C7
      { f: 1567.98, t: 0.46 }, // G6
      { f: 2093.0, t: 0.56 }, // C7 (resolve no agudo)
    ];
    const PEAK = 0.9;
    for (const { f, t } of NOTES) {
      const at = now + t;
      // Fundamental (triangle) + 1 harmônico (sine) p/ o brilho de sino/marimba.
      const partials: { freq: number; amp: number; type: OscillatorType }[] = [
        { freq: f, amp: PEAK, type: "triangle" },
        { freq: f * 2, amp: PEAK * 0.25, type: "sine" },
      ];
      for (const { freq, amp, type } of partials) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(amp, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
        osc.connect(gain).connect(bus);
        osc.start(at);
        osc.stop(at + 0.34);
      }
    }
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
