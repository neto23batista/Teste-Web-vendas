import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FarmaVida — Farmácia online",
    short_name: "FarmaVida",
    description:
      "Farmácia online com entrega rápida, compra segura e atendimento farmacêutico.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4faf7",
    theme_color: "#059669",
    lang: "pt-BR",
    categories: ["health", "medical", "shopping"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
