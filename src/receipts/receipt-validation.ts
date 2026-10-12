// Validation du formulaire de production d'une quittance (R10 à R14 de la
// spécification 04). Fonctions pures, sans base ni serveur ; l'instant « maintenant »
// est un paramètre.
//
// Les montants et la date réutilisent les règles des locations (R14, R15 et R19
// de la spécification 03) : on n'en recode aucune.
import { readTextField } from "../auth/form-state";
import { parseChargesInput, parseRentInput } from "../rentals/rental-amount";
import { getTodayInParis, parseDateInput } from "../rentals/rental-dates";
import { isRawValueTooLong } from "../rentals/rental-messages";
import type { ReceiptErrorCode, ReceiptParsed } from "./receipt-messages";
import {
  getReceiptPeriod,
  validateMonthInput,
  type ReceiptPeriod,
} from "./receipt-months";

// Les cinq champs, dans l'ordre du formulaire (R35). Ce sont aussi les attributs
// `name` des champs : l'action n'en lit pas d'autres.
export const RECEIPT_FORM_FIELDS = [
  "month",
  "rent",
  "charges",
  "paymentDate",
  "attestation",
] as const;

export type ReceiptFormField = (typeof RECEIPT_FORM_FIELDS)[number];

// Ce que le navigateur envoie : cinq chaînes, telles que saisies.
export type ReceiptFormFields = Record<ReceiptFormField, string>;

// Un code d'erreur par champ en erreur (le premier applicable).
export type ReceiptFormErrors = Partial<
  Record<ReceiptFormField, ReceiptErrorCode>
>;

// Valeur envoyée par une case cochée : celle d'une case sans attribut `value`.
// Le formulaire (T4) ne doit pas en donner une autre. Une case décochée n'envoie
// rien du tout. Toute autre valeur est traitée comme « non cochée ».
export const ATTESTATION_CHECKED_VALUE = "on";

export const EMPTY_RECEIPT_FORM_FIELDS: ReceiptFormFields = {
  month: "",
  rent: "",
  charges: "",
  paymentDate: "",
  attestation: "",
};

// Lit les cinq champs d'une requête. Un champ absent, en double ou envoyé comme
// fichier donne "" (voir readTextField) : il sera traité comme non rempli.
export function readReceiptFormFields(formData: FormData): ReceiptFormFields {
  return {
    month: readTextField(formData, "month"),
    rent: readTextField(formData, "rent"),
    charges: readTextField(formData, "charges"),
    paymentDate: readTextField(formData, "paymentDate"),
    attestation: readTextField(formData, "attestation"),
  };
}

// Ce que la validation a besoin de savoir de la location (relue en base par
// l'appelant) et de l'instant.
export type ReceiptFormContext = {
  startDate: string;
  endDate: string | null;
  now: Date;
};

// Les valeurs lues d'un formulaire valide.
export type ReceiptFormValues = {
  month: string;
  period: ReceiptPeriod;
  rentInCents: number;
  chargesInCents: number;
  // « AAAA-MM-JJ ».
  paymentDate: string;
};

export type ReceiptFormValidation =
  | { ok: true; values: ReceiptFormValues }
  | {
      ok: false;
      // Les valeurs à remettre dans les champs : telles que saisies, sauf une
      // valeur brute démesurée, réaffichée vide ; la case revient décochée (R14).
      fields: ReceiptFormFields;
      errors: ReceiptFormErrors;
    };

// R13 : obligatoire (Q4), forme et bornes de R19 de la spécification 03 (L20,
// L21), jamais postérieure au jour à Paris (Q5). Elle n'est comparée ni à la
// période ni au bail.
function parsePaymentDate(input: string, now: Date): ReceiptParsed<string> {
  if (input === "") {
    return { ok: false, error: "Q4" };
  }
  const parsed = parseDateInput(input, "start");
  if (!parsed.ok) {
    return parsed;
  }
  return parsed.value > getTodayInParis(now)
    ? { ok: false, error: "Q5" }
    : parsed;
}

// Valide tous les champs ensemble : toutes les erreurs sont renvoyées, pas
// seulement la première. Pour un même champ, l'ordre est : vide, forme, bornes,
// puis Q5 ou Q2.
export function validateReceiptForm(
  fields: ReceiptFormFields,
  context: ReceiptFormContext,
): ReceiptFormValidation {
  const month = validateMonthInput(
    fields.month,
    context.startDate,
    context.endDate,
    context.now,
  );
  const rent = parseRentInput(fields.rent);
  const charges = parseChargesInput(fields.charges);
  const paymentDate = parsePaymentDate(fields.paymentDate, context.now);
  const isAttested = fields.attestation === ATTESTATION_CHECKED_VALUE;

  if (month.ok && rent.ok && charges.ok && paymentDate.ok && isAttested) {
    return {
      ok: true,
      values: {
        month: month.value,
        period: getReceiptPeriod(
          month.value,
          context.startDate,
          context.endDate,
        ),
        rentInCents: rent.value,
        chargesInCents: charges.value,
        paymentDate: paymentDate.value,
      },
    };
  }

  const errors: ReceiptFormErrors = {};
  if (!month.ok) errors.month = month.error;
  if (!rent.ok) errors.rent = rent.error;
  if (!charges.ok) errors.charges = charges.error;
  if (!paymentDate.ok) errors.paymentDate = paymentDate.error;
  if (!isAttested) errors.attestation = "Q6";
  return { ok: false, fields: echoFields(fields), errors };
}

function echoFields(fields: ReceiptFormFields): ReceiptFormFields {
  const echo = { ...fields, attestation: "" };
  for (const field of RECEIPT_FORM_FIELDS) {
    if (isRawValueTooLong(echo[field])) {
      echo[field] = "";
    }
  }
  return echo;
}
