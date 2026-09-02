import type { Metadata } from "next";
import { requireUserPage } from "@/lib/auth/session";
import { FavoritesList } from "@/components/store/favorites-list";
import { FavoritesSync } from "@/components/store/favorites-sync";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  await requireUserPage("/conta/favoritos");
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Meus favoritos</h2>
        <p className="text-sm text-muted-foreground">
          Produtos salvos na sua conta — sincronizados em todos os seus aparelhos.
        </p>
      </div>
      <FavoritesSync />
      <FavoritesList />
    </div>
  );
}
