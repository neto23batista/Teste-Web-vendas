import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createCoupon } from "@/actions/admin-coupons";
import { CouponForm } from "@/components/admin/coupon-form";

export const metadata = { title: "Novo cupom" };

export default function NewCouponPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/cupons"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold">Novo cupom</h1>
      </div>
      <CouponForm action={createCoupon} submitLabel="Criar cupom" />
    </div>
  );
}
