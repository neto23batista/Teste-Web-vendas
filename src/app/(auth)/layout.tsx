import Link from "next/link";
import { Plus, ShieldCheck, Truck, Stethoscope, ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Painel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden gradient-brand p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-20 top-10 size-80 rounded-full bg-white/10 blur-3xl" />
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-white/15 glass">
            <Plus className="size-5" strokeWidth={3} />
          </span>
          <span className="text-xl font-extrabold">FarmaVida</span>
        </Link>

        <div className="relative space-y-6">
          <h1 className="text-balance text-4xl font-extrabold leading-tight">
            Sua farmácia premium, do jeito que você merece.
          </h1>
          <ul className="space-y-3 text-white/85">
            {[
              { icon: Truck, t: "Entrega expressa com rastreio em tempo real" },
              { icon: ShieldCheck, t: "Pagamento seguro e dados protegidos (LGPD)" },
              { icon: Stethoscope, t: "Atendimento e validação farmacêutica" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-white/15 glass">
                  <Icon className="size-4" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/70">
          © {new Date().getFullYear()} FarmaVida
        </p>
      </div>

      {/* Formulário */}
      <div className="flex flex-col">
        <div className="p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Voltar à loja
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 pb-16">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
