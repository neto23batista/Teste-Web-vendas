"use client";

import * as React from "react";
import { mergeFavorites } from "@/actions/favorites";
import { getLocalFavorites, mergeLocalFavorites } from "@/lib/use-favorites";

/**
 * Sincroniza (uma vez por visita) os favoritos do dispositivo com a conta:
 * envia os locais ao servidor e traz de volta a união — o localStorage segue
 * sendo a fonte da UI, agora idêntico em qualquer aparelho logado.
 */
export function FavoritesSync() {
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    mergeFavorites(getLocalFavorites())
      .then((res) => {
        if (res.ok) mergeLocalFavorites(res.ids);
      })
      .catch(() => {});
  }, []);
  return null;
}
