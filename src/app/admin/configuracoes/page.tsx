import { getAdminSettingsView } from "@/server/queries/admin/access";
import { SettingsForm } from "@/components/admin/settings-form";
import { PharmaciesManager } from "@/components/admin/pharmacies-manager";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const { settings, paymentView, isGlobal, units, admins, currentUserId } = await getAdminSettingsView();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Configurações da loja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Frete, dados da farmácia e informações exibidas para os clientes.
        </p>
      </div>
      {isGlobal && (
        <PharmaciesManager
          units={units}
          admins={admins}
          currentUserId={currentUserId}
        />
      )}
      <SettingsForm settings={settings} payment={paymentView} />
    </div>
  );
}
