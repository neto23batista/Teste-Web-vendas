"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { StaffProfile } from "@prisma/client";
import { createStaff, updateStaffProfile, revokeStaff } from "@/actions/admin-team";
import { PROFILE_LABEL, PROFILE_DESCRIPTION } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

const PROFILES: StaffProfile[] = ["OWNER", "PHARMACIST", "STOCKIST", "ATTENDANT"];

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  staffProfile: StaffProfile | null;
  pharmacyName: string | null;
  isSelf: boolean;
};

export function TeamManager({
  staff,
  pharmacies,
}: {
  staff: StaffRow[];
  pharmacies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onCreate(formData: FormData) {
    start(async () => {
      const res = await createStaff(formData);
      if (res.ok && res.password) {
        setTempPassword(res.password);
        formRef.current?.reset();
        toast.success("Membro criado. Copie a senha temporária.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao criar o membro.");
      }
    });
  }

  function changeProfile(userId: string, profile: StaffProfile) {
    start(async () => {
      const res = await updateStaffProfile(userId, profile);
      if (res.ok) {
        toast.success("Perfil atualizado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao atualizar.");
      }
    });
  }

  function revoke(userId: string, email: string) {
    if (!window.confirm(`Remover o acesso de ${email} ao painel? A conta vira cliente comum.`)) {
      return;
    }
    start(async () => {
      const res = await revokeStaff(userId);
      if (res.ok) {
        toast.success("Acesso removido.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao remover.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Novo membro */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <UserPlus className="size-5 text-brand-600 dark:text-brand-400" /> Novo membro
        </h2>
        <form ref={formRef} action={onCreate} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo" htmlFor="name">
            <Input id="name" name="name" placeholder="Maria Silva" required />
          </Field>
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="maria@farmavida.com" required />
          </Field>
          <Field label="Perfil" htmlFor="staffProfile">
            <select
              id="staffProfile"
              name="staffProfile"
              defaultValue="ATTENDANT"
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400"
            >
              {PROFILES.map((p) => (
                <option key={p} value={p}>
                  {PROFILE_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unidade" htmlFor="pharmacyId">
            <select
              id="pharmacyId"
              name="pharmacyId"
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400"
            >
              <option value="">— sem unidade —</option>
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? <Loader2 className="size-5 animate-spin" /> : <UserPlus className="size-5" />}
              Criar membro
            </Button>
          </div>
        </form>

        {tempPassword && (
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Senha temporária — copie agora e peça para o membro trocá-la em
              &quot;Esqueci minha senha&quot;. Ela não será exibida de novo.
            </p>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 truncate rounded-lg border border-border bg-card px-3 py-2 text-xs">
                {tempPassword}
              </code>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(tempPassword).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold transition hover:bg-muted"
              >
                {copied ? (
                  <>
                    <Check className="size-4 text-success-600" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Equipe atual */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold">Equipe ({staff.length})</h2>
        <div className="divide-y divide-border">
          {staff.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {m.name}
                  {m.isSelf && (
                    <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                      você
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.email}
                  {m.pharmacyName ? ` · ${m.pharmacyName}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {PROFILE_DESCRIPTION[m.staffProfile ?? "OWNER"]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={m.staffProfile ?? "OWNER"}
                  disabled={pending}
                  onChange={(e) => changeProfile(m.id, e.target.value as StaffProfile)}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400"
                >
                  {PROFILES.map((p) => (
                    <option key={p} value={p}>
                      {PROFILE_LABEL[p]}
                    </option>
                  ))}
                </select>
                {!m.isSelf && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remover acesso de ${m.email}`}
                    disabled={pending}
                    onClick={() => revoke(m.id, m.email)}
                  >
                    <Trash2 className="size-4 text-danger-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
