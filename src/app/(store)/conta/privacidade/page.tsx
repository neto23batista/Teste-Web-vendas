import type { Metadata } from "next";
import Link from "next/link";
import { Download, ShieldCheck, AlertTriangle, FileText } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { DeleteAccountForm } from "@/components/account/delete-account-form";

export const metadata: Metadata = { title: "Privacidade" };

export default async function PrivacyAccountPage() {
  const user = await requireUserPage("/conta/privacidade");
  const legacyDocuments = await prisma.prescription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      order: { select: { number: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Privacidade e dados (LGPD)</h2>
        <p className="text-sm text-muted-foreground">
          Seus direitos sobre os dados pessoais que a farmácia guarda — conforme
          a <Link href="/privacidade" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">Política de Privacidade</Link>.
        </p>
      </div>

      {/* Exportar dados */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-5 text-brand-600 dark:text-brand-400" />
          Baixar meus dados
        </h3>
        <p className="text-sm text-muted-foreground">
          Receba um arquivo com perfil, endereços, pedidos e pagamentos,
          carrinho, assinaturas, fidelidade, avaliações, documentos legados,
          favoritos, aceites e eventos de segurança associados à conta.
        </p>
        <Button asChild variant="outline">
          <a href="/api/account/export" download>
            <Download className="size-4" /> Baixar meus dados (JSON)
          </a>
        </Button>
      </section>

      {legacyDocuments.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <FileText className="size-5 text-brand-600 dark:text-brand-400" />
            Documentos legados
          </h3>
          <p className="text-sm text-muted-foreground">
            A loja não recebe novas receitas. Estes arquivos históricos ficam em
            armazenamento privado e cada download exige sua sessão autenticada.
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {legacyDocuments.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
              >
                <span>
                  {document.order?.number
                    ? `Pedido ${document.order.number}`
                    : "Documento sem pedido"}{" "}
                  · {document.createdAt.toLocaleDateString("pt-BR")} · {document.status}
                </span>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/prescriptions/${document.id}`} download>
                    <Download className="size-4" /> Baixar
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Excluir conta */}
      <section className="space-y-3 rounded-2xl border border-danger-500/30 bg-danger-500/5 p-5">
        <h3 className="flex items-center gap-2 font-bold text-danger-500">
          <AlertTriangle className="size-5" />
          Excluir minha conta
        </h3>
        <p className="text-sm text-muted-foreground">
          Apaga dados que não precisam ser conservados (endereços, favoritos,
          documentos legados, avaliações e fidelidade) e anonimiza a conta de
          forma <strong>permanente</strong>. Pedidos, pagamentos e evidências
          obrigatórias podem permanecer com acesso restrito durante os prazos
          fiscais, regulatórios e de defesa aplicáveis.
        </p>
        <DeleteAccountForm email={user.email ?? ""} />
      </section>
    </div>
  );
}
