import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config mínima e independente da config Vite do Lovable: só o alias `@` e o
// ambiente node. Os testes cobrem lógica pura (Core + Domain), sem DOM.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
