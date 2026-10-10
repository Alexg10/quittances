// Configuration de drizzle-kit pour la base de test (`pnpm db:migrate:test`).
// Mêmes migrations que la base de développement, autre chaîne de connexion.
import { defineConfig } from "drizzle-kit";

import { requireTestDatabaseUrl } from "./src/db/test-database";
import { loadLocalEnv } from "./src/env";

loadLocalEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: requireTestDatabaseUrl(process.env) },
});
