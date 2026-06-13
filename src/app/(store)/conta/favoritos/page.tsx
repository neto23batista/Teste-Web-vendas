import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { FavoritesList } from "@/components/store/favorites-list";
import { FavoritesSync } from "@/components/store/favorites-sync";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Meus favoritos</h2>
        <p className="text-sm text-muted-foreground">
          {user
            ? "Produtos salvos na sua conta — sincronizados em todos os seus aparelhos."
            : "Produtos que você salvou neste dispositivo."}
        </p>
      </div>
      {user && <FavoritesSync />}
      <FavoritesList />
    </div>
  );
}
