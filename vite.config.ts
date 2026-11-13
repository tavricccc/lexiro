/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { serwist } from "@serwist/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv, type Plugin } from "vite";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

const manifest = {
  name: "Lexiro",
  short_name: "Lexiro",
  description: "用自己的單字集練習英文：意思、拼字、詞彙題與篇章題。",
  start_url: "/app",
  scope: "/",
  display: "standalone",
  background_color: "#eef3f0",
  theme_color: "#eef3f0",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

/** Serves /manifest.webmanifest in development and writes it into the build. */
function webManifest(): Plugin {
  const source = JSON.stringify(manifest, null, 2);
  return {
    name: "lexiro:manifest",
    transformIndexHtml: (html) => html.replace("%LEXIRO_DESCRIPTION%", manifest.description),
    configureServer(server) {
      server.middlewares.use("/manifest.webmanifest", (_request, response) => {
        response.setHeader("content-type", "application/manifest+json");
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source });
    },
  };
}

/**
 * Deployment provides the browser configuration as NEXT_PUBLIC_* variables;
 * each is written into the bundle as `import.meta.env.NEXT_PUBLIC_*`.
 */
export default defineConfig(({ mode }) => ({
  envPrefix: "NEXT_PUBLIC_",
  define: {
    "import.meta.env.NEXT_PUBLIC_MODE": JSON.stringify(mode),
    __APP_VERSION__: JSON.stringify((JSON.parse(readFileSync(path("package.json"), "utf8")) as { version: string }).version),
  },
  resolve: {
    alias: [
      { find: "@lexiro/contract", replacement: path("./packages/contract/src/index.ts") },
      { find: "design-kit/styles.css", replacement: path("./packages/design-kit/src/styles/index.css") },
      { find: "design-kit", replacement: path("./packages/design-kit/src/index.ts") },
      { find: "@", replacement: path("./src") },
    ],
  },
  server: { host: "0.0.0.0", port: 3000 },
  preview: { port: 3000 },
  plugins: [
    react(),
    tailwindcss(),
    webManifest(),
    serwist({
      swSrc: "src/sw.ts",
      swDest: "sw.js",
      globDirectory: "dist",
      // The shell and every screen's code, so a screen never opened before still opens offline.
      globPatterns: ["**/*.{js,css,html}", "icons/*.png", "fonts/*.ttf"],
      injectionPoint: "self.__SW_MANIFEST",
      rollupFormat: "iife",
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    env: loadEnv("test", process.cwd(), "NEXT_PUBLIC_"),
  },
}));
