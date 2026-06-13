import type { Metadata } from "next";
import Link from "next/link";
import { Download, ShieldCheck, AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { DeleteAccountForm } from "@/components/account/delete-account-form";

export const metadata: Metadata = { title: "Privacidade" };

export default async function PrivacyAccountPage() {
  const user = await requireUser();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Privacidade e dados (LGPD)</h2>
        <p className="text-sm text-muted-foreground">
          Seus direitos sobre os dados pessoais que a farmácia guarda — conforme
          a <Link href="/privacidade" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">Política de Privacidade</Link>.
        </p>
      </div>

      {/* Exportar dados */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-5 text-brand-600 dark:text-brand-400" />
          Baixar meus dados
        </h3>
        <p className="text-sm text-muted-foreground">
          Receba um arquivo com tudo que está associado à sua conta: perfil,
          endereços, pedidos, pontos de fidelidade, avaliações, receitas e
          favoritos (portabilidade — art. 18 da LGPD).
        </p>
        <Button asChild variant="outline">
          <a href="/api/account/export" download>
            <Download className="size-4" /> Baixar meus dados (JSON)
          </a>
        </Button>
      </section>

      {/* Excluir conta */}
      <section className="space-y-3 rounded-2xl border border-danger-500/30 bg-danger-500/5 p-5">
        <h3 className="flex items-center gap-2 font-bold text-danger-500">
          <AlertTriangle className="size-5" />
          Excluir minha conta
        </h3>
        <p className="text-sm text-muted-foreground">
          Apaga seus dados pessoais (endereços, favoritos, receitas, avaliações
          e fidelidade) e anonimiza a conta de forma{" "}
          <strong>permanente</strong>. Registros de pedidos são mantidos sem
          vínculo com você, por obrigação fiscal.
        </p>
        <DeleteAccountForm email={user.email ?? ""} />
      </section>
    </div>
  );
}
