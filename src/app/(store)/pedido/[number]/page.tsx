import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  ArrowRight,
  FileText,
  XCircle,
  MessageSquareText,
  Truck,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/store/product-image";
import {
  StatusBadge,
  OrderTimeline,
} from "@/components/store/order-status";
import { SimulatePaymentButton } from "@/components/store/simulate-payment-button";
import { PixPayment } from "@/components/store/pix-payment";
import { OrderLiveStatus } from "@/components/store/order-live-status";
import { readPixRaw } from "@/lib/pagbank";
import { qrPngBase64 } from "@/lib/qrcode";
import { PrescriptionResubmit } from "@/components/store/prescription-resubmit";
import { CancelOrderButton } from "@/components/store/cancel-order-button";
import { ReorderButton } from "@/components/store/reorder-button";

export const metadata: Metadata = { title: "Pedido" };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login`);

  const order = await prisma.order.findUnique({
    where: { number },
    include: {
      items: { include: { product: { select: { slug: true, emoji: true } } } },
      address: true,
      payment: true,
      prescriptions: { orderBy: { createdAt: "desc" } },
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

  const isPaid = order.status !== "PENDING" && order.status !== "CANCELED";
  const awaitingPayment =
    order.status === "PENDING" && order.paymentMethod !== "cash";
  // PIX nativo: QR + copia-e-cola gerados no checkout e persistidos no pagamento.
  const pixData = readPixRaw(order.payment?.raw);
  const showPix = awaitingPayment && order.paymentMethod === "pix" && !!pixData;
  // Garante o QR mesmo em pedidos antigos sem imagem salva: gera do copia-e-cola.
  const pixQrBase64 =
    showPix && pixData
      ? pixData.qrCodeBase64 || (await qrPngBase64(pixData.qrCode))
      : "";
  // O cliente ainda pode cancelar enquanto o pedido não saiu para entrega.
  const canCancel =
    order.status === "PENDING" ||
    order.status === "PAID" ||
    order.status === "PREPARING";
  // O atalho de "simular pagamento" é só para demonstração local — nunca em produção.
  const allowSimulate = process.env.NODE_ENV !== "production";

  // Estado da validação farmacêutica (para itens com receita).
  const rxApproved = order.prescriptions.some((p) => p.status === "APPROVED");
  const rxLatest = order.prescriptions[0];
  const rxNeedsAction =
    order.requiresPrescription &&
    !rxApproved &&
    (!rxLatest || rxLatest.status === "REJECTED");

  // Acompanhamento ao vivo: enquanto o pedido está "vivo" (e o PIX não está
  // com o próprio poller na tela), a página se atualiza sozinha quando o
  // admin avança o status ou valida a receita — sem o cliente recarregar.
  const live =
    order.status !== "DELIVERED" && order.status !== "CANCELED" && !showPix;

  return (
    <div className="container-page max-w-4xl py-6 md:py-10">
      {live && (
        <OrderLiveStatus
          orderNumber={order.number}
          initialStatus={order.status}
          initialRxStatus={rxLatest?.status ?? null}
        />
      )}
      {/* Cabeçalho */}
      <div className="rounded-3xl border border-border bg-card p-6 text-center md:p-8">
        <span
          className={`mx-auto grid size-16 place-items-center rounded-2xl ${
            isPaid
              ? "bg-success-500/10 text-success-600"
              : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
          }`}
        >
          {isPaid ? <CheckCircle2 className="size-8" /> : <Clock className="size-8" />}
        </span>
        <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">
          {isPaid ? "Pedido confirmado!" : "Quase lá!"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Pedido <strong className="text-foreground">{order.number}</strong> ·{" "}
          {new Date(order.createdAt).toLocaleDateString("pt-BR")}
        </p>
        <div className="mt-3">
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* Pagamento pendente */}
      {showPix && pixData ? (
        <PixPayment
          orderNumber={order.number}
          amount={order.total}
          qrCode={pixData.qrCode}
          qrCodeBase64={pixQrBase64}
        />
      ) : awaitingPayment ? (
        <div className="mt-6 space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
          {allowSimulate ? (
            <>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Aguardando pagamento. Em produção, aqui o cliente é levado ao
                PagBank. Para demonstrar o fluxo (apenas em desenvolvimento),
                confirme abaixo:
              </p>
              <SimulatePaymentButton orderNumber={order.number} />
            </>
          ) : (
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Aguardando confirmação do pagamento. Assim que for confirmado, seu
              pedido avança automaticamente — você pode acompanhar por aqui ou em
              “Meus pedidos”.
            </p>
          )}
        </div>
      ) : null}

      {/* Validação farmacêutica da receita */}
      {order.requiresPrescription && (
        <div
          className={
            rxApproved
              ? "mt-6 flex flex-col gap-2 rounded-2xl border border-success-500/30 bg-success-500/10 p-5"
              : rxLatest?.status === "REJECTED" || !rxLatest
                ? "mt-6 flex flex-col gap-3 rounded-2xl border border-danger-500/30 bg-danger-500/10 p-5"
                : "mt-6 flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10"
          }
        >
          <p className="flex items-center gap-2 text-sm font-bold">
            {rxApproved ? (
              <>
                <CheckCircle2 className="size-5 text-success-600" /> Receita aprovada
              </>
            ) : rxLatest?.status === "REJECTED" || !rxLatest ? (
              <>
                <XCircle className="size-5 text-danger-500" />{" "}
                {rxLatest?.status === "REJECTED"
                  ? "Receita recusada"
                  : "Receita pendente"}
              </>
            ) : (
              <>
                <FileText className="size-5 text-amber-600" /> Receita em análise
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {rxApproved
              ? "Sua receita foi validada pela equipe farmacêutica. O pedido seguirá para preparo."
              : rxLatest?.status === "REJECTED"
                ? "A receita enviada não pôde ser validada. Envie um novo documento legível para liberar o envio."
                : rxLatest
                  ? "Nossa equipe farmacêutica está validando sua receita. O envio é liberado após a aprovação."
                  : "Este pedido exige receita médica. Envie o documento para liberar o preparo."}
          </p>
          {rxNeedsAction && <PrescriptionResubmit orderNumber={order.number} />}
        </div>
      )}

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
                <p className="text-sm font-bold">{formatBRL(item.price * item.qty)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Resumo + endereço */}
        <aside className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatBRL(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success-600">
                <span>Desconto {order.couponCode ? `(${order.couponCode})` : ""}</span>
                <span className="font-semibold">- {formatBRL(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Frete
                {order.deliveryMethod === "express" ? " · Entrega Rápida" : ""}
              </span>
              <span className="font-semibold">
                {order.shipping === 0 ? "Grátis" : formatBRL(order.shipping)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <span className="font-bold">Total</span>
              <span className="font-extrabold text-brand-700 dark:text-brand-400">
                {formatBRL(order.total)}
              </span>
            </div>
          </div>

          {order.address && (
            <div className="space-y-1 rounded-2xl border border-border bg-card p-5 text-sm">
              <p className="flex items-center gap-2 font-bold">
                <MapPin className="size-4 text-brand-600 dark:text-brand-400" /> Entrega
              </p>
              <p className="text-muted-foreground">
                {order.address.recipient}
                <br />
                {order.address.street}, {order.address.number}
                {order.address.complement ? ` - ${order.address.complement}` : ""}
                <br />
                {order.address.district}, {order.address.city}/{order.address.state}
                <br />
                CEP {order.address.zip}
              </p>
            </div>
          )}

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
