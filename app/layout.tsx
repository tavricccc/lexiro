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
};

export const viewport: Viewport = {
  themeColor: "#F5F7F5",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body>
        <script
          id="impeccable-direction-contract"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              direction: "Focus Canvas",
              composition: "quiet single learning canvas with borderless supporting rows",
              visualLanguage: "soft personal SaaS, forest ink green, restrained Open Doodles and Highlights",
              typography: "HarmonyOS Sans TC with Novae weight hierarchy and calm editorial spacing",
              color: "#F5F7F5 #FCFDFC #26302D #6B7773 #3F7568 #315E54 #E0ECE7",
              signature: "one recommended next action inside a generous pale-sage study canvas",
            }),
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
