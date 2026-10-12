import { describe, expect, it } from "vitest";

import { breakLongWords } from "./receipt-text-layout";

// Chaque caractère mesure 1 : la largeur maximale se lit comme un nombre de lettres.
const unit = () => 1;

describe("breakLongWords (R28)", () => {
  it("R28 — laisse un texte dont tous les mots tiennent exactement comme il est", () => {
    expect(breakLongWords("Paul Martin", 10, unit)).toBe("Paul Martin");
  });

  it("R28 — coupe un mot trop long par une espace ordinaire, sans trait d'union", () => {
    const result = breakLongWords("abcdefghij", 4, unit);
    expect(result).toBe("abcd efgh ij");
    expect(result).not.toContain("-");
  });

  it("R28 — le texte lu sans espaces est inchangé", () => {
    const mot = "W".repeat(37);
    expect(breakLongWords(mot, 5, unit).replace(/ /g, "")).toBe(mot);
  });

  it("R28 — un mot de la largeur exacte n'est pas coupé", () => {
    expect(breakLongWords("abcd", 4, unit)).toBe("abcd");
  });

  it("R28 — conserve les espaces entre les mots et coupe seulement le mot trop long", () => {
    expect(breakLongWords("ab cdefghij kl", 4, unit)).toBe("ab cdef ghij kl");
  });

  it("R28 — un caractère plus large que la ligne tient seul et la coupe se termine", () => {
    expect(breakLongWords("abc", 0.5, unit)).toBe("a b c");
  });

  it("R28 — ne coupe jamais un caractère hors du plan de base en deux", () => {
    const result = breakLongWords("a\u{1F600}b\u{1F600}", 2, unit);
    expect(result.replace(/ /g, "")).toBe("a\u{1F600}b\u{1F600}");
    for (const morceau of result.split(" ")) {
      expect(morceau).not.toMatch(/[\ud800-\udbff]$|^[\udc00-\udfff]/);
    }
  });

  it("R28 — tient compte de la largeur de chaque caractère (large et étroit)", () => {
    const mesure = (c: string) => (c === "W" ? 3 : 1);
    expect(breakLongWords("WWWiiii", 6, mesure)).toBe("WW Wiii i");
  });
});
