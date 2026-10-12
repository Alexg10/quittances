// Garde-fou des écritures qui enregistrent un instant ou un jour (archivage
// d'une location, production d'une quittance). L'instant vient de l'horloge du
// serveur, par l'appelant ; il n'est jamais lu ici, pour qu'un test puisse le
// fournir.
//
// Pourquoi vérifier : `undefined` ou une date invalide ne feraient pas échouer
// le calcul du jour à Paris de façon lisible (Intl prend « maintenant » pour
// `undefined`). On échoue donc ici, avant toute requête.
export function requireInstant(now: Date): Date {
  const candidate: unknown = now;
  if (!(candidate instanceof Date) || Number.isNaN(candidate.getTime())) {
    throw new Error(
      "Accès aux données : instant manquant ou invalide. L'appelant fournit new Date().",
    );
  }
  return candidate;
}
