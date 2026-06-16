import type { MetadataRoute } from "next";

// Web App Manifest (Next Metadata API → tự route /manifest.webmanifest).
// Cho phép cài SDFish về home screen Android (PWA) + iOS (Add to Home Screen).
// theme/background = navy nền app; icons sinh từ public/icon.svg (npm run icons).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SDFish — Bạn đồng hành của ngư dân",
    short_name: "SDFish",
    description:
      "Đánh bắt tốt hơn · Bán được đắt hơn · Vận hành rẻ hơn · Tuân thủ dễ hơn",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "vi",
    dir: "ltr",
    background_color: "#14324f",
    theme_color: "#14324f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
