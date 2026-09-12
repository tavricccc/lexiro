import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@lexiro/ai-contract"],
  // Dev server binds to 0.0.0.0, so allow requests from LAN/VPN addresses.
  allowedDevOrigins: ["192.168.1.*", "100.*.*.*", "*.local"],
  experimental: {
    optimizePackageImports: ["lucide-react", "motion", "radix-ui"],
  },
  // Addresses that used to be pages. Keeping them as redirects costs nothing
  // and keeps an installed app's history and any saved link working, without
  // keeping the pages themselves around.
  redirects: async () => [
    { source: "/settings", destination: "/me", permanent: true },
    {
      source: "/questions",
      destination: "/library?tab=questions",
      permanent: true,
    },
    // Writing a question from scratch is gone; questions come from the words
    // you already have. Editing the ones you have has not moved.
    { source: "/questions/new", destination: "/questions/generate", permanent: true },
    {
      source: "/questions/reading/new",
      destination: "/questions/generate",
      permanent: true,
    },
  ],
};

export default withSerwist(nextConfig);
