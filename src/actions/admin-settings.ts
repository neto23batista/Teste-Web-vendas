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

  // Parâmetros de frete (todos numéricos; vazio = volta ao padrão do sistema).
  const shipFields: { form: string; key: string; label: string }[] = [
    { form: "freeShippingMin", key: "shipping.freeMin", label: "Frete grátis a partir de" },
    { form: "freeRadiusKm", key: "shipping.freeRadiusKm", label: "Raio grátis (km)" },
    { form: "perKm", key: "shipping.perKm", label: "Custo por km" },
    { form: "expressFlat", key: "shipping.expressFlat", label: "Taxa da Entrega Rápida" },
    { form: "defaultKm", key: "shipping.defaultKm", label: "Distância padrão (km)" },
  ];
  const shipEntries: { key: string; value: string }[] = [];
  for (const f of shipFields) {
    const raw = str(formData, f.form);
    const n = parseMoney(raw);
    if (raw && n === null) {
      return { error: `${f.label} inválido. Use números, ex.: 4 ou 1,00.` };
    }
    shipEntries.push({ key: f.key, value: n === null ? "" : String(n) });
  }

  // Token PagBank: o campo enviar "•••" (máscara) significa "não mexer" — o
  // valor real nunca chega ao cliente, então não sobrescrevemos com a máscara.
  const pagbankTokenRaw = str(formData, "pagbankToken");
  const keepPagbankToken = pagbankTokenRaw === "" || /^•+$/.test(pagbankTokenRaw);

  // Política de troca/devolução: vazio = mantém o texto padrão (CDC).
  const returnPolicyRaw = String(formData.get("returnPolicy") ?? "").trim();

  // Valor vazio remove a configuração (volta ao padrão do sistema).
  const entries: { key: string; value: string }[] = [
    ...shipEntries,
    { key: "store.returnPolicy", value: returnPolicyRaw },
    { key: "store.cnpj", value: str(formData, "cnpj") },
    { key: "store.phone", value: str(formData, "phone") },
    { key: "store.whatsapp", value: str(formData, "whatsapp") },
    { key: "store.email", value: str(formData, "email") },
    { key: "store.address", value: str(formData, "address") },
    { key: "store.hours", value: str(formData, "hours") },
    { key: "store.pharmacistName", value: str(formData, "pharmacistName") },
    { key: "store.pharmacistCrf", value: str(formData, "pharmacistCrf") },
    { key: "pagbank.sandbox", value: formData.get("pagbankSandbox") ? "1" : "0" },
    // Só entra na lista de upserts/deletes se o admin realmente digitou algo.
    ...(keepPagbankToken
      ? []
      : [{ key: "pagbank.token", value: pagbankTokenRaw }]),
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
