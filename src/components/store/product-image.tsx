import Image from "next/image";
import { cn } from "@/lib/utils";

// Paleta de gradientes suaves — escolhidos deterministicamente pelo nome.
// Tons frios/variados, alinhados à marca teal/menta (estilo app premium).
const gradients = [
  "from-teal-100 to-emerald-200 dark:from-teal-500/20 dark:to-emerald-500/10",
  "from-sky-100 to-cyan-200 dark:from-sky-500/20 dark:to-cyan-500/10",
  "from-violet-100 to-purple-200 dark:from-violet-500/20 dark:to-purple-500/10",
  "from-emerald-100 to-teal-200 dark:from-emerald-500/20 dark:to-teal-500/10",
  "from-cyan-100 to-sky-200 dark:from-cyan-500/20 dark:to-sky-500/10",
  "from-amber-100 to-orange-200 dark:from-amber-500/20 dark:to-orange-500/10",
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
