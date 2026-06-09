"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { resubmitPrescription } from "@/actions/checkout";
import { Button } from "@/components/ui/button";

export function PrescriptionResubmit({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await resubmitPrescription(orderNumber, fd);
      if (res.ok) {
        toast.success("Receita reenviada para validação");
        formRef.current?.reset();
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível enviar.");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="file"
        name="prescription"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-semibold file:text-white"
      />
      <Button type="submit" variant="primary" disabled={pending} className="shrink-0">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Reenviar
      </Button>
    </form>
  );
}
