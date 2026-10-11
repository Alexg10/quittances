import { describe, expect, it } from "vitest";

import {
  countCharacters,
  isRawValueTooLong,
  RAW_VALUE_MAX_LENGTH,
  RENTAL_ERROR_MESSAGES,
} from "./rental-messages";

// Textes de la table « Messages d'erreur » de la spécification 03, apostrophes
// droites, espaces ordinaires.
describe("RENTAL_ERROR_MESSAGES", () => {
  it.each([
    ["L1", "Saisissez l'adresse du logement."],
    ["L2", "L'adresse ne peut pas dépasser 200 caractères."],
    ["L3", "Le complément d'adresse ne peut pas dépasser 100 caractères."],
    ["L4", "Saisissez le code postal."],
    ["L5", "Le code postal doit contenir 5 chiffres."],
    ["L6", "Saisissez la ville."],
    ["L7", "La ville ne peut pas dépasser 100 caractères."],
    ["L8", "Saisissez le nom du locataire."],
    ["L9", "Le nom du locataire ne peut pas dépasser 100 caractères."],
    ["L10", "Saisissez l'adresse e-mail du locataire."],
    ["L11", "Saisissez une adresse e-mail valide, par exemple nom@exemple.fr."],
    ["L12", "Saisissez le loyer hors charges."],
    ["L13", "Saisissez un montant en euros, par exemple 850 ou 850,50."],
    ["L14", "Le loyer hors charges doit être supérieur à zéro."],
    ["L15", "Le montant ne peut pas dépasser 99 999,99 euros."],
    ["L16", "Saisissez le montant des charges, ou 0 s'il n'y en a pas."],
    ["L17", "Saisissez le jour d'échéance."],
    ["L18", "Le jour d'échéance doit être un nombre entier de 1 à 31."],
    ["L19", "Saisissez la date de début du bail."],
    ["L20", "Saisissez une date valide."],
    ["L21", "La date doit être comprise entre le 1er janvier 1950 et le 31 décembre 2099."],
    ["L22", "La date de début ne peut pas être postérieure à la date de fin du bail."],
    ["L23", "Saisissez la date de fin du bail."],
    ["L24", "La date de fin ne peut pas être antérieure à la date de début du bail."],
    ["L25", "Ce champ contient des caractères non autorisés."],
    [
      "L28",
      "Vous avez atteint la limite de 100 locations. Supprimez-en une pour en ajouter une autre.",
    ],
  ] as const)("%s — texte exact de la spécification", (code, texte) => {
    expect(RENTAL_ERROR_MESSAGES[code]).toBe(texte);
  });

  it("contient les codes L1 à L25 et L28, sans L26 ni L27", () => {
    const attendus = [
      ...Array.from({ length: 25 }, (_, i) => `L${i + 1}`),
      "L28",
    ];
    expect(Object.keys(RENTAL_ERROR_MESSAGES).sort()).toEqual([...attendus].sort());
    expect(RENTAL_ERROR_MESSAGES).not.toHaveProperty("L26");
    expect(RENTAL_ERROR_MESSAGES).not.toHaveProperty("L27");
  });

  it("n'utilise que des espaces ordinaires et l'apostrophe droite", () => {
    for (const texte of Object.values(RENTAL_ERROR_MESSAGES)) {
      expect(texte).not.toMatch(/[   ’]/);
    }
  });

  it("n'utilise ni deux-points, ni point-virgule, ni point d'interrogation ni d'exclamation (section « Contenus »)", () => {
    for (const texte of Object.values(RENTAL_ERROR_MESSAGES)) {
      expect(texte).not.toMatch(/[:;?!]/);
    }
  });
});

describe("countCharacters", () => {
  it("compte des caractères Unicode, pas des unités UTF-16", () => {
    expect(countCharacters("😀")).toBe(1);
    expect(countCharacters("😀😀é")).toBe(3);
    expect(countCharacters("")).toBe(0);
  });
});

describe("isRawValueTooLong (R10)", () => {
  it("500 caractères ne sont pas trop longs, 501 le sont", () => {
    expect(RAW_VALUE_MAX_LENGTH).toBe(500);
    expect(isRawValueTooLong("a".repeat(500))).toBe(false);
    expect(isRawValueTooLong("a".repeat(501))).toBe(true);
  });

  it("compte en caractères : 500 emojis ne sont pas trop longs", () => {
    expect(isRawValueTooLong("😀".repeat(500))).toBe(false);
    expect(isRawValueTooLong("😀".repeat(501))).toBe(true);
  });
});
