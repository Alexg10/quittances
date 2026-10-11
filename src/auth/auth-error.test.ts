import { describe, expect, it } from "vitest";

import { readAuthErrorCode } from "./auth-error";

describe("readAuthErrorCode", () => {
  it("lit le code d'une erreur qui porte body.code", () => {
    const error = Object.assign(new Error("refusé"), {
      body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "x" },
    });

    expect(readAuthErrorCode(error)).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("lit le code d'une erreur d'une autre classe que celle de la bibliothèque (pas de instanceof)", () => {
    // Régression de T2 : une couche interne lève une autre classe d'erreur,
    // avec la même forme. Le code doit être lu quand même.
    class ErreurInterne extends Error {
      body = { code: "INVALID_EMAIL" };
    }

    expect(readAuthErrorCode(new ErreurInterne("x"))).toBe("INVALID_EMAIL");
  });

  it("lit le code d'un simple objet qui n'est pas une Error", () => {
    expect(readAuthErrorCode({ body: { code: "PASSWORD_TOO_LONG" } })).toBe("PASSWORD_TOO_LONG");
  });

  it.each([
    ["une erreur sans body", new Error("panne")],
    ["un objet vide", {}],
    ["un body null", { body: null }],
    ["un body qui est une chaîne", { body: "INVALID_EMAIL" }],
    ["un body qui est un nombre", { body: 42 }],
    ["un body sans code", { body: { message: "x" } }],
    ["un code qui n'est pas une chaîne", { body: { code: 500 } }],
    ["un code null", { body: { code: null } }],
    ["un code dans l'erreur et non dans body", { code: "INVALID_EMAIL" }],
    ["null", null],
    ["undefined", undefined],
    ["une chaîne", "INVALID_EMAIL"],
    ["un nombre", 42],
  ])("renvoie undefined pour %s", (_nom, error) => {
    expect(readAuthErrorCode(error)).toBeUndefined();
  });
});
