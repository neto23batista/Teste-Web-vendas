import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FarmaVida — Farmácia online",
    short_name: "FarmaVida",
    description:
      "Farmácia online com entrega rápida, compra segura e atendimento farmacêutico.",
    start_url: "/",
    display: "standalone",
    // Fundo da splash do PWA acompanha o tema padrão (claro).
    background_color: "#f3f8f6",
    theme_color: "#079685",
    lang: "pt-BR",
    categories: ["health", "medical", "shopping"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
