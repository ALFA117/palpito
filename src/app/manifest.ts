import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Palpito — Dilo. Que la cadena lo confirme.",
    short_name: "Palpito",
    description: "Predicciones con recibo verificable sobre contratos de evento de DreamDEX en Somnia testnet.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f8",
    theme_color: "#0f1115",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
