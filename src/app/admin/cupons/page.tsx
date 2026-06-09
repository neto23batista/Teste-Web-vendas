import Link from "next/link";
import { Plus, TicketPercent, Info } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBRL, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CouponRowActions } from "@/components/admin/coupon-row-actions";

export const metadata = { title: "Cupons & Promoções" };

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { active: "desc" } });
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Cupons & Promoções</h1>
          <p className="text-sm text-muted-foreground">
            Crie códigos de desconto que os clientes aplicam no checkout
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/admin/cupons/novo">
            <Plus className="size-5" /> Novo cupom
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-600/30 dark:bg-brand-600/10">
        <Info className="size-5 shrink-0 text-brand-600 dark:text-brand-400" />
        <p>
          Para criar <strong>ofertas em produtos</strong> (preço promocional),
          edite o produto na aba <strong>Produtos</strong>. Aqui você gerencia os{" "}
          <strong>cupons de desconto</strong> usados no carrinho.
        </p>
      </div>

      {coupons.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
            <TicketPercent className="size-7" />
          </span>
          <p className="font-semibold">Nenhum cupom criado ainda</p>
          <Button asChild variant="primary">
            <Link href="/admin/cupons/novo">Criar primeiro cupom</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-4 font-semibold">Código</th>
                  <th className="p-4 font-semibold">Desconto</th>
                  <th className="p-4 font-semibold">Mínimo</th>
                  <th className="p-4 font-semibold">Validade</th>
                  <th className="p-4 font-semibold">Usos</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.map((c) => {
                  const expired = c.expiresAt && c.expiresAt < now;
                  return (
                    <tr key={c.id} className="transition hover:bg-muted/30">
                      <td className="p-4">
                        <span className="inline-flex items-center gap-2 font-bold">
                          <TicketPercent className="size-4 text-brand-600 dark:text-brand-400" />
                          {c.code}
                        </span>
                      </td>
                      <td className="p-4 font-semibold">
                        {c.type === "PERCENT" ? `${c.value}%` : formatBRL(c.value)}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {c.minTotal > 0 ? formatBRL(c.minTotal) : "—"}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {c.expiresAt
                          ? new Date(c.expiresAt).toLocaleDateString("pt-BR")
                          : "Sem prazo"}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {c.usedCount}
                        {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                            expired
                              ? "bg-muted text-muted-foreground"
                              : c.active
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {expired ? "Expirado" : c.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="p-4">
                        <CouponRowActions id={c.id} active={c.active} code={c.code} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
