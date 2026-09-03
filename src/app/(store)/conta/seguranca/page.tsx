import type { Metadata } from "next";
import { getAccountSecurityView } from "@/server/queries/account";
import { PasswordForm } from "@/components/store/account/password-form";
import { MfaSetup } from "@/components/store/account/mfa-setup";

export const metadata: Metadata = { title: "Segurança da conta" };

export default async function AccountSecurityPage() {
  const security = await getAccountSecurityView();
  if (!security) return null;
  const { isAdmin, mfaEnabled, liveProduction } = security;

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">Senha e sessões</h2>
          <p className="text-sm text-muted-foreground">
            Ao trocar a senha, todas as sessões anteriores são revogadas.
          </p>
        </div>
        <PasswordForm />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">Autenticação multifator</h2>
          <p className="text-sm text-muted-foreground">
            Uma segunda confirmação protege operações administrativas mesmo
            se a senha for exposta.
          </p>
        </div>
        {isAdmin ? (
          <MfaSetup
            enabled={mfaEnabled}
            required={liveProduction && !mfaEnabled}
            liveProduction={liveProduction}
          />
        ) : (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            O MFA TOTP está disponível para contas administrativas. Sua conta de
            cliente continua protegida por senha forte e sessão revogável.
          </p>
        )}
      </section>
    </div>
  );
}
