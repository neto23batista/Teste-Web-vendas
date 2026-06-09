"use client";

import { motion, type Variants, type HTMLMotionProps } from "framer-motion";

/* ============================================================
   Tokens de movimento — ritmo único para todo o app.
   Easing "ease-out expressivo" na entrada; springs para feedback
   tátil. Tudo respeita prefers-reduced-motion via <MotionConfig
   reducedMotion="user"> nos Providers.
   ============================================================ */

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const SPRING_SOFT = { type: "spring", stiffness: 260, damping: 24 } as const;
export const SPRING_SNAPPY = { type: "spring", stiffness: 420, damping: 28 } as const;

/** Sobe e aparece — uso geral em blocos e títulos. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Apenas fade — para fundos e elementos sutis. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** Item de lista/grid — combina com <RevealGroup>. */
export const item: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_OUT } },
};

/** Container que escalona a entrada dos filhos. */
export const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** Pop com mola — selos, badges, ícones de confirmação. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  visible: { opacity: 1, scale: 1, transition: SPRING_SNAPPY },
};

type DivProps = HTMLMotionProps<"div"> & { amount?: number };

/** Revela um único elemento quando entra na viewport (uma vez). */
export function Reveal({
  variants = fadeUp,
  amount = 0.2,
  className,
  ...props
}: DivProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={variants}
      className={className}
      {...props}
    />
  );
}

/** Container que escalona a revelação dos filhos <RevealItem>. */
export function RevealGroup({ amount = 0.15, className, ...props }: DivProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={container}
      className={className}
      {...props}
    />
  );
}

/** Filho de <RevealGroup> — herda o estado do container. */
export function RevealItem({ className, ...props }: HTMLMotionProps<"div">) {
  return <motion.div variants={item} className={className} {...props} />;
}

/** Wrapper interativo: eleva no hover, afunda no toque (mola). */
export function HoverLift({ className, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_SNAPPY}
      className={className}
      {...props}
    />
  );
}

export { motion };
