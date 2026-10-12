// Référence et nom de fichier d'une quittance (R16 et R32 de la spécification 04).
// Fonctions pures. Ni l'une ni l'autre ne contient un texte saisi : elles ne
// sont construites qu'à partir du mois et de l'identifiant.
import { isRentalId } from "../rentals/rental-id";
import { isMonth } from "./receipt-months";

// Les huit premiers caractères hexadécimaux de l'identifiant. Une valeur qui n'a
// pas la forme attendue est une erreur de programmation (l'identifiant vient de
// la base, pas de la requête) : on l'écarte plutôt que de fabriquer un nom de
// fichier qui sortirait de l'alphabet de R32.
function shortId(id: string, month: string): string {
  if (!isRentalId(id) || !isMonth(month)) {
    throw new RangeError("Identifiant ou mois de quittance mal formé.");
  }
  return id.slice(0, 8);
}

// R16 : `3f9a1c2e-…` et `2026-10` -> `2026-10-3F9A1C2E`.
export function getReceiptReference(id: string, month: string): string {
  return `${month}-${shortId(id, month).toUpperCase()}`;
}

// R32 : `quittance-2026-10-3f9a1c2e.pdf`. Seulement a à z, chiffres, tirets, point.
export function getReceiptFileName(id: string, month: string): string {
  return `quittance-${month}-${shortId(id, month)}.pdf`;
}
