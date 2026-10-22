import { fileURLToPath } from "node:url";
import { serwist } from "@serwist/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { webManifest } from "./app/manifest.ts";

const path = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));

/** The import paths tsconfig.json names, shared with the test runner. */
export const aliases = [
  { find: "@/generated", replacement: path("./src/generated") },
  { find: "@/constants", replacement: path("./src/constants") },
  { find: "@/lib/persist", replacement: path("./src/lib/persist.ts") },
  { find: "@/types", replacement: path("./src/types") },
  { find: "@", replacement: path(".") },
];

/**
 * The browser code reads its configuration as `process.env.NEXT_PUBLIC_*`, the
 * names the deployment already provides, so each one is written into the
 * bundle where it is read. A name left unset reads as undefined, as it did.
 */
function publicEnvironment(mode: string) {
  const env = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_");
  return Object.fromEntries([
    ["process.env", "{}"],
    [
      "process.env.NODE_ENV",
      JSON.stringify(mode === "production" ? "production" : "development"),
    ],
    ...Object.entries(env).map(([name, value]) => [
      `process.env.${name}`,
      JSON.stringify(value),
    ]),
  ]);
}

/** Serves the web app manifest and page description from the app's own copy. */
function appIdentity(): Plugin {
  const fileName = "manifest.webmanifest";
  const source = JSON.stringify(webManifest, null, 2);
  return {
    name: "lexiro:identity",
    transformIndexHtml: (html) =>
      html.replace("%LEXIRO_DESCRIPTION%", webManifest.description),
    configureServer(server) {
      server.middlewares.use(`/${fileName}`, (_request, response) => {
        response.setHeader("content-type", "application/manifest+json");
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName, source });
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: publicEnvironment(mode),
  resolve: { alias: aliases },
  server: { host: "0.0.0.0", port: 3000 },
  // Screens load lazily, so name them all up front: otherwise the first visit
  // to a screen with a new dependency re-bundles dependencies and reloads.
  optimizeDeps: {
    entries: ["index.html", "app/**/*.tsx", "components/**/*.tsx"],
  },
  preview: { port: 3000 },
  plugins: [
    react(),
    tailwindcss(),
    appIdentity(),
    serwist({
      swSrc: "app/sw.ts",
      swDest: "sw.js",
      globDirectory: "dist",
      // The app shell and every screen's code, so a screen never opened
      // before still works offline. Fonts and images fill in at runtime.
      globPatterns: ["**/*.{js,css,html}", "icons/*.png"],
      injectionPoint: "self.__SW_MANIFEST",
      rollupFormat: "iife",
    }),
  ],
}));
