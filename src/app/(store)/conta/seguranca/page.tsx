import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUserPage } from "@/lib/auth/session";
import { isLiveProduction } from "@/lib/env";
import { PasswordForm } from "@/components/account/password-form";
import { MfaSetup } from "@/components/account/mfa-setup";

export const metadata: Metadata = { title: "Segurança da conta" };

export default async function AccountSecurityPage() {
  const session = await requireUserPage("/conta/seguranca");
  const current = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true, mfaEnabledAt: true },
  });
  if (!current) return null;

  const liveProduction = isLiveProduction();
  const isAdmin = current.role === "ADMIN";
  const mfaEnabled = Boolean(current.mfaEnabledAt);

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
