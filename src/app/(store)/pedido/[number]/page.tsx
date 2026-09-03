import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Package,
  ArrowRight,
  MessageSquareText,
  Truck,
} from "lucide-react";
import { getCustomerOrderView } from "@/server/queries/orders";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/store/product-image";
import {
  StatusBadge,
  OrderTimeline,
} from "@/components/store/orders/order-status";
import { PixPayment } from "@/components/store/orders/pix-payment";
import { OrderLiveStatus } from "@/components/store/orders/order-live-status";
import { CancelOrderButton } from "@/components/store/orders/cancel-order-button";
import { ReorderButton } from "@/components/store/orders/reorder-button";

export const metadata: Metadata = { title: "Pedido" };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const view = await getCustomerOrderView(number);
  if (!view) notFound();
  const { order, isCanceled, isPaid, awaitingPayment, pixExpired, pix,
    pixQrBase64, cardCheckout, cardCheckoutAvailable, canCancel, live } = view;
  const { subtotal, discount, shipping, total } = order;

  return (
    <div className="container-page max-w-4xl py-6 md:py-10">
      {live && (
        <OrderLiveStatus
          orderNumber={order.number}
          initialStatus={order.status}
          initialPaymentStatus={order.payment?.status ?? null}
        />
      )}
      {/* Cabeçalho */}
      <div className="rounded-3xl border border-border bg-card p-6 text-center md:p-8">
        <span
          className={`mx-auto grid size-16 place-items-center rounded-2xl ${
            isCanceled
              ? "bg-danger-500/10 text-danger-500"
              : isPaid
                ? "bg-success-500/10 text-success-600"
                : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
          }`}
        >
          {isCanceled ? (
            <XCircle className="size-8" />
          ) : isPaid ? (
            <CheckCircle2 className="size-8" />
          ) : (
            <Clock className="size-8" />
          )}
        </span>
        <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">
          {isCanceled
            ? "Pedido cancelado"
            : isPaid
              ? "Pedido confirmado!"
              : order.payment?.status === "QUARANTINED"
                ? "Pagamento em análise"
                : "Aguardando pagamento"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Pedido <strong className="text-foreground">{order.number}</strong> ·{" "}
          {new Date(order.createdAt).toLocaleDateString("pt-BR")}
        </p>
        <div className="mt-3">
          <StatusBadge status={order.status} />
        </div>
      </div>

      {order.payment?.status === "QUARANTINED" && (
        <div role="status" className="mt-6 space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            Estamos conferindo uma divergência no pagamento. Não pague novamente.
          </p>
          <p>A equipe verificará a cobrança e orientará a confirmação ou o reembolso. Referência: pedido {order.number}.</p>
          <Button asChild variant="outline" size="sm"><Link href="/contato">Falar com a equipe</Link></Button>
        </div>
      )}
      {order.payment?.status === "REFUNDED" && (
        <div role="status" className="mt-6 rounded-2xl border border-success-500/30 bg-success-500/10 p-5 text-sm font-semibold text-success-700 dark:text-success-400">
          O reembolso foi confirmado. O prazo para aparecer no saldo ou na fatura depende da sua instituição financeira.
        </div>
      )}

      {isCanceled && order.payment?.status === "REFUND_PENDING" && (
        <div role="status" className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          O cancelamento foi registrado e o reembolso está sendo processado pelo
          Stripe. A confirmação aparecerá aqui quando o provedor concluir.
        </div>
      )}
      {isCanceled && order.payment?.status === "REFUND_FAILED" && (
        <div className="mt-6 space-y-2 rounded-2xl border border-danger-500/30 bg-danger-500/5 p-5 text-sm">
          <p className="font-semibold text-danger-500">
            O pedido foi cancelado, mas o reembolso ainda não foi confirmado.
          </p>
          <p className="text-muted-foreground">
            Nossa equipe precisa reprocessar o estorno. Entre em contato e informe o
            pedido {order.number}.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/contato">Falar com a equipe</Link>
          </Button>
        </div>
      )}

      {/* Pagamento pendente */}
      {pix ? (
        <PixPayment
          orderNumber={order.number}
          amount={total}
          qrCode={pix.qrCode}
          qrCodeBase64={pixQrBase64}
        />
      ) : awaitingPayment ? (
        <div className="mt-6 space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
          {cardCheckoutAvailable && cardCheckout ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                O pagamento no cartão foi iniciado e ainda não foi concluído.
              </p>
              <Button asChild variant="primary" size="sm">
                <a href={cardCheckout.url}>Continuar pagamento</a>
              </Button>
            </div>
          ) : pixExpired ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Este PIX expirou e não pode mais ser pago. Cancele o pedido e
                refaça a compra para gerar uma nova cobrança, ou fale com a equipe.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/conta/pedidos">Ver meus pedidos</Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Aguardando confirmação do pagamento. Assim que for confirmado, seu
              pedido avança automaticamente — você pode acompanhar por aqui ou em
              “Meus pedidos”.
            </p>
          )}
        </div>
      ) : null}

      {/* Timeline */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <OrderTimeline status={order.status} />
        {order.status === "SHIPPED" && order.courier && (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
            <Truck className="size-4" />
            Saiu para entrega com {order.courier.name}
            {order.dispatchedAt
              ? ` às ${order.dispatchedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_18rem]">
        {/* Itens */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Package className="size-5 text-brand-600 dark:text-brand-400" /> Itens
          </h2>
          <div className="divide-y divide-border">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <ProductImage
                  emoji={item.product?.emoji}
                  name={item.name}
                  className="size-14 rounded-xl"
                  emojiClassName="text-2xl"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.qty} × {formatBRL(item.price)}
                  </p>
                </div>
                <p className="text-sm font-bold">
                  {formatBRL(item.price * item.qty)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Resumo + endereço */}
        <aside className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatBRL(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success-600">
                <span>Desconto {order.couponCode ? `(${order.couponCode})` : ""}</span>
                <span className="font-semibold">- {formatBRL(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Frete
                {order.deliveryMethod === "express" ? " · Entrega Rápida" : ""}
              </span>
              <span className="font-semibold">
                {shipping === 0 ? "Grátis" : formatBRL(shipping)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <span className="font-bold">Total</span>
              <span className="font-extrabold text-brand-700 dark:text-brand-400">
                {formatBRL(total)}
              </span>
            </div>
          </div>

          <div className="space-y-1 rounded-2xl border border-border bg-card p-5 text-sm">
              <p className="flex items-center gap-2 font-bold">
                <MapPin className="size-4 text-brand-600 dark:text-brand-400" /> Entrega
              </p>
              <p className="text-muted-foreground">
                {order.shippingRecipient}
                <br />
                {order.shippingStreet}, {order.shippingNumber}
                {order.shippingComplement ? ` - ${order.shippingComplement}` : ""}
                <br />
                {order.shippingDistrict}, {order.shippingCity}/{order.shippingState}
                <br />
                CEP {order.shippingZip}
              </p>
          </div>

          {order.notes && (
            <div className="space-y-1 rounded-2xl border border-border bg-card p-5 text-sm">
              <p className="flex items-center gap-2 font-bold">
                <MessageSquareText className="size-4 text-brand-600 dark:text-brand-400" />{" "}
                Observações
              </p>
              <p className="text-muted-foreground">{order.notes}</p>
            </div>
          )}
        </aside>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <ReorderButton orderNumber={order.number} variant="outline" size="lg" />
        <Button asChild variant="primary" size="lg">
          <Link href="/catalogo">
            Continuar comprando <ArrowRight className="size-5" />
          </Link>
        </Button>
      </div>
      <div className="mt-3 text-center">
        <Link
          href="/conta/pedidos"
          className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          Ver meus pedidos
        </Link>
      </div>

      {canCancel && (
        <div className="mt-4 flex justify-center">
          <CancelOrderButton orderNumber={order.number} />
        </div>
      )}
    </div>
  );
}
