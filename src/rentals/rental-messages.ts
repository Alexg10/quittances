// Messages d'erreur des formulaires de location, mot pour mot ceux de la
// spécification 03 (section « Contenus », table des messages). Un seul endroit :
// la validation, les formulaires et les tests lisent les mêmes textes.
// L26 et L27 n'existent pas (supprimés de la spécification, non réattribués).
// E8 (panne) reste celui de ../auth/messages.
// Fichier pur, sans dépendance.
export const RENTAL_ERROR_MESSAGES = {
  L1: "Saisissez l'adresse du logement.",
  L2: "L'adresse ne peut pas dépasser 200 caractères.",
  L3: "Le complément d'adresse ne peut pas dépasser 100 caractères.",
  L4: "Saisissez le code postal.",
  L5: "Le code postal doit contenir 5 chiffres.",
  L6: "Saisissez la ville.",
  L7: "La ville ne peut pas dépasser 100 caractères.",
  L8: "Saisissez le nom du locataire.",
  L9: "Le nom du locataire ne peut pas dépasser 100 caractères.",
  L10: "Saisissez l'adresse e-mail du locataire.",
  L11: "Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.",
  L12: "Saisissez le loyer hors charges.",
  L13: "Saisissez un montant en euros, par exemple 850 ou 850,50.",
  L14: "Le loyer hors charges doit être supérieur à zéro.",
  L15: "Le montant ne peut pas dépasser 99 999,99 euros.",
  L16: "Saisissez le montant des charges, ou 0 s'il n'y en a pas.",
  L17: "Saisissez le jour d'échéance.",
  L18: "Le jour d'échéance doit être un nombre entier de 1 à 31.",
  L19: "Saisissez la date de début du bail.",
  L20: "Saisissez une date valide.",
  L21: "La date doit être comprise entre le 1er janvier 1950 et le 31 décembre 2099.",
  L22: "La date de début ne peut pas être postérieure à la date de fin du bail.",
  L23: "Saisissez la date de fin du bail.",
  L24: "La date de fin ne peut pas être antérieure à la date de début du bail.",
  L25: "Ce champ contient des caractères non autorisés.",
  L28: "Vous avez atteint la limite de 100 locations. Supprimez-en une pour en ajouter une autre.",
} as const;

export type RentalErrorCode = keyof typeof RENTAL_ERROR_MESSAGES;

// Résultat commun des règles de ce dossier : soit la valeur lue et normalisée,
// soit le code du premier message applicable.
export type Parsed<T> =
  { ok: true; value: T } | { ok: false; error: RentalErrorCode };

// Une valeur brute plus longue que cela est refusée sans être analysée (R10).
export const RAW_VALUE_MAX_LENGTH = 500;

// Longueur en caractères Unicode (points de code), pas en unités UTF-16 :
// "😀".length vaut 2, [..."😀"].length vaut 1.
export function countCharacters(text: string): number {
  return [...text].length;
}

export function isRawValueTooLong(input: string): boolean {
  return countCharacters(input) > RAW_VALUE_MAX_LENGTH;
}
