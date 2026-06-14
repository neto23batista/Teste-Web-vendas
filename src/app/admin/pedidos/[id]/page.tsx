import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, MapPin, CreditCard, FileText } from "lucide-react";
import { getAdminOrder } from "@/lib/admin";
import { getStoreSettings } from "@/lib/settings";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { formatBRL } from "@/lib/utils";
import { StatusBadge } from "@/components/store/order-status";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { OrderTransfer } from "@/components/admin/order-transfer";
import { PrescriptionReview } from "@/components/admin/prescription-review";
import { ProductImage } from "@/components/store/product-image";
import { PrintButton } from "@/components/admin/print-button";
import { OrderNotes } from "@/components/admin/order-notes";

export const metadata = { title: "Pedido" };

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, store, pharmacies] = await Promise.all([
    getAdminOrder(id),
    getStoreSettings(),
    listPharmaciesSafe(),
  ]);
  if (!order) notFound();

  // Transferência: só faz sentido enquanto a unidade ainda trata o pedido.
  const canTransfer =
    order.status === "PENDING" ||
    order.status === "PAID" ||
    order.status === "PREPARING";
  const transferTargets = pharmacies
    .filter((p) => p.id !== order.pharmacyId)
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      {/* Cabeçalho do recibo — aparece somente na impressão */}
      <div className="hidden print:block">
        <p className="text-xl font-extrabold">FarmaVida</p>
        <p className="text-xs text-muted-foreground">
          {[
            store.cnpj && `CNPJ ${store.cnpj}`,
            store.address,
            store.phone,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {order.notes && (
          <p className="mt-2 text-sm">
            <strong>Observações:</strong> {order.notes}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/pedidos"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground print:hidden"
          >
            <ArrowLeft className="size-4" /> Pedidos
          </Link>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-extrabold">
            {order.number} <StatusBadge status={order.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Itens */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-bold">Itens do pedido</h2>
          <div className="divide-y divide-border">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 py-3">
                <ProductImage emoji={it.product?.emoji} name={it.name} className="size-12 rounded-xl" emojiClassName="text-xl" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{it.name}</p>
                  <p className="text-xs text-muted-foreground">{it.qty} × {formatBRL(it.price)}</p>
                </div>
                <p className="font-bold">{formatBRL(it.price * it.qty)}</p>
              </div>
            ))}
          </div>
          <dl className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatBRL(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success-600">
                <dt>Desconto {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                <dd>- {formatBRL(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Frete</dt>
              <dd>{order.shipping === 0 ? "Grátis" : formatBRL(order.shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold">
              <dt>Total</dt>
              <dd className="text-brand-700 dark:text-brand-400">{formatBRL(order.total)}</dd>
            </div>
          </dl>
        </section>

        {/* Lateral */}
        <aside className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 print:hidden">
            <h2 className="font-bold">Atualizar status</h2>
            <OrderStatusControl id={order.id} current={order.status} />
          </div>

          {pharmacies.length > 1 &&
            (canTransfer && transferTargets.length > 0 ? (
              <OrderTransfer
                orderId={order.id}
                currentUnitName={order.pharmacy?.name ?? "—"}
                targetUnits={transferTargets}
              />
            ) : (
              <div className="space-y-1 rounded-2xl border border-border bg-card p-5 text-sm print:hidden">
                <p className="font-bold">Unidade</p>
                <p className="text-muted-foreground">{order.pharmacy?.name ?? "—"}</p>
              </div>
            ))}

          <OrderNotes orderId={order.id} initialNotes={order.notes} />

          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <User className="size-4 text-brand-600 dark:text-brand-400" /> Cliente
            </p>
            <p>{order.user.name}</p>
            <p className="text-muted-foreground">{order.user.email}</p>
            {order.user.phone && <p className="text-muted-foreground">{order.user.phone}</p>}
          </div>

          {order.address && (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
              <p className="flex items-center gap-2 font-bold">
                <MapPin className="size-4 text-brand-600 dark:text-brand-400" /> Entrega
              </p>
              <p className="text-muted-foreground">
                {order.address.street}, {order.address.number}
                {order.address.complement ? ` - ${order.address.complement}` : ""}
                <br />
                {order.address.district}, {order.address.city}/{order.address.state}
                <br />
                CEP {order.address.zip}
              </p>
            </div>
          )}

          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <CreditCard className="size-4 text-brand-600 dark:text-brand-400" /> Pagamento
            </p>
            <p className="text-muted-foreground">
              Método: <strong className="text-foreground">{order.paymentMethod ?? "—"}</strong>
              <br />
              Status: {order.payment?.status ?? "—"}
            </p>
          </div>

          {order.requiresPrescription && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm print:hidden">
              <p className="flex items-center gap-2 font-bold">
                <FileText className="size-4 text-brand-600 dark:text-brand-400" /> Receitas
              </p>
              {order.prescriptions.length === 0 ? (
                <p className="text-muted-foreground">
                  Pedido exige receita, mas nenhuma foi anexada.
                </p>
              ) : (
                order.prescriptions.map((p) => (
                  <div key={p.id} className="space-y-2 border-t border-border pt-3 first:border-0 first:pt-0">
                    <Link
                      href={`/api/prescriptions/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Ver receita enviada
                    </Link>
                    <PrescriptionReview id={p.id} status={p.status} />
                  </div>
                ))
              )}
              <p className="text-xs text-muted-foreground">
                O pedido só pode avançar para preparo/envio após a aprovação da receita.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
