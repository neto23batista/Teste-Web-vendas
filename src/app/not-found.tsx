import Link from "next/link";
import { Home, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="grid size-12 place-items-center rounded-2xl gradient-brand text-white shadow-[var(--shadow-glow)]">
            <Plus className="size-6" strokeWidth={3} />
          </span>
        </Link>
        <p className="mt-8 text-7xl font-extrabold text-brand-600 dark:text-brand-400">
          404
        </p>
        <h1 className="mt-2 text-2xl font-extrabold">Página não encontrada</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
          O endereço que você procura não existe ou foi movido. Vamos te levar de
          volta para um lugar seguro.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="primary" size="lg">
            <Link href="/">
              <Home className="size-5" /> Voltar ao início
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/catalogo">
              <Search className="size-5" /> Ver catálogo
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
