import { defineConfig, devices } from "@playwright/test";

import { requireTestDatabaseUrl } from "./src/db/test-database";
import { loadLocalEnv } from "./src/env";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Garde-fou (R40 de la spécification 02) : le serveur des tests e2e ne parle
// qu'à la base de test. Sans DATABASE_URL_TEST, le lancement échoue ici, avant
// tout build : il ne se rabat jamais sur la base de développement.
loadLocalEnv();
const testDatabaseUrl = requireTestDatabaseUrl(process.env);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "bureau", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Les tests tournent contre le build de production, comme ce que verra l'utilisateur.
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    // Ces variables s'ajoutent à l'environnement du processus et priment sur
    // .env.local, que Next ne lit que pour les variables encore non définies.
    env: {
      // Le code applicatif lit DATABASE_URL : ici, c'est la base de test.
      DATABASE_URL: testDatabaseUrl,
      // L'application est servie sur le port 3100 pendant les tests e2e.
      BETTER_AUTH_URL: baseURL,
    },
    // Jamais de serveur réutilisé : les tests écrivent en base, et un serveur
    // déjà lancé sur ce port pourrait être branché sur la base de développement.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
