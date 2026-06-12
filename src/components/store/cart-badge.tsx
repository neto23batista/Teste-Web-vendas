"use client";

import { AnimatePresence, motion } from "framer-motion";

/** Badge de contagem da sacola que "pula" sempre que o número muda. */
export function CartBadge({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 18 }}
          className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-promo-600 px-1.5 text-xs font-bold text-white ring-2 ring-background"
        >
          {count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
