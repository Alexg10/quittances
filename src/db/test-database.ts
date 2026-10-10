// Garde-fou de la base de test (R40 de la spécification 02).
// Tout ce qui lance des tests contre une base (tests d'intégration, migrations de
// la base de test, serveur des tests e2e) passe par cette fonction.

type Env = Record<string, string | undefined>;

// Renvoie la chaîne de connexion de la base de test, ou échoue.
// Elle ne se rabat jamais sur DATABASE_URL : sans base de test, pas de test.
export function requireTestDatabaseUrl(env: Env): string {
  const testUrl = env.DATABASE_URL_TEST;
  if (!testUrl) {
    throw new Error(
      "DATABASE_URL_TEST est manquante : les tests qui ont besoin d'une base ne peuvent pas démarrer. " +
        "Renseignez-la dans .env.local (voir .env.example). " +
        "La base de développement (DATABASE_URL) n'est jamais utilisée par les tests.",
    );
  }
  if (testUrl === env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL_TEST et DATABASE_URL désignent la même base : " +
        "les tests écriraient dans la base de développement. " +
        "DATABASE_URL_TEST doit pointer vers la branche Neon de test.",
    );
  }
  return testUrl;
}
