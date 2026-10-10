// Tests d'intégration : ils parlent à une vraie base Postgres, celle de test.
// Lancés par `pnpm test:integration`, jamais par `pnpm test`, qui doit réussir
// sans aucune base joignable (R40 de la spécification 02).
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // Pas de DOM ici : on teste du code serveur.
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./vitest.integration.setup.ts"],
    // Par défaut, Vitest laisse Node charger les paquets de node_modules tels
    // quels, et vi.mock n'a alors aucun effet sur ce qu'ils importent. Better
    // Auth pose ses cookies en important next/headers : on le fait passer par
    // Vitest pour que le test puisse lui fournir sa boîte à cookies.
    server: { deps: { inline: [/better-auth/] } },
    // Une base distante répond moins vite qu'une fonction pure.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
