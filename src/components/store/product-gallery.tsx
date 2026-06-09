"use client";

import * as React from "react";
import { ProductImage } from "@/components/store/product-image";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  emoji,
  name,
}: {
  images: { url: string; alt: string | null }[];
  emoji: string | null;
  name: string;
}) {
  const [active, setActive] = React.useState(0);
  const current = images[active]?.url;

  return (
    <div className="space-y-3">
      <div className="group relative overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-card)]">
        <ProductImage
          src={current}
          emoji={emoji}
          name={name}
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="aspect-square w-full transition-transform duration-700 ease-out group-hover:scale-105"
          emojiClassName="text-[8rem] md:text-[11rem]"
        />
      </div>

      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagem ${i + 1}`}
              aria-pressed={i === active}
              className={cn(
                "relative size-16 overflow-hidden rounded-xl border-2 transition",
                i === active
                  ? "border-brand-600"
                  : "border-border hover:border-brand-300"
              )}
            >
              <ProductImage
                src={img.url}
                name={name}
                className="size-full"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
