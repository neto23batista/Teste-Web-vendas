import Link from "next/link";
import { Brand } from "@/components/store/brand";
import { ShieldCheck, Truck, CreditCard, Stethoscope } from "lucide-react";

const trust = [
  { icon: ShieldCheck, label: "Compra segura" },
  { icon: Stethoscope, label: "Receitas protegidas" },
  { icon: CreditCard, label: "Pagamento criptografado" },
  { icon: Truck, label: "Entrega rápida" },
];

// Dados regulatórios da farmácia (exigência ANVISA: responsável técnico visível).
// Configure no .env — exibimos placeholders até lá.
const PHARMACIST =
  process.env.NEXT_PUBLIC_PHARMACIST_NAME || "Responsável Técnico(a) a definir";
const CRF = process.env.NEXT_PUBLIC_PHARMACIST_CRF || "CRF/UF 00000";
const CNPJ = process.env.NEXT_PUBLIC_CNPJ || "";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
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
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground md:flex-row">
          <span>
            © {new Date().getFullYear()} FarmaVida — ambiente protegido para
            dados pessoais e receitas.
          </span>
          <span className="inline-flex items-center gap-1.5 text-center">
            <Stethoscope className="size-3.5 text-brand-600 dark:text-brand-400" />
            Farmacêutico(a) responsável: {PHARMACIST} · {CRF}
            {CNPJ && ` · CNPJ ${CNPJ}`}
          </span>
        </div>
      </div>
    </footer>
  );
}
