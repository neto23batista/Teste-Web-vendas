import type { Metadata } from "next";
import { IdCard } from "lucide-react";
import { getAdminTeamView } from "@/server/queries/admin/access";
import { TeamManager } from "@/components/admin/team/team-manager";

export const metadata: Metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const { rows, pharmacies } = await getAdminTeamView();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <IdCard className="size-6 text-brand-600 dark:text-brand-400" /> Equipe
        </h1>
        <p className="text-sm text-muted-foreground">
          Cada membro entra com o próprio login e só enxerga as áreas do seu perfil.
          Dinheiro, equipe e configurações ficam com o Dono / Gerente.
        </p>
      </div>

      <TeamManager staff={rows} pharmacies={pharmacies} />
    </div>
  );
}
