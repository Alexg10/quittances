// Textes, code postal et adresse e-mail du locataire (R11, R12, R13 de la
// spécification 03). Fonctions pures.
import { validateSignUpEmail } from "../auth/sign-up-validation";
import {
  countCharacters,
  isRawValueTooLong,
  type Parsed,
} from "./rental-messages";

// R11, dans l'ordre : normalisation Unicode NFC, toute suite d'espaces (espace,
// tabulation, saut de ligne, insécable…) devient une espace ordinaire, puis les
// espaces de bord sont retirées. `\s` couvre tous ces types d'espaces.
export function normalizeText(input: string): string {
  return input.normalize("NFC").replace(/\s+/g, " ").trim();
}

// Caractères de contrôle (catégorie Unicode Cc, dont le nul) et caractères de
// direction du texte (U+202A à U+202E, U+2066 à U+2069), qui permettent de
// faire afficher un texte à l'envers. L'indicateur « u » active \p{…}.
const FORBIDDEN_CHARACTERS = /[\p{Cc}‪-‮⁦-⁩]/u;

type TextRules = {
  // null : le champ est facultatif, vide est accepté (valeur "").
  emptyError: "L1" | "L6" | "L8" | null;
  maxLength: number;
  tooLongError: "L2" | "L3" | "L7" | "L9";
};

function parseText(input: string, rules: TextRules): Parsed<string> {
  // R10 : une valeur brute démesurée n'est pas analysée.
  if (isRawValueTooLong(input)) {
    return { ok: false, error: rules.tooLongError };
  }
  const value = normalizeText(input);
  if (value === "") {
    return rules.emptyError === null
      ? { ok: true, value }
      : { ok: false, error: rules.emptyError };
  }
  if (FORBIDDEN_CHARACTERS.test(value)) {
    return { ok: false, error: "L25" };
  }
  if (countCharacters(value) > rules.maxLength) {
    return { ok: false, error: rules.tooLongError };
  }
  return { ok: true, value };
}

export function parseAddressInput(input: string): Parsed<string> {
  return parseText(input, {
    emptyError: "L1",
    maxLength: 200,
    tooLongError: "L2",
  });
}

// Le complément est facultatif : vide donne la valeur "" (l'appelant en fait null).
export function parseAddressComplementInput(input: string): Parsed<string> {
  return parseText(input, {
    emptyError: null,
    maxLength: 100,
    tooLongError: "L3",
  });
}

export function parseCityInput(input: string): Parsed<string> {
  return parseText(input, {
    emptyError: "L6",
    maxLength: 100,
    tooLongError: "L7",
  });
}

export function parseTenantNameInput(input: string): Parsed<string> {
  return parseText(input, {
    emptyError: "L8",
    maxLength: 100,
    tooLongError: "L9",
  });
}

// R12 : toutes les espaces retirées, puis exactement 5 chiffres ASCII
// (\d sans l'indicateur « u »). « 75 011 » donne « 75011 ».
export function parsePostalCodeInput(input: string): Parsed<string> {
  if (isRawValueTooLong(input)) {
    return { ok: false, error: "L5" };
  }
  const value = input.replace(/\s+/g, "");
  if (value === "") {
    return { ok: false, error: "L4" };
  }
  return /^\d{5}$/.test(value)
    ? { ok: true, value }
    : { ok: false, error: "L5" };
}

// Caractères ASCII imprimables seulement (de « ! » à « ~ ») : la précision de R13.
const PRINTABLE_ASCII_ONLY = /^[\x21-\x7E]+$/;

// R13 : normalisation et format de la spécification 02 (réutilisés), complétés de
// deux règles propres aux locataires : ASCII imprimable et pas de « .. ».
export function parseTenantEmailInput(input: string): Parsed<string> {
  if (isRawValueTooLong(input)) {
    return { ok: false, error: "L11" };
  }
  const { email, error } = validateSignUpEmail(input);
  if (error === "E1") {
    return { ok: false, error: "L10" };
  }
  if (
    error === "E2" ||
    !PRINTABLE_ASCII_ONLY.test(email) ||
    email.includes("..")
  ) {
    return { ok: false, error: "L11" };
  }
  return { ok: true, value: email };
}
