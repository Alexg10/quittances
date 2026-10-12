// Validation du formulaire « Mes informations » (R1 de la spécification 04).
// Mêmes règles de normalisation, de longueur et de caractères refusés que celles
// des locations (R10, R11, R12 de la spécification 03) : on appelle leurs
// fonctions et on ne change que les codes d'erreur propres au bailleur (B1 à B3).
// Fonctions pures, sans base ni serveur.
import { readTextField } from "../auth/form-state";
import { isRawValueTooLong } from "../rentals/rental-messages";
import {
  parseAddressComplementInput,
  parseAddressInput,
  parseCityInput,
  parsePostalCodeInput,
  parseTenantNameInput,
} from "../rentals/rental-text";
import type {
  ReceiptErrorCode,
  ReceiptParsed,
} from "./receipt-messages";

// Les cinq champs, dans l'ordre du formulaire. Ce sont aussi les attributs `name`
// des champs : l'action n'en lit pas d'autres.
export const LANDLORD_FORM_FIELDS = [
  "name",
  "address",
  "addressComplement",
  "postalCode",
  "city",
] as const;

export type LandlordFormField = (typeof LANDLORD_FORM_FIELDS)[number];

// Ce que le navigateur envoie : cinq chaînes, telles que saisies.
export type LandlordFormFields = Record<LandlordFormField, string>;

// Un code d'erreur par champ en erreur (le premier applicable).
export type LandlordFormErrors = Partial<
  Record<LandlordFormField, ReceiptErrorCode>
>;

// Les informations du bailleur, normalisées (R1) : complètes, ou absentes.
export type LandlordValues = {
  name: string;
  address: string;
  // null quand il n'y a pas de complément, jamais une chaîne vide.
  addressComplement: string | null;
  postalCode: string;
  city: string;
};

export const EMPTY_LANDLORD_FORM_FIELDS: LandlordFormFields = {
  name: "",
  address: "",
  addressComplement: "",
  postalCode: "",
  city: "",
};

// Lit les cinq champs d'une requête. Un champ absent, en double ou envoyé comme
// fichier donne "" (voir readTextField) : il sera traité comme non rempli.
export function readLandlordFormFields(formData: FormData): LandlordFormFields {
  return {
    name: readTextField(formData, "name"),
    address: readTextField(formData, "address"),
    addressComplement: readTextField(formData, "addressComplement"),
    postalCode: readTextField(formData, "postalCode"),
    city: readTextField(formData, "city"),
  };
}

export type LandlordFormValidation =
  | { ok: true; values: LandlordValues }
  | {
      ok: false;
      // Les valeurs à remettre dans les champs : telles que saisies, sauf une
      // valeur brute démesurée, réaffichée vide.
      fields: LandlordFormFields;
      errors: LandlordFormErrors;
    };

// Nom du bailleur : mêmes bornes que le nom d'un locataire (1 à 100 caractères),
// avec les messages B1 et B2 à la place de L8 et L9.
function parseLandlordName(input: string): ReceiptParsed<string> {
  const parsed = parseTenantNameInput(input);
  if (parsed.ok) {
    return parsed;
  }
  if (parsed.error === "L8") {
    return { ok: false, error: "B1" };
  }
  if (parsed.error === "L9") {
    return { ok: false, error: "B2" };
  }
  return parsed;
}

// Adresse du bailleur : mêmes bornes que l'adresse d'un logement, avec B3 à la
// place de L1 quand elle est vide.
function parseLandlordAddress(input: string): ReceiptParsed<string> {
  const parsed = parseAddressInput(input);
  return !parsed.ok && parsed.error === "L1"
    ? { ok: false, error: "B3" }
    : parsed;
}

// Valide les cinq champs ensemble : toutes les erreurs sont renvoyées.
export function validateLandlordForm(
  fields: LandlordFormFields,
): LandlordFormValidation {
  const name = parseLandlordName(fields.name);
  const address = parseLandlordAddress(fields.address);
  const addressComplement = parseAddressComplementInput(
    fields.addressComplement,
  );
  const postalCode = parsePostalCodeInput(fields.postalCode);
  const city = parseCityInput(fields.city);

  if (
    name.ok &&
    address.ok &&
    addressComplement.ok &&
    postalCode.ok &&
    city.ok
  ) {
    return {
      ok: true,
      values: {
        name: name.value,
        address: address.value,
        addressComplement:
          addressComplement.value === "" ? null : addressComplement.value,
        postalCode: postalCode.value,
        city: city.value,
      },
    };
  }

  const errors: LandlordFormErrors = {};
  if (!name.ok) errors.name = name.error;
  if (!address.ok) errors.address = address.error;
  if (!addressComplement.ok) errors.addressComplement = addressComplement.error;
  if (!postalCode.ok) errors.postalCode = postalCode.error;
  if (!city.ok) errors.city = city.error;
  return { ok: false, fields: echoFields(fields), errors };
}

function echoFields(fields: LandlordFormFields): LandlordFormFields {
  const echo = { ...fields };
  for (const field of LANDLORD_FORM_FIELDS) {
    if (isRawValueTooLong(echo[field])) {
      echo[field] = "";
    }
  }
  return echo;
}
