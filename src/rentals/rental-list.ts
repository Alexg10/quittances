// Répartition des locations pour le tableau de bord (R35 de la spécification 03).
// Fonction pure : la date du jour est un paramètre, comme pour getRentalStatus.
import { getRentalStatus } from "./rental-dates";
import type { Rental } from "./rental-store";

export type EndedRental = Rental & { endDate: string };

export type SplitRentals = {
  ongoing: Rental[];
  ended: EndedRental[];
};

// `rentals` arrive dans l'ordre de création (listRentals). Les locations en
// cours le gardent. Les terminées passent par date de fin décroissante, puis par
// date de création (la plus ancienne d'abord, comme les locations en cours).
export function splitRentals(rentals: Rental[], today: string): SplitRentals {
  const ongoing: Rental[] = [];
  const ended: EndedRental[] = [];

  for (const rental of rentals) {
    // Le test sur endDate rétrécit le type pour TypeScript ; getRentalStatus
    // reste la seule règle de statut.
    if (rental.endDate !== null && getRentalStatus(rental.endDate, today) === "ended") {
      ended.push({ ...rental, endDate: rental.endDate });
    } else {
      ongoing.push(rental);
    }
  }

  ended.sort(
    (a, b) =>
      b.endDate.localeCompare(a.endDate) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return { ongoing, ended };
}
