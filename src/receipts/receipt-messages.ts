// Messages d'erreur propres aux quittances, mot pour mot ceux de la spécification
// 04 (section « Contenus », table des messages). Les messages L2 à L7, L12 à L16,
// L20, L21 et L25 sont ceux de la spécification 03 (../rentals/rental-messages) ;
// E8 (panne) est celui de ../auth/messages.
// Fichier pur, sans dépendance serveur.
import {
  RENTAL_ERROR_MESSAGES,
  type RentalErrorCode,
} from "../rentals/rental-messages";

export const RECEIPT_ERROR_MESSAGES = {
  B1: "Saisissez le nom du bailleur.",
  B2: "Le nom du bailleur ne peut pas dépasser 100 caractères.",
  B3: "Saisissez votre adresse.",
  Q1: "Choisissez un mois.",
  Q2: "Ce mois ne peut pas faire l'objet d'une quittance pour cette location.",
  Q3: "Une quittance existe déjà pour ce mois. Supprimez-la depuis la page de la location pour en produire une nouvelle.",
  Q4: "Saisissez la date du paiement.",
  Q5: "La date du paiement ne peut pas être dans le futur.",
  Q6: "Cochez la case pour confirmer que le loyer et les charges ont été reçus en totalité.",
  Q7: "Renseignez vos informations de bailleur avant de produire une quittance.",
  Q8: "Le nom du locataire ou l'adresse du logement contient des caractères que la quittance ne peut pas afficher. Modifiez la location puis réessayez.",
  Q9: "Vos informations de bailleur contiennent des caractères que la quittance ne peut pas afficher. Modifiez-les puis réessayez.",
} as const;

type ReceiptOnlyCode = keyof typeof RECEIPT_ERROR_MESSAGES;

// Tous les codes qu'un formulaire de ce dossier peut rendre : ceux des locations
// (L…) et ceux des quittances (B…, Q…).
export type ReceiptErrorCode = RentalErrorCode | ReceiptOnlyCode;

// Même forme que `Parsed` des locations, avec les codes en plus. Un `Parsed<T>`
// des locations est un `ReceiptParsed<T>` valide : son code d'erreur est un cas
// particulier de celui-ci.
export type ReceiptParsed<T> =
  { ok: true; value: T } | { ok: false; error: ReceiptErrorCode };

// Garde de type : après `isReceiptOnlyCode(code)`, TypeScript sait que `code` est
// un code de cette spécification et non de la 03.
function isReceiptOnlyCode(code: ReceiptErrorCode): code is ReceiptOnlyCode {
  return code in RECEIPT_ERROR_MESSAGES;
}

// Texte d'un code d'erreur, pour un état de formulaire.
export function receiptErrorMessage(code: ReceiptErrorCode): string {
  return isReceiptOnlyCode(code)
    ? RECEIPT_ERROR_MESSAGES[code]
    : RENTAL_ERROR_MESSAGES[code];
}
