// Validation d'ensemble du formulaire de location (R10 de la spécification 03).
// Fonctions pures, sans base ni serveur : utilisables par les actions (T5, T6) et
// par le formulaire (T4).
import { readTextField } from "../auth/form-state";
import {
  formatAmountForInput,
  parseChargesInput,
  parseRentInput,
} from "./rental-amount";
import {
  checkStartAgainstEnd,
  parseDateInput,
  parseEndDateInput,
} from "./rental-dates";
import { parseDueDayInput } from "./rental-due-day";
import {
  isRawValueTooLong,
  RENTAL_ERROR_MESSAGES,
  type Parsed,
  type RentalErrorCode,
} from "./rental-messages";
import {
  parseAddressComplementInput,
  parseAddressInput,
  parseCityInput,
  parsePostalCodeInput,
  parseTenantEmailInput,
  parseTenantNameInput,
} from "./rental-text";
import type { RentalValues } from "./rental-store";

// Les dix champs, dans l'ordre du formulaire (R33). Ce sont aussi les attributs
// `name` des champs : l'action n'en lit pas d'autres (R7).
export const RENTAL_FORM_FIELDS = [
  "address",
  "addressComplement",
  "postalCode",
  "city",
  "tenantName",
  "tenantEmail",
  "rent",
  "charges",
  "dueDay",
  "startDate",
] as const;

export type RentalFormField = (typeof RENTAL_FORM_FIELDS)[number];

// Ce que le navigateur envoie : dix chaînes, telles que saisies.
export type RentalFormFields = Record<RentalFormField, string>;

// Un code d'erreur par champ en erreur (le premier applicable, R10).
export type RentalFormErrors = Partial<
  Record<RentalFormField, RentalErrorCode>
>;

export const EMPTY_RENTAL_FORM_FIELDS: RentalFormFields = {
  address: "",
  addressComplement: "",
  postalCode: "",
  city: "",
  tenantName: "",
  tenantEmail: "",
  rent: "",
  charges: "",
  dueDay: "",
  startDate: "",
};

// Lit les dix champs d'une requête. Un champ absent, en double ou envoyé comme
// fichier donne "" (voir readTextField) : il sera traité comme non rempli.
export function readRentalFormFields(formData: FormData): RentalFormFields {
  return {
    address: readTextField(formData, "address"),
    addressComplement: readTextField(formData, "addressComplement"),
    postalCode: readTextField(formData, "postalCode"),
    city: readTextField(formData, "city"),
    tenantName: readTextField(formData, "tenantName"),
    tenantEmail: readTextField(formData, "tenantEmail"),
    rent: readTextField(formData, "rent"),
    charges: readTextField(formData, "charges"),
    dueDay: readTextField(formData, "dueDay"),
    startDate: readTextField(formData, "startDate"),
  };
}

export type RentalFormValidation =
  | { ok: true; values: RentalValues }
  | {
      ok: false;
      // Les valeurs à remettre dans les champs : telles que saisies, sauf une
      // valeur brute démesurée, réaffichée vide (R10).
      fields: RentalFormFields;
      errors: RentalFormErrors;
    };

type ValidateOptions = {
  // Date de fin déjà enregistrée (modification, R22). Absente à la création.
  existingEndDate?: string | null;
};

// Valide tous les champs ensemble : toutes les erreurs sont renvoyées, pas
// seulement la première.
export function validateRentalForm(
  fields: RentalFormFields,
  options: ValidateOptions = {},
): RentalFormValidation {
  const errors: RentalFormErrors = {};

  // Enregistre l'erreur d'un champ et renvoie la valeur lue (ou undefined).
  function collect<T>(
    field: RentalFormField,
    parsed: Parsed<T>,
  ): T | undefined {
    if (parsed.ok) {
      return parsed.value;
    }
    errors[field] = parsed.error;
    return undefined;
  }

  const address = collect("address", parseAddressInput(fields.address));
  const addressComplement = collect(
    "addressComplement",
    parseAddressComplementInput(fields.addressComplement),
  );
  const postalCode = collect(
    "postalCode",
    parsePostalCodeInput(fields.postalCode),
  );
  const city = collect("city", parseCityInput(fields.city));
  const tenantName = collect(
    "tenantName",
    parseTenantNameInput(fields.tenantName),
  );
  const tenantEmail = collect(
    "tenantEmail",
    parseTenantEmailInput(fields.tenantEmail),
  );
  const rentInCents = collect("rent", parseRentInput(fields.rent));
  const chargesInCents = collect("charges", parseChargesInput(fields.charges));
  const dueDay = collect("dueDay", parseDueDayInput(fields.dueDay));
  const startDate = collect(
    "startDate",
    parseDateInput(fields.startDate, "start"),
  );

  // R22 : la cohérence avec la date de fin n'a de sens que pour une date valide.
  if (startDate !== undefined) {
    const mismatch = checkStartAgainstEnd(
      startDate,
      options.existingEndDate ?? null,
    );
    if (mismatch !== null) {
      errors.startDate = mismatch;
    }
  }

  if (
    Object.keys(errors).length > 0 ||
    address === undefined ||
    addressComplement === undefined ||
    postalCode === undefined ||
    city === undefined ||
    tenantName === undefined ||
    tenantEmail === undefined ||
    rentInCents === undefined ||
    chargesInCents === undefined ||
    dueDay === undefined ||
    startDate === undefined
  ) {
    return { ok: false, fields: echoFields(fields), errors };
  }

  return {
    ok: true,
    values: {
      address,
      addressComplement: addressComplement === "" ? null : addressComplement,
      postalCode,
      city,
      tenantName,
      tenantEmail,
      rentInCents,
      chargesInCents,
      dueDay,
      startDate,
    },
  };
}

function echoFields(fields: RentalFormFields): RentalFormFields {
  const echo = { ...fields };
  for (const field of RENTAL_FORM_FIELDS) {
    if (isRawValueTooLong(echo[field])) {
      echo[field] = "";
    }
  }
  return echo;
}

// Formulaire de date de fin (R21). Renvoie la date à enregistrer, ou le code
// d'erreur (L23, L20, L21, L24) avec la valeur à réafficher.
export type EndDateValidation =
  | { ok: true; endDate: string }
  | { ok: false; field: string; error: RentalErrorCode };

export function validateEndDate(
  input: string,
  startDate: string,
): EndDateValidation {
  const parsed = parseEndDateInput(input, startDate);
  if (parsed.ok) {
    return { ok: true, endDate: parsed.value };
  }
  return {
    ok: false,
    // Une valeur brute démesurée est réaffichée vide (R10).
    field: isRawValueTooLong(input) ? "" : input,
    error: parsed.error,
  };
}

// Texte d'un code d'erreur, pour un état de formulaire.
export function rentalErrorMessage(code: RentalErrorCode): string {
  return RENTAL_ERROR_MESSAGES[code];
}

// Valeurs enregistrées -> valeurs de départ du formulaire de modification (R16,
// R32). La date de début est déjà au format du champ de date.
export function toRentalFormFields(values: RentalValues): RentalFormFields {
  return {
    address: values.address,
    addressComplement: values.addressComplement ?? "",
    postalCode: values.postalCode,
    city: values.city,
    tenantName: values.tenantName,
    tenantEmail: values.tenantEmail,
    rent: formatAmountForInput(values.rentInCents),
    charges: formatAmountForInput(values.chargesInCents),
    dueDay: String(values.dueDay),
    startDate: values.startDate,
  };
}
