// Configuration de drizzle-kit pour la base de développement.
// `pnpm db:generate` compare src/db/schema.ts aux migrations existantes et écrit
// un nouveau fichier SQL dans drizzle/. `pnpm db:migrate` applique les fichiers
// qui ne l'ont pas encore été.
import { defineConfig } from "drizzle-kit";

import { loadLocalEnv, requireEnv } from "./src/env";

loadLocalEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: requireEnv("DATABASE_URL") },
});
