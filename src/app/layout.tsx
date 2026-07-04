import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Hanken_Grotesk, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { RegisterSW } from "@/components/register-sw";

// Corpo: Hanken Grotesk. Títulos: Space Grotesk (via --font-display).
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "FarmaVida";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: `${APP_NAME} — Farmácia online`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Farmácia online com compra segura, receitas protegidas, entrega rápida e atendimento farmacêutico.",
  applicationName: APP_NAME,
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#079685" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1513" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Nonce gerado pelo middleware (proxy.ts) — o script inline anti-flash do
  // next-themes precisa dele para passar na CSP estrita.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="pt-BR"
      className={`${hanken.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <Providers nonce={nonce}>{children}</Providers>
        <RegisterSW />
      </body>
    </html>
  );
}
