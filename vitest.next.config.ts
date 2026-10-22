import { defineConfig } from "vitest/config";

import { aliases } from "./vite.config.ts";

export default defineConfig({
  resolve: { alias: aliases },
  test: {
    environment: "jsdom",
    include: ["tests-next/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests-next/setup.ts"],
  },
});
