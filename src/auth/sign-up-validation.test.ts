import { describe, expect, it } from "vitest";

import {
  validateNewPassword,
  validateSignUpEmail,
} from "./sign-up-validation";

// Adresse de la longueur demandée, de forme valide par ailleurs.
function emailOfLength(length: number): string {
  const domain = "@exemple.fr";
  return "a".repeat(length - domain.length) + domain;
}

describe("validateSignUpEmail", () => {
  it("CA7 — accepte et normalise ` Marie.Durand+loyer@Exemple.FR `", () => {
    expect(validateSignUpEmail(" Marie.Durand+loyer@Exemple.FR ")).toEqual({
      email: "marie.durand+loyer@exemple.fr",
      error: null,
    });
  });

  it("R4 — conserve les points et le suffixe + (aucune autre transformation)", () => {
    expect(validateSignUpEmail("m.a.r+x@exemple.fr").email).toBe(
      "m.a.r+x@exemple.fr",
    );
  });

  it.each([
    ["chaîne vide", ""],
    ["espaces seuls", "   "],
    ["tabulation et espaces", " \t "],
  ])("CA7 — E1 pour %s", (_nom, saisie) => {
    expect(validateSignUpEmail(saisie).error).toBe("E1");
  });

  it.each([
    ["marie"],
    ["marie@"],
    ["@exemple.fr"],
    ["marie@exemple"],
    ["marie@.fr"],
    ["marie@exemple."],
    ["ma rie@exemple.fr"],
    ["marie@@exemple.fr"],
    ["marie@exemple@exemple.fr"],
  ])("CA7 — E2 pour %s", (saisie) => {
    expect(validateSignUpEmail(saisie).error).toBe("E2");
  });

  it("R5 — accepte une adresse de 254 caractères", () => {
    expect(validateSignUpEmail(emailOfLength(254)).error).toBeNull();
  });

  it("CA7 — E2 pour une adresse de 255 caractères", () => {
    expect(validateSignUpEmail(emailOfLength(255)).error).toBe("E2");
  });

  it("R5 — la limite de 254 s'applique après normalisation (espaces exclus)", () => {
    expect(validateSignUpEmail(` ${emailOfLength(254)} `).error).toBeNull();
  });

  it("R5 — une adresse sans partie locale ni espace mais au domaine à plusieurs points est valide", () => {
    expect(validateSignUpEmail("a@b.c.d").error).toBeNull();
  });

  it("R4 — renvoie l'adresse normalisée même quand elle est invalide", () => {
    expect(validateSignUpEmail("  MARIE@Exemple ").email).toBe("marie@exemple");
  });
});

describe("validateNewPassword", () => {
  it("CA8 — E4 pour une chaîne vide", () => {
    expect(validateNewPassword("")).toBe("E4");
  });

  it("CA8 — E5 pour 11 caractères", () => {
    expect(validateNewPassword("a".repeat(11))).toBe("E5");
  });

  it("CA8 — accepte 12 caractères identiques", () => {
    expect(validateNewPassword("aaaaaaaaaaaa")).toBeNull();
  });

  it("CA8 — accepte 12 espaces (jamais rogné, R7)", () => {
    expect(validateNewPassword(" ".repeat(12))).toBeNull();
  });

  it("R7 — E5 pour 11 espaces", () => {
    expect(validateNewPassword(" ".repeat(11))).toBe("E5");
  });

  it("R7 — des espaces autour de 10 caractères comptent dans la longueur (pas de rognage)", () => {
    expect(validateNewPassword(` ${"a".repeat(10)} `)).toBeNull();
  });

  it("R7 — des espaces autour de 9 caractères donnent E5 (11 au total)", () => {
    expect(validateNewPassword(` ${"a".repeat(9)} `)).toBe("E5");
  });

  it("CA8 — accepte 128 caractères", () => {
    expect(validateNewPassword("a".repeat(128))).toBeNull();
  });

  it("CA8 — E6 pour 129 caractères", () => {
    expect(validateNewPassword("a".repeat(129))).toBe("E6");
  });

  it("R7 — 128 espaces acceptés, 129 espaces refusés (E6)", () => {
    expect(validateNewPassword(" ".repeat(128))).toBeNull();
    expect(validateNewPassword(" ".repeat(129))).toBe("E6");
  });

  it("R7 — aucune règle de composition : accepte 12 caractères accentués", () => {
    expect(validateNewPassword("éééééééééééé")).toBeNull();
  });

  it("R7 — aucun caractère interdit : accepte symboles et guillemets", () => {
    expect(validateNewPassword(`"'<>&;\\/%$#@!`)).toBeNull();
  });
});
