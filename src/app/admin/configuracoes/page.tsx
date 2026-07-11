import { getStoreSettings, getPaymentSettings } from "@/lib/settings";
import { getAdminScope, getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/admin/settings-form";
import { PharmaciesManager } from "@/components/admin/pharmacies-manager";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const [settings, payment, scope, user] = await Promise.all([
    getStoreSettings(),
    getPaymentSettings(),
    getAdminScope(),
    getCurrentUser(),
  ]);
  // O token nunca vai para o cliente — só se existe e se está em sandbox.
  const paymentView = {
    hasToken: payment.pagbankToken.length > 0,
    sandbox: payment.pagbankSandbox,
  };

  // Gestão de unidades só para a matriz (escopo global).
  const [units, admins] = scope.isGlobal
    ? await Promise.all([
        prisma.pharmacy.findMany({
          orderBy: [{ type: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            type: true,
            active: true,
            city: true,
            state: true,
            shippingFlat: true,
            shippingFreeMin: true,
            cnpj: true,
            pharmacistName: true,
            pharmacistCrf: true,
            cepRanges: { orderBy: { start: "asc" }, select: { id: true, start: true, end: true } },
          },
        }),
        prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true, name: true, email: true, pharmacyId: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Configurações da loja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Frete, dados da farmácia e informações exibidas para os clientes.
        </p>
      </div>
      {scope.isGlobal && (
        <PharmaciesManager
          units={units}
          admins={admins}
          currentUserId={user?.id ?? ""}
        />
      )}
      <SettingsForm settings={settings} payment={paymentView} />
    </div>
  );
}
