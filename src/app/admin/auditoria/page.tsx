import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { Prisma } from "@prisma/client";
import { getAdminScope } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "order.status": "Status de pedido",
  "order.transfer": "Transferência de pedido",
  "product.create": "Produto criado",
  "product.update": "Produto editado",
  "product.toggle": "Produto ativado/desativado",
  "product.delete": "Produto excluído",
  "stock.transfer": "Transferência de estoque",
  "admin.assign": "Admin atribuído",
  "admin.revoke": "Admin revogado",
  "pharmacy.create": "Unidade criada",
  "pharmacy.active": "Unidade ativada/desativada",
  "pharmacy.delete": "Unidade excluída",
  "pharmacy.shipping": "Frete da unidade",
  "pharmacy.regulatory": "Dados regulatórios",
  "prescription.status": "Receita validada",
  "coupon.create": "Cupom criado",
  "coupon.update": "Cupom editado",
  "coupon.toggle": "Cupom ativado/desativado",
  "coupon.delete": "Cupom excluído",
  "settings.update": "Configurações da loja",
  "review.approve": "Avaliação aprovada",
  "review.reject": "Avaliação recusada",
  "order.notes": "Observações do pedido",
};

export default async function AdminAuditPage() {
  // Trilha de auditoria é informação sensível entre unidades — só a matriz vê.
  const scope = await getAdminScope();
  if (!scope.isGlobal) redirect("/admin");

  // Resiliente SÓ ao caso pré-migration (tabela/coluna inexistente): P2021/
  // P2022 → lista vazia. Qualquer outro erro (banco fora do ar etc.) estoura
  // no error boundary do admin — não pode passar por "nenhuma ação registrada".
  const logs = await prisma.auditLog
    .findMany({ orderBy: { createdAt: "desc" }, take: 200 })
    .catch((err: unknown) => {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2021" || err.code === "P2022")
      ) {
        return [];
      }
      throw err;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ScrollText className="size-6 text-brand-600 dark:text-brand-400" />
        <div>
          <h1 className="text-2xl font-extrabold">Auditoria</h1>
          <p className="text-sm text-muted-foreground">
            Últimas 200 ações administrativas (quem fez o quê e quando).
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma ação registrada ainda.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-4 font-semibold">Quando</th>
                  <th className="p-4 font-semibold">Quem</th>
                  <th className="p-4 font-semibold">Ação</th>
                  <th className="p-4 font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top transition hover:bg-muted/30">
                    <td className="whitespace-nowrap p-4 text-muted-foreground">
                      {/* timeZone explícito: o servidor (Vercel) roda em UTC. */}
                      {new Date(log.createdAt).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </td>
                    <td className="p-4">{log.userEmail ?? "—"}</td>
                    <td className="p-4">
                      <span className="inline-flex rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                        {ACTION_LABEL[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {log.detail ?? "—"}
                      {log.entity && (
                        <span className="mt-0.5 block text-xs text-muted-foreground/60">
                          {log.entity}
                          {log.entityId ? ` · ${log.entityId}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
