import { describe, expect, it } from "vitest";

import { validateSignIn } from "./sign-in-validation";

describe("validateSignIn — présence des champs (R13)", () => {
  it("CA25 — adresse et mot de passe remplis : aucune erreur", () => {
    expect(validateSignIn("marie@exemple.fr", "motdepasse")).toEqual({
      emailError: null,
      passwordError: null,
    });
  });

  it("CA25 — formulaire vide : E1 et E4 en même temps", () => {
    expect(validateSignIn("", "")).toEqual({ emailError: "E1", passwordError: "E4" });
  });

  it("CA25 — adresse vide : E1 seul", () => {
    expect(validateSignIn("", "motdepasse")).toEqual({ emailError: "E1", passwordError: null });
  });

  it("CA25 — mot de passe vide : E4 seul", () => {
    expect(validateSignIn("marie@exemple.fr", "")).toEqual({
      emailError: null,
      passwordError: "E4",
    });
  });

  it.each([["un espace", " "], ["plusieurs espaces", "     "], ["une tabulation", "\t"], ["un saut de ligne", "\n"]])(
    "R4 — une adresse faite de %s est un champ vide : E1",
    (_nom, adresse) => {
      expect(validateSignIn(adresse, "motdepasse").emailError).toBe("E1");
    },
  );

  it("R7 — un mot de passe fait d'espaces est une saisie, pas un champ vide (jamais rogné)", () => {
    expect(validateSignIn("marie@exemple.fr", "   ").passwordError).toBeNull();
  });
});

describe("validateSignIn — aucune autre règle à la connexion (R13)", () => {
  it.each([
    ["sans @", "marie"],
    ["sans domaine", "marie@"],
    ["sans partie locale", "@exemple.fr"],
    ["sans point dans le domaine", "marie@exemple"],
    ["avec un espace", "ma rie@exemple.fr"],
    ["avec deux @", "marie@@exemple.fr"],
    ["de 255 caractères", `${"a".repeat(243)}@exemple.fr`],
  ])("une adresse %s passe : le refus sera E7, pas E2", (_nom, adresse) => {
    expect(validateSignIn(adresse, "motdepasse")).toEqual({
      emailError: null,
      passwordError: null,
    });
  });

  it.each([
    ["1 caractère", "a"],
    ["11 caractères", "a".repeat(11)],
    ["129 caractères", "a".repeat(129)],
    ["10 000 caractères", "a".repeat(10_000)],
  ])("un mot de passe de %s passe : pas de E5 ni E6", (_nom, motDePasse) => {
    expect(validateSignIn("marie@exemple.fr", motDePasse).passwordError).toBeNull();
  });
});
