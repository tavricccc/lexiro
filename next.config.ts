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
  // Keep old workspace deep links working after the public site takes /.
  redirects: async () => [
    { source: "/about", destination: "/", permanent: true },
    { source: "/settings", destination: "/app/me", permanent: true },
    {
      source: "/questions/new",
      destination: "/app/questions/generate",
      permanent: true,
    },
    {
      source: "/questions/reading/new",
      destination: "/app/questions/generate",
      permanent: true,
    },
    ...[
      "library",
      "progress",
      "me",
      "practice",
      "sets",
      "questions",
      "sync",
    ].map((segment) => ({
      source: `/${segment}/:path*`,
      destination: `/app/${segment}/:path*`,
      permanent: true,
    })),
  ],
};

export default withSerwist(nextConfig);
