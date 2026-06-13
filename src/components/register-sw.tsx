"use client";

import { useEffect } from "react";

/** Registra o service worker (PWA) — só em produção, para não atrapalhar o dev. */
export function RegisterSW() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // best-effort: sem SW o site continua funcionando normalmente
    });
  }, []);
  return null;
}
