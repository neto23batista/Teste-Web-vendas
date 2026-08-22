import type { Metadata } from "next";
import { ShieldCheck, Truck, Stethoscope, HeartPulse } from "lucide-react";
import { getSelectedPharmacyId } from "@/lib/pharmacy";
import {
  getRegulatoryInfo,
  getStoreSettings,
  missingRegulatoryDisclosure,
} from "@/lib/settings";

export const metadata: Metadata = {
  title: "Sobre a farmácia",
  description:
    "Conheça a FarmaVida: canal online de produtos de venda livre com dados operacionais transparentes.",
};

const values = [
  {
    icon: ShieldCheck,
    title: "Segurança",
    text: "Compra protegida e dados tratados conforme a política de privacidade.",
  },
  {
    icon: Truck,
    title: "Entrega",
    text: "Opções, valores e prazos são apresentados antes da confirmação do pedido.",
  },
  {
    icon: Stethoscope,
    title: "Transparência",
    text: "Canais e horários de atendimento são publicados pela operação.",
  },
  {
    icon: HeartPulse,
    title: "Venda livre",
    text: "O canal não vende medicamentos sujeitos a prescrição.",
  },
];

export default async function AboutPage() {
  const pharmacyId = await getSelectedPharmacyId();
  const [settings, regulatory] = await Promise.all([
    getStoreSettings(),
    getRegulatoryInfo(pharmacyId),
  ]);
  const missing = missingRegulatoryDisclosure({
    ...regulatory,
    address: settings.address,
    hours: settings.hours,
    phone: settings.phone,
  });

  return (
    <div className="container-page max-w-3xl space-y-8 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-extrabold md:text-4xl">Sobre a FarmaVida</h1>
        <p className="text-muted-foreground">
          A FarmaVida é um canal online de produtos de venda livre. Preços,
          condições de entrega, canais e horários de atendimento são informados
          pela operação antes da compra.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {values.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
              <Icon className="size-5" />
            </span>
            <p className="mt-3 font-bold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      {missing.length === 0 ? (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Razão social:</strong> {regulatory.legalName}</p>
          <p><strong className="text-foreground">CNPJ:</strong> {regulatory.cnpj}</p>
          <p><strong className="text-foreground">Endereço:</strong> {settings.address}</p>
          <p><strong className="text-foreground">Horário:</strong> {settings.hours}</p>
          <p><strong className="text-foreground">Telefone:</strong> {settings.phone}</p>
          <p><strong className="text-foreground">Farmacêutico responsável:</strong> {regulatory.pharmacistName} — {regulatory.pharmacistCrf}</p>
          <p><strong className="text-foreground">Licença sanitária:</strong> {regulatory.sanitaryLicense}</p>
          <p><strong className="text-foreground">AFE:</strong> {regulatory.afe}</p>
          {regulatory.ae && (
            <p><strong className="text-foreground">AE:</strong> {regulatory.ae}</p>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-bold">Ambiente ainda não liberado para operação comercial.</p>
          <p className="mt-1">
            Os dados regulatórios obrigatórios devem ser publicados no painel
            antes de aceitar vendas reais.
          </p>
        </section>
      )}
    </div>
  );
}
