import type { Metadata } from "next";
import { ShieldCheck, Truck, Stethoscope, HeartPulse } from "lucide-react";

export const metadata: Metadata = {
  title: "Sobre a farmácia",
  description: "Conheça a FarmaVida: farmácia online segura, com entrega rápida e atendimento farmacêutico.",
};

const values = [
  { icon: ShieldCheck, title: "Segurança", text: "Compra protegida e dados tratados conforme a LGPD." },
  { icon: Truck, title: "Agilidade", text: "Entrega rápida com rastreamento em tempo real." },
  { icon: Stethoscope, title: "Cuidado", text: "Atendimento e validação farmacêutica de verdade." },
  { icon: HeartPulse, title: "Confiança", text: "Produtos com procedência e qualidade garantidas." },
];

export default function AboutPage() {
  return (
    <div className="container-page max-w-3xl space-y-8 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-extrabold md:text-4xl">Sobre a FarmaVida</h1>
        <p className="text-muted-foreground">
          A FarmaVida nasceu para tornar o cuidado com a saúde simples, seguro e
          acessível. Unimos a comodidade de um app moderno à seriedade de uma
          farmácia: catálogo completo, preço justo, entrega rápida e suporte
          farmacêutico quando você precisar.
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

      <section className="space-y-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Razão social:</strong> FarmaVida Farmácia Ltda.</p>
        <p><strong className="text-foreground">CNPJ:</strong> 12.345.678/0001-90</p>
        <p><strong className="text-foreground">Farmacêutico responsável:</strong> Dra. Ana Souza — CRF/SP 123456</p>
      </section>
    </div>
  );
}
