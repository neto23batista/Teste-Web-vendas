"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  X,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { lookupCep } from "@/lib/viacep";
import {
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type AddressState,
} from "@/actions/addresses";

export type Address = {
  id: string;
  label: string;
  recipient: string;
  zip: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  isDefault: boolean;
};

function AddressForm({
  action,
  defaults,
  submitLabel,
  onDone,
}: {
  action: (prev: AddressState, fd: FormData) => Promise<AddressState>;
  defaults?: Partial<Address>;
  submitLabel: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [cepLoading, setCepLoading] = React.useState(false);
  const [state, formAction, pending] = useActionState<AddressState, FormData>(
    action,
    undefined
  );

  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Endereço salvo");
      router.refresh();
      onDone();
    }
    // onDone é estável o suficiente para o ciclo de vida deste form efêmero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  async function handleCep(e: React.FocusEvent<HTMLInputElement>) {
    setCepLoading(true);
    const found = await lookupCep(e.target.value).finally(() =>
      setCepLoading(false)
    );
    if (!found || !formRef.current) return;
    const set = (name: string, value: string) => {
      const el = formRef.current!.elements.namedItem(name) as
        | HTMLInputElement
        | null;
      if (el && value) el.value = value;
    };
    set("street", found.street);
    set("district", found.district);
    set("city", found.city);
    set("state", found.state);
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-2xl border border-brand-300 bg-card p-5 dark:border-brand-600/40"
    >
      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-2.5 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Identificação" htmlFor="label">
          <Input
            id="label"
            name="label"
            defaultValue={defaults?.label ?? ""}
            placeholder="Casa, Trabalho…"
          />
        </Field>
        <Field label="Destinatário" htmlFor="recipient">
          <Input
            id="recipient"
            name="recipient"
            defaultValue={defaults?.recipient ?? ""}
            placeholder="Quem recebe"
            required
          />
        </Field>
        <Field
          label="CEP"
          htmlFor="zip"
          hint={cepLoading ? "Buscando endereço…" : undefined}
        >
          <Input
            id="zip"
            name="zip"
            defaultValue={defaults?.zip ?? ""}
            placeholder="00000-000"
            inputMode="numeric"
            onBlur={handleCep}
            required
          />
        </Field>
        <Field label="Rua" htmlFor="street">
          <Input
            id="street"
            name="street"
            defaultValue={defaults?.street ?? ""}
            placeholder="Av. Paulista"
            required
          />
        </Field>
        <Field label="Número" htmlFor="number">
          <Input
            id="number"
            name="number"
            defaultValue={defaults?.number ?? ""}
            placeholder="1000"
            required
          />
        </Field>
        <Field label="Complemento" htmlFor="complement">
          <Input
            id="complement"
            name="complement"
            defaultValue={defaults?.complement ?? ""}
            placeholder="Apto 12 (opcional)"
          />
        </Field>
        <Field label="Bairro" htmlFor="district">
          <Input
            id="district"
            name="district"
            defaultValue={defaults?.district ?? ""}
            placeholder="Centro"
            required
          />
        </Field>
        <Field label="Cidade" htmlFor="city">
          <Input
            id="city"
            name="city"
            defaultValue={defaults?.city ?? ""}
            placeholder="São Paulo"
            required
          />
        </Field>
        <Field label="Estado (UF)" htmlFor="state">
          <Input
            id="state"
            name="state"
            defaultValue={defaults?.state ?? ""}
            placeholder="SP"
            maxLength={2}
            required
          />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={defaults?.isDefault ?? false}
          className="size-4 rounded border-border accent-brand-600"
        />
        Definir como endereço padrão
      </label>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Check className="size-5" />
          )}
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          <X className="size-5" /> Cancelar
        </Button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(addresses.length === 0);
  const [pending, start] = React.useTransition();

  const onDelete = (a: Address) =>
    start(async () => {
      if (!confirm(`Excluir o endereço "${a.label}"?`)) return;
      const res = await deleteAddress(a.id);
      if (res.ok) {
        toast.success("Endereço excluído");
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível excluir.");
      }
    });

  const onSetDefault = (a: Address) =>
    start(async () => {
      const res = await setDefaultAddress(a.id);
      if (res.ok) {
        toast.success("Endereço padrão atualizado");
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível atualizar.");
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Endereços de entrega</h2>
        {!creating && (
          <Button
            variant="soft"
            size="sm"
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            <Plus className="size-4" /> Novo endereço
          </Button>
        )}
      </div>

      {creating && (
        <AddressForm
          action={createAddress}
          submitLabel="Salvar endereço"
          onDone={() => setCreating(false)}
        />
      )}

      {addresses.length === 0 && !creating ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
          <MapPin className="size-8 text-muted-foreground" />
          <p className="font-semibold">Nenhum endereço cadastrado</p>
          <p className="text-sm text-muted-foreground">
            Adicione um endereço para agilizar seus próximos pedidos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) =>
            editing === a.id ? (
              <AddressForm
                key={a.id}
                action={updateAddress.bind(null, a.id)}
                defaults={a}
                submitLabel="Salvar alterações"
                onDone={() => setEditing(null)}
              />
            ) : (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{a.label}</p>
                    {a.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
                        <Star className="size-3 fill-current" /> Padrão
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium">{a.recipient}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.street}, {a.number}
                    {a.complement ? ` - ${a.complement}` : ""} · {a.district},{" "}
                    {a.city}/{a.state} · {a.zip}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!a.isDefault && (
                    <button
                      onClick={() => onSetDefault(a)}
                      disabled={pending}
                      title="Definir como padrão"
                      className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-brand-600"
                    >
                      <Star className="size-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditing(a.id);
                      setCreating(false);
                    }}
                    disabled={pending}
                    title="Editar"
                    className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-brand-600"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => onDelete(a)}
                    disabled={pending}
                    title="Excluir"
                    className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
