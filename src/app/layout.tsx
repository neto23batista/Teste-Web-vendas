import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Hanken_Grotesk, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
    "Farmácia online de medicamentos isentos de prescrição, com catálogo, pedidos e entrega.",
  applicationName: APP_NAME,
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "pt_BR",
    title: `${APP_NAME} — Farmácia online`,
    description:
      "Catálogo de medicamentos isentos de prescrição, cuidados diários e entrega conforme o CEP.",
  },
  twitter: {
    card: "summary",
    title: `${APP_NAME} — Farmácia online`,
    description:
      "Catálogo de medicamentos isentos de prescrição, cuidados diários e entrega conforme o CEP.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c81328" },
    { media: "(prefers-color-scheme: dark)", color: "#130e0f" },
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
        <a
          href="#conteudo-principal"
          className="fixed left-4 top-0 z-[100] -translate-y-full rounded-b-xl bg-brand-700 px-4 py-3 font-semibold text-white transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white"
        >
          Pular para o conteúdo principal
        </a>
        <Providers nonce={nonce}>{children}</Providers>
        <RegisterSW />
        {/* Só na Vercel: fora dela os scripts /_vercel/... não existem (404 no
            console — e o e2e de qualidade exige console limpo). Como são
            servidos na própria origem, a diretiva 'self' da CSP os permite. */}
        {process.env.VERCEL ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
