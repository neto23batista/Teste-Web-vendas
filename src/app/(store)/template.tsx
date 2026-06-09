"use client";

import { motion } from "framer-motion";
import { EASE_OUT } from "@/components/motion/motion";

/* template.tsx remonta a cada navegação — perfeito para a animação
   de entrada de página (continuidade espacial: sobe levemente + fade). */
export default function StoreTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
