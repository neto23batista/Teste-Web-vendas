import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AddressBook } from "@/components/account/address-book";

export const metadata: Metadata = { title: "Endereços" };

export default async function AddressesPage() {
  const user = await requireUser();
  const rows = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const addresses = rows.map((a) => ({
    id: a.id,
    label: a.label,
    recipient: a.recipient,
    zip: a.zip,
    street: a.street,
    number: a.number,
    complement: a.complement,
    district: a.district,
    city: a.city,
    state: a.state,
    isDefault: a.isDefault,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Meus endereços</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie onde você recebe seus pedidos.
        </p>
      </div>
      <AddressBook addresses={addresses} />
    </div>
  );
}
