import { getStoreSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const settings = await getStoreSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Configurações da loja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Frete, dados da farmácia e informações exibidas para os clientes.
        </p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
