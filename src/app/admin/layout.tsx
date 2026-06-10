import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin FarmaVida" },
};

// O admin é sempre por sessão e lê o banco a cada requisição.
// `force-dynamic` evita que o build tente pré-renderizar (e bater no banco).
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-dvh bg-background lg:pl-64">
      <AdminSidebar />
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
          <span className="font-extrabold lg:hidden">FarmaVida Admin</span>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {user.name?.[0]?.toUpperCase() ?? "A"}
              </span>
              <div className="hidden text-sm sm:block">
                <p className="font-semibold leading-tight">{user.name}</p>
                <p className="text-xs text-muted-foreground">Administrador</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
