import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { t } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lexiro", template: "%s · Lexiro" },
  description: t("app.description"),
  applicationName: "Lexiro",
  icons: {
    icon: "/icons/lexiro.png",
    apple: "/icons/apple-touch-icon.png",
  },
  // An opaque bar tinted by theme-color; the page starts below it.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lexiro",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf0ec" },
    { media: "(prefers-color-scheme: dark)", color: "#131d17" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
