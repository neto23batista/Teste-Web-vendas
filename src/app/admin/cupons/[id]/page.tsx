import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { updateCoupon } from "@/actions/admin-coupons";
import { CouponForm } from "@/components/admin/coupon-form";

export const metadata = { title: "Editar cupom" };

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) notFound();

  const action = updateCoupon.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/cupons"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold">Editar cupom</h1>
        <p className="text-sm text-muted-foreground">{coupon.code}</p>
      </div>
      <CouponForm action={action} coupon={coupon} submitLabel="Salvar alterações" />
    </div>
  );
}
