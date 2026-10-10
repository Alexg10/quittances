// Exécuté avant chaque fichier de test d'intégration, dans le processus qui
// ouvrira les connexions à la base.
import { vi } from "vitest";

import { requireTestDatabaseUrl } from "./src/db/test-database";
import { loadLocalEnv } from "./src/env";

loadLocalEnv();

// Garde-fou (R40) : le code applicatif lit DATABASE_URL. On la remplace ici par
// la base de test, de sorte que la chaîne de connexion de développement n'existe
// plus dans ce processus. Si DATABASE_URL_TEST manque, l'appel échoue et aucun
// test ne s'exécute : rien ne peut partir vers la base de développement.
process.env.DATABASE_URL = requireTestDatabaseUrl(process.env);

// Le paquet `server-only` lève une erreur dès qu'il est importé hors d'un
// Server Component. Les tests s'exécutent bien côté serveur : on le neutralise.
vi.mock("server-only", () => ({}));
