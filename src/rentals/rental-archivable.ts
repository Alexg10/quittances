// Quelles locations peuvent être archivées (R39 de la spécification 04).
// Fonction pure : l'instant est un paramètre, la date du jour vient du serveur.
import { getRentalStatus, getTodayInParis } from "./rental-dates";

// Seule une location « Terminée » peut être archivée : sa date de fin existe et
// est strictement antérieure à la date du jour à Europe/Paris (le dernier jour du
// bail est inclus). On réutilise getRentalStatus plutôt que de recoder la règle.
export function isRentalArchivable(endDate: string | null, now: Date): boolean {
  return getRentalStatus(endDate, getTodayInParis(now)) === "ended";
}
