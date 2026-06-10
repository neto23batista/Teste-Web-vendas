import type { Metadata } from "next";
import { FavoritesList } from "@/components/store/favorites-list";

export const metadata: Metadata = { title: "Favoritos" };

export default function FavoritesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Meus favoritos</h2>
        <p className="text-sm text-muted-foreground">
          Produtos que você salvou neste dispositivo.
        </p>
      </div>
      <FavoritesList />
    </div>
  );
}
