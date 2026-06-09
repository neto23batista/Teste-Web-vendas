"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
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
