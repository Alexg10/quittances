import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Les tests d'intégration ont besoin de la base de test : ils ont leur propre
    // commande (`pnpm test:integration`) et ne tournent jamais avec `pnpm test`.
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
    passWithNoTests: true,
  },
});
