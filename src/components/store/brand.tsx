import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "FarmaVida";

export function Brand({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${APP_NAME} — início`}
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span className="grid size-10 place-items-center rounded-2xl gradient-brand text-white shadow-[var(--shadow-glow)] transition-transform group-hover:scale-105">
        <Plus className="size-5" strokeWidth={3} />
      </span>
      <span className="text-lg font-extrabold tracking-tight">
        Farma<span className="text-brand-600 dark:text-brand-400">Vida</span>
      </span>
    </Link>
  );
}
