import Link from "next/link";
import { Brand } from "@/components/store/brand";
import { getStoreSettings, getRegulatoryInfo } from "@/lib/settings";
import { getSelectedPharmacyId } from "@/lib/pharmacy";
import {
  ShieldCheck,
  Truck,
  CreditCard,
  Stethoscope,
  Phone,
  MessageCircle,
  Mail,
  Clock,
  MapPin,
} from "lucide-react";

const trust = [
  { icon: ShieldCheck, label: "Compra segura" },
  { icon: Stethoscope, label: "Receitas protegidas" },
  { icon: CreditCard, label: "Pagamento criptografado" },
  { icon: Truck, label: "Entrega rápida" },
];

export async function SiteFooter() {
  // Contato vem do global; os dados regulatórios (CNPJ/RT) são da unidade
  // selecionada pelo cliente, com fallback ao global de /admin/configuracoes.
  const pharmacyId = await getSelectedPharmacyId();
  const [s, reg] = await Promise.all([
    getStoreSettings(),
    getRegulatoryInfo(pharmacyId),
  ]);
  const contact = [
    { icon: Phone, value: s.phone },
    { icon: MessageCircle, value: s.whatsapp ? `WhatsApp ${s.whatsapp}` : "" },
    { icon: Mail, value: s.email },
    { icon: Clock, value: s.hours },
    { icon: MapPin, value: s.address },
  ].filter((c) => c.value);

  return (
    <footer className="mt-16 border-t border-border bg-card pb-24 md:pb-0">
      <div
        className={
          contact.length > 0
            ? "container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]"
            : "container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]"
        }
      >
        <div className="space-y-4">
          <Brand />
          <p className="max-w-sm text-sm text-muted-foreground">
            Farmácia online com operação segura, privacidade LGPD e suporte
            farmacêutico de verdade.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {trust.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
              >
                <Icon className="size-4 text-brand-600 dark:text-brand-400" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <nav className="space-y-3 text-sm">
          <p className="font-semibold">Loja</p>
          {[
            ["Catálogo", "/catalogo"],
            ["Ofertas", "/catalogo?ofertas=1"],
            ["Minha conta", "/conta"],
            ["Sacola", "/sacola"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="block text-muted-foreground transition hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>

        <nav className="space-y-3 text-sm">
          <p className="font-semibold">Institucional</p>
          {[
            ["Sobre a farmácia", "/sobre"],
            ["Trocas e devoluções", "/trocas-e-devolucoes"],
            ["Privacidade (LGPD)", "/privacidade"],
            ["Termos de uso", "/termos"],
            ["Painel administrativo", "/admin"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="block text-muted-foreground transition hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>

        {contact.length > 0 && (
          <div className="space-y-3 text-sm">
            <p className="font-semibold">Atendimento</p>
            {contact.map(({ icon: Icon, value }) => (
              <p
                key={value}
                className="flex items-start gap-2 text-muted-foreground"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                {value}
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground md:flex-row">
          <span>
            © {new Date().getFullYear()} FarmaVida — ambiente protegido para
            dados pessoais e receitas.
          </span>
          <span className="inline-flex items-center gap-1.5 text-center">
            <Stethoscope className="size-3.5 text-brand-600 dark:text-brand-400" />
            Farmacêutico(a) responsável: {reg.pharmacistName} ·{" "}
            {reg.pharmacistCrf}
            {reg.cnpj && ` · CNPJ ${reg.cnpj}`}
          </span>
        </div>
      </div>
    </footer>
  );
}
