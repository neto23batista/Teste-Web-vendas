import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/store/product-image";
import {
  StatusBadge,
  OrderTimeline,
} from "@/components/store/order-status";
import { PixPayment } from "@/components/store/pix-payment";
import { OrderLiveStatus } from "@/components/store/order-live-status";
import { readCheckoutRaw, readPixRaw } from "@/lib/payments/stripe";
import { qrPngBase64 } from "@/lib/qrcode";
import { CancelOrderButton } from "@/components/store/cancel-order-button";
import { ReorderButton } from "@/components/store/reorder-button";
import { moneyToNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Pedido" };

// Fora do componente: Date.now() é impuro para a regra de pureza do compiler.
function isExpired(iso: string | null): boolean {
  return !!iso && new Date(iso).getTime() < Date.now();
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/pedido/${number}`)}`);
  }

  const order = await prisma.order.findUnique({
    where: { number },
    include: {
      items: { include: { product: { select: { slug: true, emoji: true } } } },
      payment: true,
      courier: { select: { name: true } },
    },
  });
  if (!order) notFound();
  // O dono vê seu pedido aqui; um admin que abre o link de um pedido de cliente
  // é levado à visão do painel (com os controles); qualquer outro: 404.
  if (order.userId !== user.id) {
    if (user.role === "ADMIN") redirect(`/admin/pedidos/${order.id}`);
    notFound();
  }
  const subtotal = moneyToNumber(order.subtotal);
  const discount = moneyToNumber(order.discount);
  const shipping = moneyToNumber(order.shipping);
  const total = moneyToNumber(order.total);

  const isCanceled = order.status === "CANCELED";
  const isPaid = order.status !== "PENDING" && !isCanceled;
  const awaitingPayment =
    order.status === "PENDING" && order.paymentMethod !== "cash";
  // PIX nativo: QR + copia-e-cola gerados no checkout e persistidos no pagamento.
  const pixData = readPixRaw(order.payment?.raw);
  // O QR do Stripe expira; passado isso não adianta exibir porque o provedor
  // recusa a cobrança expirada.
  const pixExpired = isExpired(pixData?.expiresAt ?? null);
  const pix =
    awaitingPayment && order.paymentMethod === "pix" && !pixExpired
      ? pixData
      : null;
  const cardCheckout = readCheckoutRaw(order.payment?.raw);
  const cardCheckoutAvailable =
    awaitingPayment &&
    order.paymentMethod === "card" &&
    !!cardCheckout?.url &&
    !isExpired(cardCheckout.expiresAt);
  // Garante o QR mesmo em pedidos antigos sem imagem salva: gera do copia-e-cola.
  const pixQrBase64 = pix
    ? pix.qrCodeBase64 || (await qrPngBase64(pix.qrCode))
    : "";
  // O cliente ainda pode cancelar enquanto o pedido não saiu para entrega.
  const canCancel =
    order.status === "PENDING" ||
    order.status === "PAID" ||
    order.status === "PREPARING";

  // Acompanhamento ao vivo: enquanto o pedido está "vivo" (e o PIX não está
  // com o próprio poller na tela), a página se atualiza sozinha quando o
  // admin avança o status — sem o cliente recarregar.
  const live =
    order.status !== "DELIVERED" && order.status !== "CANCELED" && !pix;

  return (
    <div className="container-page max-w-4xl py-6 md:py-10">
      {live && (
        <OrderLiveStatus
          orderNumber={order.number}
          initialStatus={order.status}
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
          ) : cardCheckoutAvailable ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                O pagamento no cartão ainda não foi concluído.
              </p>
              <Button asChild variant="primary" size="sm">
                <a href={cardCheckout.url!}>Continuar pagamento no Stripe</a>
              </Button>
            </div>
          ) : (
            <Clock className="size-8" />
          )}
        </span>
        <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">
          {isCanceled
            ? "Pedido cancelado"
            : isPaid
              ? "Pedido confirmado!"
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

      {isCanceled && order.payment?.status === "REFUND_PENDING" && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
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
          {pixExpired ? (
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
                    {item.qty} × {formatBRL(moneyToNumber(item.price))}
                  </p>
                </div>
                <p className="text-sm font-bold">
                  {formatBRL(moneyToNumber(item.price) * item.qty)}
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
