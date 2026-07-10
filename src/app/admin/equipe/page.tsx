import type { Metadata } from "next";
import { IdCard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireArea } from "@/lib/session";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { TeamManager, type StaffRow } from "@/components/admin/team-manager";

export const metadata: Metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const me = await requireArea("equipe");

  const [staff, pharmacies] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: [{ staffProfile: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        staffProfile: true,
        pharmacy: { select: { name: true } },
      },
    }),
    listPharmaciesSafe(),
  ]);

  const rows: StaffRow[] = staff.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    staffProfile: s.staffProfile,
    pharmacyName: s.pharmacy?.name ?? null,
    isSelf: s.id === me.id,
  }));

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

      <TeamManager staff={rows} pharmacies={pharmacies.map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}
