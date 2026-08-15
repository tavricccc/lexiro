import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { t } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

const robotoMono = Roboto_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const metadata: Metadata = {
  title: { default: "Lexiro", template: "%s · Lexiro" },
  description: t("app.description"),
  applicationName: "Lexiro",
  icons: {
    icon: "/icons/lexiro.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f9" },
    { media: "(prefers-color-scheme: dark)", color: "#131313" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning className={`${inter.variable} ${robotoMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
