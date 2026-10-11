// Montants des locations (R14, R15, R16 de la spécification 03).
// Un montant est toujours un nombre entier de centimes. Aucun calcul en virgule
// flottante : la saisie est lue chiffre par chiffre, jamais avec
// `parseFloat(x) * 100`, qui peut donner 1.005 * 100 = 100.49999999999999.
import { isRawValueTooLong, type Parsed } from "./rental-messages";

export const RENT_MAX_IN_CENTS = 9_999_999;
export const CHARGES_MAX_IN_CENTS = 9_999_999;
export const RENT_MIN_IN_CENTS = 1;

// Forme de R15, une fois les espaces de bord et le « € » final retirés.
// \d, sans l'indicateur « u », ne reconnaît que les chiffres ASCII.
//  - partie entière : « 0 », ou des chiffres sans zéro initial, ou un groupe de
//    1 à 3 chiffres suivi de groupes de 3 séparés par une espace (ordinaire,
//    insécable U+00A0 ou fine insécable U+202F) ;
//  - partie décimale facultative : « , » ou « . » puis 1 ou 2 chiffres.
const AMOUNT_PATTERN =
  /^(0|[1-9]\d*|[1-9]\d{0,2}(?:[   ]\d{3})+)(?:[,.](\d{1,2}))?$/;

type AmountRules = {
  // Code renvoyé pour un champ vide.
  emptyError: "L12" | "L16";
  // Plus petite valeur permise, en centimes.
  minInCents: number;
  // Code renvoyé si la valeur est inférieure au minimum (zéro refusé).
  belowMinError: "L14" | null;
  maxInCents: number;
};

function parseAmount(input: string, rules: AmountRules): Parsed<number> {
  // `trim` retire tous les types d'espaces, insécables compris.
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: false, error: rules.emptyError };
  }
  if (isRawValueTooLong(input)) {
    return { ok: false, error: "L13" };
  }
  // Un seul « € » final, précédé ou non d'espaces. Un second reste dans le
  // texte et fait échouer le motif.
  const withoutSymbol = trimmed.replace(/\s*€$/, "");
  const match = AMOUNT_PATTERN.exec(withoutSymbol);
  if (match === null) {
    return { ok: false, error: "L13" };
  }
  const [, integerPart, decimalPart = ""] = match;
  // « 1 250 » -> « 1250 » ; « 5 » -> « 50 » ; « 5,05 » -> « 505 » : on assemble
  // des chiffres, on ne multiplie rien.
  const digits = integerPart.replace(/[   ]/g, "") + decimalPart.padEnd(2, "0");
  // Au-delà de 15 chiffres, Number perdrait de la précision ; la valeur est de
  // toute façon hors bornes.
  const cents = digits.length > 15 ? Infinity : Number(digits);

  if (cents < rules.minInCents && rules.belowMinError !== null) {
    return { ok: false, error: rules.belowMinError };
  }
  if (cents > rules.maxInCents) {
    return { ok: false, error: "L15" };
  }
  return { ok: true, value: cents };
}

// Loyer hors charges : de 0,01 € à 99 999,99 €. Vide L12, zéro L14.
export function parseRentInput(input: string): Parsed<number> {
  return parseAmount(input, {
    emptyError: "L12",
    minInCents: RENT_MIN_IN_CENTS,
    belowMinError: "L14",
    maxInCents: RENT_MAX_IN_CENTS,
  });
}

// Charges : de 0 € à 99 999,99 €. Vide L16, zéro accepté.
export function parseChargesInput(input: string): Parsed<number> {
  return parseAmount(input, {
    emptyError: "L16",
    minInCents: 0,
    belowMinError: null,
    maxInCents: CHARGES_MAX_IN_CENTS,
  });
}

// Total charges comprises (R14) : une somme d'entiers, jamais enregistrée.
export function totalInCents(rentInCents: number, chargesInCents: number) {
  return rentInCents + chargesInCents;
}

// Partie commune de l'affichage et du préremplissage : « 125050 » -> les euros
// et les centimes sous forme de deux chaînes.
function splitCents(cents: number): { euros: string; cents: string } {
  const euros = Math.floor(cents / 100);
  return {
    euros: String(euros),
    cents: String(cents % 100).padStart(2, "0"),
  };
}

const THIN_NO_BREAK_SPACE = " ";
const NO_BREAK_SPACE = " ";

// Affichage (R16) : « 1 250,50 € » avec une espace fine insécable (U+202F) entre
// les milliers et une espace insécable (U+00A0) avant « € », pour qu'un montant
// ne se coupe jamais sur deux lignes. Écrit à la main plutôt qu'avec
// Intl.NumberFormat, dont les espaces varient selon la version d'ICU.
export function formatAmount(cents: number): string {
  const parts = splitCents(cents);
  // Insère une espace avant chaque groupe de 3 chiffres restant jusqu'à la fin,
  // sauf en tête de nombre (\B : position qui n'est pas une frontière de mot).
  const euros = parts.euros.replace(/\B(?=(\d{3})+$)/g, THIN_NO_BREAK_SPACE);
  return `${euros},${parts.cents}${NO_BREAK_SPACE}€`;
}

// Valeur d'un champ de formulaire prérempli (R16) : « 1250,50 », sans milliers
// ni symbole. Cette forme est acceptée par parseRentInput et parseChargesInput.
export function formatAmountForInput(cents: number): string {
  const parts = splitCents(cents);
  return `${parts.euros},${parts.cents}`;
}
