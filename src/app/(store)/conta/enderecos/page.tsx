import type { Metadata } from "next";
import { getAddressBookView } from "@/server/queries/account";
import { AddressBook } from "@/components/store/account/address-book";

export const metadata: Metadata = { title: "Endereços" };

export default async function AddressesPage() {
  const addresses = await getAddressBookView();

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
