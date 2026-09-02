import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, MapPin, CreditCard } from "lucide-react";
import { getAdminOrder } from "@/lib/admin";
import { getStoreSettings } from "@/lib/settings";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { getCurrentUser } from "@/lib/auth/session";
import { isOwnerProfile } from "@/lib/auth/permissions";
import { formatBRL } from "@/lib/utils";
import { StatusBadge } from "@/components/store/order-status";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { OrderTransfer } from "@/components/admin/order-transfer";
import { ProductImage } from "@/components/store/product-image";
import { PrintButton } from "@/components/admin/print-button";
import { OrderNotes } from "@/components/admin/order-notes";
import { OrderArchiveButton } from "@/components/admin/order-archive-button";
import { allowedOrderTransitions } from "@/lib/orders";
import { RetryRefundButton } from "@/components/admin/retry-refund-button";
import { moneyToNumber } from "@/lib/money";
import { ReturnManagement } from "@/components/admin/return-management";

export const metadata = { title: "Pedido" };

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, store, pharmacies, user] = await Promise.all([
    getAdminOrder(id),
    getStoreSettings(),
    listPharmaciesSafe(),
    getCurrentUser(),
  ]);
  if (!order) notFound();
  // Arquivar/restaurar o histórico é ação do dono/gerente (OWNER).
  const isOwner = isOwnerProfile(user?.staffProfile);
  const subtotal = moneyToNumber(order.subtotal);
  const discount = moneyToNumber(order.discount);
  const shipping = moneyToNumber(order.shipping);
  const total = moneyToNumber(order.total);

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
            {order.archivedAt && (
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                Arquivado
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {/* Itens */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-bold">Itens do pedido</h2>
          <div className="divide-y divide-border">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 py-3">
                <ProductImage emoji={it.product?.emoji} name={it.name} className="size-12 rounded-xl" emojiClassName="text-xl" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{it.name}</p>
                  <p className="text-xs text-muted-foreground">{it.qty} × {formatBRL(moneyToNumber(it.price))}</p>
                </div>
                <p className="font-bold">{formatBRL(moneyToNumber(it.price) * it.qty)}</p>
              </div>
            ))}
          </div>
          <dl className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatBRL(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success-600">
                <dt>Desconto {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                <dd>- {formatBRL(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Frete</dt>
              <dd>{shipping === 0 ? "Grátis" : formatBRL(shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold">
              <dt>Total</dt>
              <dd className="text-brand-700 dark:text-brand-400">{formatBRL(total)}</dd>
            </div>
          </dl>
          </section>

          <ReturnManagement requests={order.returnRequests} />
        </div>

        {/* Lateral */}
        <aside className="space-y-4">
          {!order.archivedAt && <div className="space-y-3 rounded-2xl border border-border bg-card p-5 print:hidden">
            <h2 className="font-bold">Atualizar status</h2>
            <OrderStatusControl
              id={order.id}
              current={order.status}
              allowed={allowedOrderTransitions(order.status, order.paymentMethod)}
            />
          </div>}

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
            <p>{order.customerName}</p>
            {order.customerEmail && <p className="text-muted-foreground">{order.customerEmail}</p>}
            {order.customerPhone && <p className="text-muted-foreground">{order.customerPhone}</p>}
          </div>

          {order.deliveryProof && (
            <div className="space-y-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="font-bold text-emerald-800 dark:text-emerald-200">Comprovante de entrega</p>
              <p>Recebido por: <strong>{order.deliveryProof.recipientName}</strong></p>
              <p className="text-xs text-muted-foreground">
                Método: {order.deliveryProof.method}
                {order.deliveryProof.recipientDocumentLast4
                  ? ` · documento final ${order.deliveryProof.recipientDocumentLast4}`
                  : ""}
                {order.deliveryProof.courierName ? ` · ${order.deliveryProof.courierName}` : ""}
              </p>
              {order.deliveryProof.notes && <p className="text-xs">{order.deliveryProof.notes}</p>}
            </div>
          )}

          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
              <p className="flex items-center gap-2 font-bold">
                <MapPin className="size-4 text-brand-600 dark:text-brand-400" /> Entrega
              </p>
              <p className="text-muted-foreground">
                {order.shippingRecipient}<br />
                {order.shippingStreet}, {order.shippingNumber}
                {order.shippingComplement ? ` - ${order.shippingComplement}` : ""}
                <br />
                {order.shippingDistrict}, {order.shippingCity}/{order.shippingState}
                <br />
                CEP {order.shippingZip}
              </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <CreditCard className="size-4 text-brand-600 dark:text-brand-400" /> Pagamento
            </p>
            <p className="text-muted-foreground">
              Método: <strong className="text-foreground">{order.paymentMethod ?? "—"}</strong>
              <br />
              Status: {order.payment?.status ?? "—"}
            </p>
            {order.payment?.status === "REFUND_PENDING" && (
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Estorno solicitado; aguardando confirmação do Stripe.
              </p>
            )}
            {order.payment?.status === "REFUND_FAILED" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-danger-500">
                  O pedido foi cancelado, mas o dinheiro ainda não foi confirmado
                  como devolvido.
                </p>
                {order.payment.refundError && (
                  <p className="text-xs text-muted-foreground">
                    {order.payment.refundError}
                  </p>
                )}
                <RetryRefundButton orderId={order.id} />
              </div>
            )}
            {order.payment?.lastReconciledAt && (
              <p className="text-xs text-muted-foreground">
                Última conciliação: {order.payment.lastReconciledAt.toLocaleString("pt-BR")}
                {` · ${order.payment.reconciliationAttempts} tentativa(s)`}
              </p>
            )}
            {order.payment?.reconciliationError && (
              <p className="text-xs font-semibold text-danger-500">
                Conciliação: {order.payment.reconciliationError}
              </p>
            )}
          </div>

          {isOwner && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5 print:hidden">
              <p className="text-sm font-bold">Histórico do pedido</p>
              <p className="text-xs text-muted-foreground">
                O arquivamento é reversível e preserva itens, pagamento,
                conciliação e dados obrigatórios do pedido.
              </p>
              <OrderArchiveButton
                orderId={order.id}
                orderNumber={order.number}
                archived={!!order.archivedAt}
                redirectToList
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
