// Lecture des variables d'environnement, utilisable aussi hors de Next
// (drizzle-kit, Vitest, Playwright) : ce fichier n'importe rien du framework.

// Renvoie la valeur d'une variable obligatoire, ou échoue en la nommant.
// Le message ne contient jamais de valeur : il peut finir dans un journal.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement ${name} manquante. Voir .env.example.`,
    );
  }
  return value;
}

// Next charge .env.local tout seul. Les autres outils ne le font pas, et Vitest
// (NODE_ENV=test) l'ignore même volontairement. On le charge donc explicitement.
// process.loadEnvFile ne remplace jamais une variable déjà définie : ce qui est
// passé en ligne de commande ou par la CI garde la priorité.
export function loadLocalEnv(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Fichier absent (CI, par exemple) : les variables viennent de l'environnement.
  }
}
