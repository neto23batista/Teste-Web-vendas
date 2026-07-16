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

function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Testa a conexão com o Stripe usando a secret key JÁ SALVA (não cria nada).
 * Retorna uma mensagem legível dizendo se autentica e em qual ambiente — assim o
 * dono confirma a config antes de vender de verdade, em vez de descobrir no
 * checkout. Restrito ao DONO: a área "configuracoes" é exclusiva dele e a chave
 * de pagamento é o segredo mais sensível da loja.
 */
export async function testStripeConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  await assertOwner();
  const ping = await stripePing();
  if (!ping.configured) {
    return {
      ok: false,
      message: "Nenhuma secret key do Stripe salva. Cole a chave e salve antes de testar.",
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
  await assertOwner();

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

  // Chaves do Stripe: um campo com "•••" (máscara) ou vazio significa "não mexer"
  // — o valor real nunca chega ao cliente, então não sobrescrevemos com a máscara.
  const isMask = (v: string) => v === "" || /^•+$/.test(v);
  const stripeSecretRaw = str(formData, "stripeSecretKey");
  const stripeWebhookRaw = str(formData, "stripeWebhookSecret");

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
    // Só entram na lista de upserts/deletes se o admin realmente digitou algo.
    ...(isMask(stripeSecretRaw)
      ? []
      : [
          { key: "stripe.secretKey", value: stripeSecretRaw },
          // Trocar a chave pode ser trocar de CONTA Stripe: zera o status do Pix
          // (value "" = delete → getPaymentSettings volta a FALSE). Só o "Testar
          // conexão" reconfirma a capability da conta nova. Sem isso, a flag ficava
          // "velha" e o checkout oferecia um Pix que falhava e cancelava o pedido.
          { key: "stripe.pixEnabled", value: "" },
        ]),
    ...(isMask(stripeWebhookRaw)
      ? []
      : [{ key: "stripe.webhookSecret", value: stripeWebhookRaw }]),
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
