import { SiteHeader } from "@/components/store/site-header";
import { SiteFooter } from "@/components/store/site-footer";
import { BottomNav } from "@/components/store/bottom-nav";
import { getCartCount } from "@/lib/cart";

// A loja lê dados do banco (produtos, sacola, conta) a cada requisição.
// `force-dynamic` impede o Next de tentar pré-renderizar essas páginas no
// build — assim o build NÃO depende de um banco acessível (essencial na
// Vercel, onde o banco de produção pode não estar pronto durante o build).
export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cartCount = await getCartCount();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <SiteFooter />
      <BottomNav cartCount={cartCount} />
    </div>
  );
}
