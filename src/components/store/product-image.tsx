import Image from "next/image";
import { cn } from "@/lib/utils";

// Paleta de gradientes suaves — escolhidos deterministicamente pelo nome.
// Tons frios/variados, alinhados à marca teal/menta (estilo app premium).
const gradients = [
  "from-rose-100 to-red-200 dark:from-rose-500/20 dark:to-red-500/10",
  "from-orange-100 to-amber-200 dark:from-orange-500/20 dark:to-amber-500/10",
  "from-pink-100 to-rose-200 dark:from-pink-500/20 dark:to-rose-500/10",
  "from-red-100 to-orange-200 dark:from-red-500/20 dark:to-orange-500/10",
  "from-sky-100 to-blue-200 dark:from-sky-500/20 dark:to-blue-500/10",
  "from-amber-100 to-yellow-200 dark:from-amber-500/20 dark:to-yellow-500/10",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ProductImage({
  src,
  emoji,
  name,
  className,
  emojiClassName,
  sizes = "(max-width: 768px) 50vw, 25vw",
  priority,
}: {
  /** URL da imagem real do produto. Sem ela, cai no emoji + gradiente. */
  src?: string | null;
  emoji?: string | null;
  name: string;
  className?: string;
  emojiClassName?: string;
  sizes?: string;
  priority?: boolean;
}) {
  // `className` controla o tamanho/aspecto (ex.: "aspect-square w-full") — o
  // mesmo contrato nos dois modos, para que o hover/scale do card continue valendo.
  if (src) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        <Image
          src={src}
          alt={name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    );
  }

  const gradient = gradients[hash(name) % gradients.length];
  return (
    <div
      className={cn(
        "grid place-items-center bg-gradient-to-br",
        gradient,
        className
      )}
    >
      <span className={cn("select-none", emojiClassName)} aria-hidden="true">
        {emoji ?? "💊"}
      </span>
    </div>
  );
}
