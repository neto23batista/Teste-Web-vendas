"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/** Product photography must show the exact package; never substitute invented artwork. */
export function ProductImage({ src, name, className, sizes = "(max-width: 768px) 50vw, 25vw", priority }: {
  src?: string | null;
  /** Legacy DTO compatibility; intentionally not rendered. */
  emoji?: string | null;
  emojiClassName?: string;
  name: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && failedSrc !== src) {
    return (
      <div className={cn("relative overflow-hidden bg-white", className)}>
        <Image src={src} alt={name} fill sizes={sizes} priority={priority}
          onError={() => setFailedSrc(src)} className="object-contain p-[8%]" />
      </div>
    );
  }
  return (
    <div role="img" aria-label={`${name}: imagem indisponível`}
      className={cn("product-placeholder grid place-items-center overflow-hidden bg-muted text-muted-foreground", className)}>
      <div aria-hidden="true" className="grid w-full justify-items-center gap-2 p-2">
        <Package className="h-auto w-[28%] max-w-14" strokeWidth={1.5} />
        <span className="product-placeholder-caption text-center text-sm leading-snug">Imagem indisponível</span>
      </div>
    </div>
  );
}
