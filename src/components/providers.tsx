"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";

export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  /** Nonce da CSP (via middleware) — aplicado ao script anti-flash do tema. */
  nonce?: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      // Padrão CLARO; o toggle do cabeçalho persiste a escolha do cliente
      // (localStorage), que sempre prevalece sobre o padrão.
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      nonce={nonce}
    >
      {/* reducedMotion="user" desliga transforms quando o usuário pede
          menos movimento — toda a camada de animação respeita isso. */}
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{ style: { borderRadius: "0.9rem" } }}
        />
      </MotionConfig>
    </ThemeProvider>
  );
}
