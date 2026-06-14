"use client";

import { Building2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Unit = { id: string; name: string };

/**
 * Seletor de unidade do admin da MATRIZ (visão global). Carrega a unidade
 * escolhida no query param `?unit=` — as páginas leem e filtram por ela.
 * Admin de filial não vê este seletor (fica travado na própria unidade).
 */
export function AdminUnitSwitcher({ pharmacies }: { pharmacies: Unit[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("unit") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp.toString());
    if (e.target.value) params.set("unit", e.target.value);
    else params.delete("unit");
    params.delete("page"); // troca de unidade reinicia a paginação
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm">
      <Building2 className="size-4 text-muted-foreground" />
      <select
        value={current}
        onChange={onChange}
        aria-label="Unidade"
        className="h-9 bg-transparent pr-1 text-sm font-semibold outline-none"
      >
        <option value="">Todas as unidades</option>
        {pharmacies.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
