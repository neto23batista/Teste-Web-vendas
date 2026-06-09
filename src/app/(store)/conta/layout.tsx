import { getCurrentUser } from "@/lib/session";
import { AccountNav } from "@/components/account/account-nav";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="container-page py-6 md:py-8">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Minha conta</p>
        <h1 className="text-2xl font-extrabold md:text-3xl">
          Olá, {user?.name?.split(" ")[0] ?? "cliente"} 👋
        </h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
