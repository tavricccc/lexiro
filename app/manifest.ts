import type { MetadataRoute } from "next";
import { t } from "@/lib/i18n";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lexiro",
    short_name: "Lexiro",
    description: t("app.description"),
    start_url: "/",
    display: "standalone",
    background_color: "#F5F7F5",
    theme_color: "#3F7568",
    icons: [
      { src: "/icons/lexiro.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
