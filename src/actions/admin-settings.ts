"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export type SettingsFormState =
  | { error?: string; success?: boolean }
  | undefined;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function saveSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireAdmin();

  const flatRaw = str(formData, "shippingFlat");
  const freeMinRaw = str(formData, "freeShippingMin");
  const flat = parseMoney(flatRaw);
  const freeMin = parseMoney(freeMinRaw);
  if (flatRaw && flat === null) {
    return { error: "Taxa de entrega inválida. Use números, ex.: 14,90." };
  }
  if (freeMinRaw && freeMin === null) {
    return { error: "Valor de frete grátis inválido. Use números, ex.: 150." };
  }

  // Valor vazio remove a configuração (volta ao padrão do sistema).
  const entries: { key: string; value: string }[] = [
    { key: "shipping.flat", value: flat === null ? "" : String(flat) },
    { key: "shipping.freeMin", value: freeMin === null ? "" : String(freeMin) },
    { key: "store.cnpj", value: str(formData, "cnpj") },
    { key: "store.phone", value: str(formData, "phone") },
    { key: "store.whatsapp", value: str(formData, "whatsapp") },
    { key: "store.email", value: str(formData, "email") },
    { key: "store.address", value: str(formData, "address") },
    { key: "store.hours", value: str(formData, "hours") },
    { key: "store.pharmacistName", value: str(formData, "pharmacistName") },
    { key: "store.pharmacistCrf", value: str(formData, "pharmacistCrf") },
  ];

  await prisma.$transaction(
    entries.map(({ key, value }) =>
      value
        ? prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        : prisma.setting.deleteMany({ where: { key } })
    )
  );

  await logAudit({
    action: "settings.update",
    entity: "Setting",
    detail: "Atualizou as configurações da loja (frete/contato/regulatório)",
  });
  revalidateTag("settings", "max");
  // Frete e rodapé aparecem em toda a loja.
  revalidatePath("/", "layout");
  return { success: true };
}
