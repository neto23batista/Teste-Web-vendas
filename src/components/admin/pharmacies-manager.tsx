"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, MapPin, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import {
  createPharmacy,
  setPharmacyActive,
  deletePharmacy,
  addCepRange,
  removeCepRange,
  setPharmacyShipping,
  assignUnitAdmin,
  removeUnitAdmin,
  type PharmacyResult,
} from "@/actions/admin-pharmacies";
import type { PharmacyType } from "@prisma/client";

type RangeView = { id: string; start: number; end: number };
type UnitView = {
  id: string;
  name: string;
  type: PharmacyType;
  active: boolean;
  city: string | null;
  state: string | null;
  shippingFlat: number | null;
  shippingFreeMin: number | null;
  cepRanges: RangeView[];
};
type AdminView = { id: string; name: string; email: string; pharmacyId: string | null };

function fmtCep(n: number) {
  const s = String(n).padStart(8, "0");
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

export function PharmaciesManager({
  units,
  admins,
  currentUserId,
}: {
  units: UnitView[];
  admins: AdminView[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function run(fn: () => Promise<PharmacyResult>, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Não foi possível concluir a ação.");
        return;
      }
      after?.();
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-brand-600 dark:text-brand-400" />
        <h2 className="font-bold">Unidades (matriz e filiais)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        O cliente é roteado por CEP para a unidade que atende sua região; sem
        cobertura, cai na matriz. Catálogo e preços são compartilhados; o estoque
        é por unidade.
      </p>

      {error && (
        <p className="rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
          {error}
        </p>
      )}

      <div className="space-y-4">
        {units.map((u) => (
          <div key={u.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{u.name}</span>
              <span
                className={
                  u.type === "MATRIZ"
                    ? "rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300"
                    : "rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground"
                }
              >
                {u.type === "MATRIZ" ? "Matriz" : "Filial"}
              </span>
              {!u.active && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  Inativa
                </span>
              )}
              {(u.city || u.state) && (
                <span className="text-xs text-muted-foreground">
                  {[u.city, u.state].filter(Boolean).join(" / ")}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setPharmacyActive(u.id, !u.active))}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-muted disabled:opacity-40"
                >
                  {u.active ? "Desativar" : "Ativar"}
                </button>
                {u.type !== "MATRIZ" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Excluir a unidade "${u.name}"?`))
                        run(() => deletePharmacy(u.id));
                    }}
                    aria-label="Excluir unidade"
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Faixas de CEP atendidas */}
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Faixas de CEP atendidas
              </p>
              {u.cepRanges.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {u.type === "MATRIZ"
                    ? "Sem faixas — atende como fallback para CEPs não cobertos."
                    : "Nenhuma faixa cadastrada (não recebe pedidos por CEP)."}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {u.cepRanges.map((r) => (
                    <li
                      key={r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium"
                    >
                      <MapPin className="size-3 text-brand-600 dark:text-brand-400" />
                      {fmtCep(r.start)} – {fmtCep(r.end)}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => removeCepRange(r.id))}
                        aria-label="Remover faixa"
                        className="text-muted-foreground transition hover:text-danger-500 disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <AddRangeForm pharmacyId={u.id} pending={pending} onAdd={run} />
            </div>

            {/* Administradores da unidade */}
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Administradores
              </p>
              {admins.filter((a) => a.pharmacyId === u.id).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum administrador nesta unidade.
                </p>
              ) : (
                <ul className="space-y-1">
                  {admins
                    .filter((a) => a.pharmacyId === u.id)
                    .map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="font-medium">{a.name}</span>
                        <span className="text-xs text-muted-foreground">{a.email}</span>
                        {a.id !== currentUserId && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (confirm(`Revogar o acesso admin de ${a.email}?`))
                                run(() => removeUnitAdmin(a.id));
                            }}
                            className="ml-auto text-xs font-semibold text-muted-foreground transition hover:text-danger-500 disabled:opacity-40"
                          >
                            Revogar
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              )}
              <AssignAdminForm pharmacyId={u.id} pending={pending} onAssign={run} />
            </div>

            {/* Frete desta unidade (override do global) */}
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Frete desta unidade
              </p>
              <p className="text-xs text-muted-foreground">
                Em branco = usa o frete global (Configurações).
              </p>
              <ShippingForm
                pharmacyId={u.id}
                flat={u.shippingFlat}
                freeMin={u.shippingFreeMin}
                pending={pending}
                onSave={run}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Nova unidade */}
      <NewUnitForm pending={pending} onCreate={run} />
    </section>
  );
}

function AddRangeForm({
  pharmacyId,
  pending,
  onAdd,
}: {
  pharmacyId: string;
  pending: boolean;
  onAdd: (fn: () => Promise<PharmacyResult>, after?: () => void) => void;
}) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(
          () => addCepRange(pharmacyId, from, to),
          () => {
            setFrom("");
            setTo("");
          }
        );
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        inputMode="numeric"
        placeholder="CEP inicial"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="h-9 w-32 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
      />
      <span className="text-xs text-muted-foreground">até</span>
      <input
        inputMode="numeric"
        placeholder="CEP final"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="h-9 w-32 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
      />
      <button
        type="submit"
        disabled={pending || !from.trim() || !to.trim()}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold transition hover:bg-muted disabled:opacity-40"
      >
        <Plus className="size-3.5" /> Adicionar faixa
      </button>
    </form>
  );
}

function AssignAdminForm({
  pharmacyId,
  pending,
  onAssign,
}: {
  pharmacyId: string;
  pending: boolean;
  onAssign: (fn: () => Promise<PharmacyResult>, after?: () => void) => void;
}) {
  const [email, setEmail] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAssign(
          () => assignUnitAdmin(email, pharmacyId),
          () => setEmail("")
        );
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        type="email"
        placeholder="e-mail de um usuário existente"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-9 w-64 max-w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
      />
      <button
        type="submit"
        disabled={pending || !email.trim()}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold transition hover:bg-muted disabled:opacity-40"
      >
        <Plus className="size-3.5" /> Tornar admin desta unidade
      </button>
    </form>
  );
}

function ShippingForm({
  pharmacyId,
  flat,
  freeMin,
  pending,
  onSave,
}: {
  pharmacyId: string;
  flat: number | null;
  freeMin: number | null;
  pending: boolean;
  onSave: (fn: () => Promise<PharmacyResult>, after?: () => void) => void;
}) {
  const [f, setF] = React.useState(flat?.toString() ?? "");
  const [m, setM] = React.useState(freeMin?.toString() ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(() => setPharmacyShipping(pharmacyId, f, m));
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <label className="text-xs font-medium text-muted-foreground">
        Frete fixo (R$)
        <input
          inputMode="decimal"
          placeholder="global"
          value={f}
          onChange={(e) => setF(e.target.value)}
          className="mt-1 block h-9 w-28 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
        />
      </label>
      <label className="text-xs font-medium text-muted-foreground">
        Frete grátis acima de (R$)
        <input
          inputMode="decimal"
          placeholder="global"
          value={m}
          onChange={(e) => setM(e.target.value)}
          className="mt-1 block h-9 w-40 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-brand-400"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold transition hover:bg-muted disabled:opacity-40"
      >
        Salvar frete
      </button>
    </form>
  );
}

function NewUnitForm({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (fn: () => Promise<PharmacyResult>, after?: () => void) => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<PharmacyType>("FILIAL");
  const [city, setCity] = React.useState("");
  const [uf, setUf] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(
          () => createPharmacy({ name, type, city, state: uf }),
          () => {
            setName("");
            setCity("");
            setUf("");
            setType("FILIAL");
          }
        );
      }}
      className="space-y-3 rounded-xl border border-dashed border-border p-4"
    >
      <p className="text-sm font-bold">Nova unidade</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" htmlFor="np-name">
          <Input
            id="np-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="FarmaVida Filial Centro"
          />
        </Field>
        <Field label="Tipo" htmlFor="np-type">
          <select
            id="np-type"
            value={type}
            onChange={(e) => setType(e.target.value as PharmacyType)}
            className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-brand-400"
          >
            <option value="FILIAL">Filial</option>
            <option value="MATRIZ">Matriz</option>
          </select>
        </Field>
        <Field label="Cidade" htmlFor="np-city">
          <Input id="np-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="UF" htmlFor="np-uf">
          <Input id="np-uf" value={uf} onChange={(e) => setUf(e.target.value)} placeholder="SP" />
        </Field>
      </div>
      <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
        Cadastrar unidade
      </Button>
    </form>
  );
}
