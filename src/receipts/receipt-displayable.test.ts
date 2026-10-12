import { describe, expect, it } from "vitest";

import { isDisplayableCodePoint, isDisplayableText } from "./receipt-displayable";

// Les quinze caractères que la précision de tête de la spécification 04 retire de
// l'ensemble garanti par R17 (DM Sans ne les dessine pas).
const EXCLUS = [..."ĈĉĜĝĤĥĴĵĸŉŜŝŦŧſ"];

const PONCTUATION = ["‘", "’", "“", "”", "–", "—", "…", "€"];

function plage(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

// L'ensemble garanti de R17, moins les quinze exclus.
const GARANTIS: number[] = [
  ...plage(0x20, 0x7e),
  ...plage(0xa1, 0xff).filter((cp) => cp !== 0xad),
  ...plage(0x100, 0x17f).filter((cp) => !EXCLUS.includes(String.fromCodePoint(cp))),
  ...PONCTUATION.map((c) => c.codePointAt(0) as number),
];

describe("isDisplayableCodePoint (R17)", () => {
  it("R17 — les quinze exclus sont bien quinze, tous dans U+0100 à U+017F", () => {
    expect(EXCLUS).toHaveLength(15);
    for (const c of EXCLUS) {
      expect(c.codePointAt(0)).toBeGreaterThanOrEqual(0x100);
      expect(c.codePointAt(0)).toBeLessThanOrEqual(0x17f);
    }
  });

  it("CA17 — chaque caractère garanti est affichable (tous les points de code)", () => {
    const refuses = GARANTIS.filter((cp) => !isDisplayableCodePoint(cp));
    expect(refuses.map((cp) => cp.toString(16))).toEqual([]);
  });

  it("CA17 — l'ensemble garanti compte 95 + 94 + 113 + 8 caractères", () => {
    expect(GARANTIS).toHaveLength(95 + 94 + 113 + 8);
  });

  it.each(EXCLUS)("précision de tête — %s (exclu de l'ensemble) n'est pas affichable", (c) => {
    expect(isDisplayableCodePoint(c.codePointAt(0) as number)).toBe(false);
  });

  it.each(["œ", "Œ", "Ÿ"])("R17 — %s est affichable", (c) => {
    expect(isDisplayableCodePoint(c.codePointAt(0) as number)).toBe(true);
  });

  it("CA17 — aucun caractère de contrôle n'est affichable (U+0000 à U+001F, U+007F à U+009F)", () => {
    const controles = [...plage(0, 0x1f), ...plage(0x7f, 0x9f)];
    expect(controles.filter((cp) => isDisplayableCodePoint(cp))).toEqual([]);
  });

  it("CA17 — aucun caractère de direction n'est affichable (U+202A à U+202E, U+2066 à U+2069)", () => {
    const directions = [...plage(0x202a, 0x202e), ...plage(0x2066, 0x2069)];
    expect(directions.filter((cp) => isDisplayableCodePoint(cp))).toEqual([]);
  });

  it("précision (2) — l'espace fine insécable U+202F n'est pas dans la police : non affichable", () => {
    expect(isDisplayableCodePoint(0x202f)).toBe(false);
  });

  it("CA17 — le trait d'union conditionnel U+00AD, exclu de l'ensemble garanti, n'est pas affichable", () => {
    expect(isDisplayableCodePoint(0xad)).toBe(false);
  });

  it("CA17 — aucun point de code au-delà de U+2026 hors ponctuation et euro n'est affichable (emojis, idéogrammes, arabe, hébreu)", () => {
    const autres = [
      ...plage(0x0590, 0x05ff), // hébreu
      ...plage(0x0600, 0x06ff), // arabe
      ...plage(0x4e00, 0x4fff), // idéogrammes
      ...plage(0x3040, 0x30ff), // kana
      ...plage(0x1f300, 0x1f64f), // emojis
    ];
    expect(autres.filter((cp) => isDisplayableCodePoint(cp))).toEqual([]);
  });

  it("CA17 — les points de code juste hors des intervalles garantis ne le sont pas (U+001F, U+0180, U+2017, U+20AB, U+20AD)", () => {
    for (const cp of [0x1f, 0x180, 0x2017, 0x20ab, 0x20ad]) {
      expect(isDisplayableCodePoint(cp)).toBe(false);
    }
  });
});

describe("isDisplayableText (R17)", () => {
  it("CA17 — un texte vide est affichable", () => {
    expect(isDisplayableText("")).toBe(true);
  });

  it.each([
    ["Paul Martin"],
    ["Bât. B"],
    ["Marie-Hélène d'Œuvre"],
    ["Zoë Ÿ œuvre"],
    ["Prix : 12 345,00 € — « net »".replace(/[«»]/g, "")],
    ["“guillemets” ‘simples’ … –"],
    ["<b>&(x)\\%"],
  ])("CA17 — %s est affichable", (texte) => {
    expect(isDisplayableText(texte)).toBe(true);
  });

  it.each([
    ["Paul 😀"],
    ["王伟"],
    ["محمد"],
    ["דוד"],
    ["Zoë\n"],
    ["Zoë\t"],
    ["a‮b"],
    ["Ĉapelo"],
  ])("CA17 — %j n'est pas affichable", (texte) => {
    expect(isDisplayableText(texte)).toBe(false);
  });

  it("CA17 — un seul caractère non affichable parmi cent suffit à refuser le texte", () => {
    expect(isDisplayableText(`${"a".repeat(99)}😀`)).toBe(false);
    expect(isDisplayableText(`😀${"a".repeat(99)}`)).toBe(false);
  });

  it("CA17 — un emoji hors du plan de base est refusé comme un seul caractère", () => {
    expect(isDisplayableText("\u{1F600}")).toBe(false);
  });
});
