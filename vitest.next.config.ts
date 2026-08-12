import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/constants", replacement: fileURLToPath(new URL("./src/constants/index.ts", import.meta.url)) },
      { find: "@/lib/persist", replacement: fileURLToPath(new URL("./src/lib/persist.ts", import.meta.url)) },
      { find: "@/lib/sync-outbox", replacement: fileURLToPath(new URL("./src/lib/sync-outbox.ts", import.meta.url)) },
      { find: "@/types", replacement: fileURLToPath(new URL("./src/types/index.ts", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["tests-next/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests-next/setup.ts"],
  },
});
