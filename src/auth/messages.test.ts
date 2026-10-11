import { describe, expect, it } from "vitest";

import { ERROR_MESSAGES } from "./messages";

// Textes de la section « Contenus » de la spécification 02, apostrophes droites.
describe("ERROR_MESSAGES", () => {
  it.each([
    ["E1", "Saisissez votre adresse e-mail."],
    ["E2", "Saisissez une adresse e-mail valide, par exemple nom@exemple.fr."],
    ["E3", "Un compte existe déjà avec cette adresse e-mail."],
    ["E4", "Saisissez votre mot de passe."],
    ["E5", "Le mot de passe doit contenir au moins 12 caractères."],
    ["E6", "Le mot de passe ne peut pas dépasser 128 caractères."],
    ["E7", "Adresse e-mail ou mot de passe incorrect."],
    [
      "E8",
      "Le service est momentanément indisponible. Réessayez dans quelques instants.",
    ],
  ] as const)("%s — texte exact de la spécification", (code, texte) => {
    expect(ERROR_MESSAGES[code]).toBe(texte);
  });

  it("ne contient que les codes E1 à E8", () => {
    expect(Object.keys(ERROR_MESSAGES)).toEqual([
      "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8",
    ]);
  });
});
