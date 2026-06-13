"use client";

import * as React from "react";
import { toggleFavorite } from "@/actions/favorites";

const KEY = "farmavida:favorites";
const EVENT = "favorites:changed";
const EMPTY: string[] = [];

// Cache do snapshot para o useSyncExternalStore: getSnapshot precisa devolver a
// MESMA referência enquanto os dados não mudam (senão entra em loop de render).
let cache: string[] = EMPTY;
let cacheRaw: string | null = null;

function readSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(KEY);
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    const arr = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function subscribe(cb: () => void) {
  // EVENT sincroniza instâncias na mesma aba; "storage", entre abas.
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function persist(ids: string[]) {
  const raw = JSON.stringify(ids);
  localStorage.setItem(KEY, raw);
  // Atualiza o cache no mesmo tick (referência estável do array recém-criado).
  cache = ids;
  cacheRaw = raw;
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Mescla ids (ex.: vindos da conta no servidor) com os locais — usado pela
 *  sincronização de "Meus favoritos" quando o usuário está logado. */
export function mergeLocalFavorites(ids: string[]) {
  const current = readSnapshot();
  const merged = [...new Set([...ids, ...current])];
  if (merged.length !== current.length || merged.some((x, i) => current[i] !== x)) {
    persist(merged);
  }
  return merged;
}

/** Snapshot direto (fora de componentes React). */
export function getLocalFavorites(): string[] {
  return readSnapshot();
}

// Store "montado": false no SSR/primeiro render, true após a hidratação — sem
// chamar setState dentro de um efeito.
const noopSubscribe = () => () => {};

/**
 * Lista de desejos guardada no localStorage do dispositivo — não exige login
 * nem mudança de banco. Sincroniza entre componentes (mesma aba e entre abas).
 */
export function useFavorites() {
  const ids = React.useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);
  const ready = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const toggle = React.useCallback((id: string) => {
    const current = readSnapshot();
    const exists = current.includes(id);
    const next = exists ? current.filter((x) => x !== id) : [id, ...current];
    persist(next);
    // Espelha na conta (best-effort; no-op para visitantes — não bloqueia a UI).
    void toggleFavorite(id, !exists).catch(() => {});
    return !exists; // true = passou a ser favorito
  }, []);

  const remove = React.useCallback((id: string) => {
    persist(readSnapshot().filter((x) => x !== id));
    void toggleFavorite(id, false).catch(() => {});
  }, []);

  return {
    favorites: ids,
    count: ids.length,
    ready,
    isFavorite: (id: string) => ids.includes(id),
    toggle,
    remove,
  };
}
