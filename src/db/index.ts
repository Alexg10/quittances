// Accès à la base de données, réservé au serveur. Importer ce module depuis un
// Client Component fait échouer le build : la chaîne de connexion ne peut pas
// se retrouver dans le JavaScript envoyé au navigateur.
import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireEnv } from "../env";
import * as schema from "./schema";

// Le pool est gardé sur globalThis : en développement, le rechargement à chaud
// réévalue ce module à chaque modification, et chaque évaluation ouvrirait sinon
// un nouveau pool de connexions sans fermer le précédent.
declare global {
  var pgPool: Pool | undefined;
}

// Délai accordé à la base pour ouvrir une connexion, puis pour répondre à une
// requête. Cinq secondes : une base Neon mise en veille met une à deux secondes
// à se réveiller, et ne doit pas être prise pour une base en panne.
const DATABASE_TIMEOUT_IN_MS = 5_000;

function getPool(): Pool {
  // Créer un Pool n'ouvre aucune connexion : la première part à la première requête.
  globalThis.pgPool ??= new Pool({
    connectionString: requireEnv("DATABASE_URL"),
    // Sans ces deux délais, une base qui accepte la connexion mais ne répond
    // jamais ferait attendre la page indéfiniment. Passé le délai, `pg` lève
    // une erreur, traitée comme toute panne de base (R24).
    connectionTimeoutMillis: DATABASE_TIMEOUT_IN_MS,
    query_timeout: DATABASE_TIMEOUT_IN_MS,
  });
  return globalThis.pgPool;
}

// Une fonction plutôt qu'une constante exportée : rien n'est lu ni vérifié à
// l'import du module. `pnpm build` importe les modules des routes sans exécuter
// de requête ; il ne doit donc exiger ni base joignable ni DATABASE_URL.
export function getDb() {
  return drizzle({ client: getPool(), schema });
}

// Pour les scripts et les tests, qui doivent fermer les connexions pour se terminer.
export async function closeDb(): Promise<void> {
  await globalThis.pgPool?.end();
  globalThis.pgPool = undefined;
}
