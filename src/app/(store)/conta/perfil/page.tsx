import type { Metadata } from "next";
import { MapPin, Star } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getUserWithAddresses } from "@/lib/account";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata: Metadata = { title: "Meus dados" };

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await getUserWithAddresses(session.id);
  if (!user) return null;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Dados pessoais</h2>
        <ProfileForm
          defaultValues={{
            name: user.name,
            email: user.email,
            cpf: user.cpf ?? "",
            phone: user.phone ?? "",
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Endereços</h2>
        {user.addresses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum endereço salvo. Você poderá adicionar um no checkout.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {user.addresses.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 font-bold">
                    <MapPin className="size-4 text-brand-600 dark:text-brand-400" />
                    {a.label}
                  </p>
                  {a.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                      <Star className="size-3" /> Padrão
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {a.recipient}
                  <br />
                  {a.street}, {a.number}
                  {a.complement ? ` - ${a.complement}` : ""}
                  <br />
                  {a.district}, {a.city}/{a.state} · CEP {a.zip}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
