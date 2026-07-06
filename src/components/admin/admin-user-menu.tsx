"use client";

import * as React from "react";
import Link from "next/link";
import { Store, LogOut } from "lucide-react";
import { logout } from "@/actions/auth";

/**
 * Avatar do admin no cabeçalho, agora CLICÁVEL: abre um menu com "Ver loja" e
 * "Sair". Antes o logout só existia no rodapé da sidebar (hidden lg:flex), então
 * no mobile não havia como sair — este menu funciona em qualquer tamanho de tela.
 */
export function AdminUserMenu({ name }: { name: string }) {
  const [open, setOpen] = React.useState(false);
  const initial = name.trim()[0]?.toUpperCase() ?? "A";

  // Fecha com Esc.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Conta do administrador"
        className="flex items-center gap-2.5 rounded-full pr-1 outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
          {initial}
        </span>
        <div className="hidden text-left text-sm sm:block">
          <p className="font-semibold leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground">Administrador</p>
        </div>
      </button>

      {open && (
        <>
          {/* Toque fora fecha o menu (cobre a tela toda, atrás do menu). */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-card)]"
          >
            {/* No mobile o nome não cabe no cabeçalho — mostra aqui. */}
            <div className="border-b border-border px-3 py-2 sm:hidden">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">Administrador</p>
            </div>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Store className="size-4.5" /> Ver loja
            </Link>
            <form action={logout}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
              >
                <LogOut className="size-4.5" /> Sair
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
