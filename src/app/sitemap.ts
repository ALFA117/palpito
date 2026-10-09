import type { MetadataRoute } from "next";

// Calls, markets and profiles are addressed by on-chain ids and change by the
// minute, so only the two standing pages are listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://palpito-somnia.vercel.app";
  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/ranking`, changeFrequency: "hourly", priority: 0.8 },
  ];
}
