"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertOwner } from "@/lib/session";
import { stripePing } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";

export type SettingsFormState =
  | { error?: string; success?: boolean }
  | undefined;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function assertMatrixOwner() {
  const owner = await assertOwner();
  if (owner.pharmacyType !== "MATRIZ") {
    throw new Error("Apenas o dono/gerente da matriz pode alterar configurações globais.");
  }
  return owner;
}

function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Testa a conexão com o Stripe usando a secret key do ambiente (não cria nada).
 * Retorna uma mensagem legível dizendo se autentica e em qual ambiente — assim o
 * dono confirma a config antes de vender de verdade, em vez de descobrir no
 * checkout. Restrito ao DONO: a área "configuracoes" é exclusiva dele e a chave
 * de pagamento é o segredo mais sensível da loja.
 */
export async function testStripeConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  await assertMatrixOwner();
  const ping = await stripePing();
  if (!ping.configured) {
    return {
      ok: false,
      message: "STRIPE_SECRET_KEY não está configurada no ambiente de execução.",
    };
  }
  const env = ping.live ? "produção (live)" : "teste (test)";
  if (!ping.ok) {
    return {
      ok: false,
      message: `Chave recusada (HTTP ${ping.status || "sem resposta"}) em ${env}. Confira a secret key do Stripe.`,
    };
  }

  // Guarda o status do Pix: o checkout consulta isto (barato) em vez de bater na
  // API do Stripe a cada renderização. É aqui que o PIX "reaparece" na loja assim
  // que o Stripe aprova a habilitação — basta o dono clicar em Testar conexão.
  await prisma.setting.upsert({
    where: { key: "stripe.pixEnabled" },
    update: { value: ping.pix ? "1" : "" },
    create: { key: "stripe.pixEnabled", value: ping.pix ? "1" : "" },
  });
  revalidateTag("settings", "max");
  revalidatePath("/checkout");

  const pixMsg = ping.pix
    ? "Pix ATIVO — já aparece no checkout."
    : "Pix ainda NÃO habilitado pelo Stripe (é liberado por convite) — o checkout mostra só cartão e dinheiro.";
  return { ok: true, message: `Conexão OK — chave válida em ${env}. ${pixMsg}` };
}

export async function saveSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  // Área "configuracoes" é exclusiva do DONO. O middleware só protege a PÁGINA;
  // sem este portão, qualquer staff poderia invocar a action e sobrescrever a
  // secret key/webhook do Stripe (desviando os pagamentos da loja).
  await assertMatrixOwner();

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

  // Política de troca/devolução: vazio = mantém o texto padrão (CDC).
  const returnPolicyRaw = String(formData.get("returnPolicy") ?? "").trim();

  // Valor vazio remove a configuração (volta ao padrão do sistema).
  const entries: { key: string; value: string }[] = [
    ...shipEntries,
    { key: "store.returnPolicy", value: returnPolicyRaw },
    { key: "store.legalName", value: str(formData, "legalName") },
    { key: "store.cnpj", value: str(formData, "cnpj") },
    { key: "store.phone", value: str(formData, "phone") },
    { key: "store.whatsapp", value: str(formData, "whatsapp") },
    { key: "store.email", value: str(formData, "email") },
    { key: "store.address", value: str(formData, "address") },
    { key: "store.hours", value: str(formData, "hours") },
    { key: "store.pharmacistName", value: str(formData, "pharmacistName") },
    { key: "store.pharmacistCrf", value: str(formData, "pharmacistCrf") },
    { key: "store.sanitaryLicense", value: str(formData, "sanitaryLicense") },
    { key: "store.afe", value: str(formData, "afe") },
    { key: "store.ae", value: str(formData, "ae") },
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
