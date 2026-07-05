import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminScope, getCurrentUser } from "@/lib/session";
import { getAdminBadges } from "@/lib/admin";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminUnitSwitcher } from "@/components/admin/admin-unit-switcher";
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

  const b = await getAdminBadges();
  const badges = {
    "/admin/pedidos": b.ordersToProcess,
    "/admin/receitas": b.pendingPrescriptions,
    "/admin/avaliacoes": b.pendingReviews,
    "/admin/estoque": b.lowStock,
  };

  // Matriz (escopo global) escolhe a unidade pelo seletor; filial fica fixa na
  // própria e só vê o nome. Escopo vem de getAdminScope (fonte única da regra).
  const { isGlobal } = await getAdminScope();
  const pharmacies = await listPharmaciesSafe();
  const ownUnit = pharmacies.find((p) => p.id === user.pharmacyId) ?? null;

  return (
    <div className="min-h-dvh overflow-x-clip bg-background lg:pl-64 print:pl-0">
      <AdminSidebar badges={badges} isGlobal={isGlobal} />
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6 print:hidden">
          <span className="font-extrabold lg:hidden">FarmaVida Admin</span>
          <div className="ml-auto flex items-center gap-3">
            {isGlobal && pharmacies.length > 1 ? (
              <Suspense fallback={null}>
                <AdminUnitSwitcher pharmacies={pharmacies} />
              </Suspense>
            ) : ownUnit ? (
              <span className="hidden rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:inline">
                Unidade: {ownUnit.name}
              </span>
            ) : null}
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
        <main className="aurora flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
