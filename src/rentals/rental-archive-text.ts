// Textes de l'archivage qui dépendent d'une valeur (R40, R41 et « Contenus » de
// la spécification 04) : la date d'archivage et le nombre de quittances.
// Fonctions pures, sans dépendance serveur : aucune ne lit l'horloge.
import { formatDate, getTodayInParis } from "./rental-dates";

// La date d'archivage est un instant (R40). On l'affiche comme le jour qu'il
// était à Europe/Paris à cet instant, sous la forme « JJ/MM/AAAA » : une
// location archivée le 31 octobre à 23:30 UTC l'a été le 1er novembre à Paris.
// getTodayInParis porte mal son nom ici : elle rend le jour à Paris de
// n'importe quel instant, pas seulement de maintenant.
export function formatArchiveDate(archivedAt: Date): string {
  return formatDate(getTodayInParis(archivedAt));
}

// Nombre de quittances d'une ligne de la page « Archives » (R41).
export function formatReceiptCount(count: number): string {
  if (count === 0) {
    return "Aucune quittance";
  }
  return count === 1 ? "1 quittance" : `${count} quittances`;
}

// Phrase de la page de suppression d'une location archivée (« Contenus ») :
// elle annonce ce qui disparaîtra avec la location. null sans quittance : la
// page n'affiche alors aucune phrase.
export function getDeletionReceiptSentence(count: number): string | null {
  if (count === 0) {
    return null;
  }
  return count === 1
    ? "Cette location a 1 quittance. Elle sera supprimée avec la location."
    : `Cette location a ${count} quittances. Elles seront supprimées avec la location.`;
}
