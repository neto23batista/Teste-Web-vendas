"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteAccount } from "@/actions/account-privacy";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(deleteAccount, undefined);
  const [confirm, setConfirm] = React.useState("");
  const matches = confirm.trim().toLowerCase() === email.toLowerCase();

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-2.5 text-sm font-medium text-danger-500">
          <AlertTriangle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <Field
        label={`Para confirmar, digite o e-mail da conta (${email})`}
        htmlFor="confirmEmail"
        hint="Esta ação é permanente e não pode ser desfeita."
      >
        <Input
          id="confirmEmail"
          name="confirmEmail"
          type="email"
          autoComplete="off"
          placeholder="seu@email.com"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <Button
        type="submit"
        variant="danger"
        disabled={!matches || pending}
        className="w-full sm:w-auto"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        Excluir minha conta definitivamente
      </Button>
    </form>
  );
}
