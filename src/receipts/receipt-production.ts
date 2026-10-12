// Ce que la page de production affiche pour une location (états 4 à 6 de R25 de
// la spécification 04). Fonction pure : l'instant « maintenant » et les mois qui
// ont déjà une quittance sont des paramètres.
import {
  formatMonthOption,
  getAcceptedMonths,
  getReceiptPeriod,
} from "./receipt-months";

// Une option de la liste déroulante « Mois ».
export type MonthOption = {
  // « AAAA-MM » : la valeur envoyée au serveur.
  value: string;
  // « Février 2026 », ou « Janvier 2026 (du 15/01/2026 au 31/01/2026) » (R11).
  label: string;
};

export type ProductionState =
  // Le bail commence après le mois courant : aucun mois n'est accepté (R8).
  | { kind: "lease-not-started" }
  // Tous les mois acceptés ont déjà leur quittance (R15).
  | { kind: "nothing-to-produce" }
  // Les mois encore disponibles, du plus récent au plus ancien.
  | { kind: "form"; months: MonthOption[] };

// `startDate` et `endDate` sont les dates du bail (« AAAA-MM-JJ »), `producedMonths`
// les mois (« AAAA-MM ») des quittances existantes de la location.
// Cette liste n'est qu'une aide à la saisie : à l'envoi, le serveur recontrôle
// le mois (R10) et la base garantit l'unicité (R15).
export function getProductionState(
  startDate: string,
  endDate: string | null,
  producedMonths: string[],
  now: Date,
): ProductionState {
  const acceptedMonths = getAcceptedMonths(startDate, endDate, now);
  if (acceptedMonths.length === 0) {
    return { kind: "lease-not-started" };
  }

  const availableMonths = acceptedMonths.filter(
    (month) => !producedMonths.includes(month),
  );
  if (availableMonths.length === 0) {
    return { kind: "nothing-to-produce" };
  }

  // getAcceptedMonths rend les mois du plus ancien au plus récent : on inverse
  // une copie (toReversed ne modifie pas le tableau d'origine).
  const months = availableMonths.toReversed().map((month) => ({
    value: month,
    label: formatMonthOption(
      month,
      getReceiptPeriod(month, startDate, endDate),
    ),
  }));
  return { kind: "form", months };
}
