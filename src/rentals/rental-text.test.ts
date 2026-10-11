import { describe, expect, it } from "vitest";

import {
  normalizeText,
  parseAddressComplementInput,
  parseAddressInput,
  parseCityInput,
  parsePostalCodeInput,
  parseTenantEmailInput,
  parseTenantNameInput,
} from "./rental-text";

const ok = (value: string) => ({ ok: true, value });
const ko = (error: string) => ({ ok: false, error });

describe("normalizeText (R11)", () => {
  it.each([
    ["  12  rue   des Lilas ", "12 rue des Lilas"],
    ["Marie\tDurand", "Marie Durand"],
    ["Marie\nDurand", "Marie Durand"],
    ["Marie\r\nDurand", "Marie Durand"],
    ["Marie Durand", "Marie Durand"],
    ["Marie Durand", "Marie Durand"],
    ["Marie \t\n   Durand", "Marie Durand"],
    [" \tMarie\n", "Marie"],
    ["   ", ""],
    ["", ""],
  ])("%j donne %j", (entree, attendu) => {
    expect(normalizeText(entree)).toBe(attendu);
  });

  it("applique la normalisation Unicode NFC", () => {
    expect(normalizeText("Café")).toBe("Café");
    expect(normalizeText("Café").length).toBe(4);
  });
});

// Les quatre champs de texte partagent R11 ; ils diffèrent par leur borne et
// leurs messages.
const CHAMPS = [
  ["adresse", parseAddressInput, 200, "L1", "L2"],
  ["ville", parseCityInput, 100, "L6", "L7"],
  ["nom du locataire", parseTenantNameInput, 100, "L8", "L9"],
] as const;

describe.each(CHAMPS)("champ de texte — %s (R11)", (_nom, parse, max, vide, trop) => {
  it("CA15 — normalise les espaces avant d'enregistrer", () => {
    expect(parse("  Marie \t  Durand \n")).toEqual(ok("Marie Durand"));
  });

  it(`CA15 — trois espaces donnent « vide » (${vide})`, () => {
    expect(parse("   ")).toEqual(ko(vide));
    expect(parse("")).toEqual(ko(vide));
    expect(parse("\t\n ")).toEqual(ko(vide));
  });

  it(`CA15 — ${max} caractères sont acceptés, ${max + 1} refusés (${trop})`, () => {
    expect(parse("a".repeat(max))).toEqual(ok("a".repeat(max)));
    expect(parse("a".repeat(max + 1))).toEqual(ko(trop));
  });

  it("CA15 — la longueur se compte en caractères Unicode : des emojis comptent pour un", () => {
    expect(parse("😀".repeat(max))).toEqual(ok("😀".repeat(max)));
    expect(parse("😀".repeat(max + 1))).toEqual(ko(trop));
  });

  it("CA15 — la longueur se compte après normalisation NFC : « e + accent » compte pour un", () => {
    const decompose = "é".repeat(max);
    expect(parse(decompose)).toEqual(ok("é".repeat(max)));
    expect(parse(`${decompose}é`)).toEqual(ko(trop));
  });

  it("la longueur se compte après normalisation des espaces", () => {
    expect(parse(`${"a".repeat(max)}${" ".repeat(50)}`)).toEqual(ok("a".repeat(max)));
    expect(parse(`a${" ".repeat(50)}${"b".repeat(max - 2)}`)).toEqual(ok(`a ${"b".repeat(max - 2)}`));
  });

  it("CA15 — le caractère nul est refusé (L25)", () => {
    expect(parse("Rue\u0000 des Lilas")).toEqual(ko("L25"));
    expect(parse("\u0000")).toEqual(ko("L25"));
  });

  it("CA15 — U+202E (inversion du sens du texte) est refusé (L25)", () => {
    expect(parse("Rue des ‮Lilas")).toEqual(ko("L25"));
  });

  it.each([
    ["U+202A", "‪"], ["U+202B", "‫"], ["U+202C", "‬"],
    ["U+202D", "‭"], ["U+202E", "‮"], ["U+2066", "⁦"],
    ["U+2067", "⁧"], ["U+2068", "⁨"], ["U+2069", "⁩"],
  ])("refuse le caractère de direction %s (L25)", (_nom, caractere) => {
    expect(parse(`a${caractere}b`)).toEqual(ko("L25"));
  });

  it.each([
    ["U+0001", "\u0001"], ["U+0007", "\u0007"], ["U+001B", "\u001b"],
    ["U+001F", "\u001f"], ["U+007F", "\u007f"],
  ])("refuse le caractère de contrôle %s (L25)", (_nom, caractere) => {
    expect(parse(`a${caractere}b`)).toEqual(ko("L25"));
  });

  it("l'ordre est vide, puis L25, puis longueur : un caractère refusé dans une valeur trop longue donne L25", () => {
    expect(parse(`${"a".repeat(max)}\u0000`)).toEqual(ko("L25"));
  });

  it("le caractère refusé est jugé après normalisation : une tabulation n'en est pas un", () => {
    expect(parse("a\tb")).toEqual(ok("a b"));
  });

  it("accepte <, >, &, les guillemets et les emojis, sans les modifier", () => {
    expect(parse(`<img src=x onerror="a()"> & "b" 😀`)).toEqual(ok(`<img src=x onerror="a()"> & "b" 😀`));
  });

  it("R10 — une valeur brute de plus de 500 caractères donne le message de longueur", () => {
    expect(parse("a".repeat(501))).toEqual(ko(trop));
    expect(parse(`${" ".repeat(501)}a`)).toEqual(ko(trop));
  });
});

describe("noms français (R11)", () => {
  it.each([
    ["Jean-Pierre O'Brien"],
    ["Marie-Hélène de La Fontaine"],
    ["D'Artagnan"],
    ["Jean d’Ormesson"],
    ["Saint-Étienne-du-Rouvray"],
    ["L'Haÿ-les-Roses"],
    ["Çağlar Öztürk"],
    ["Zoë Œuvre"],
    ["李小龍"],
  ])("accepte %s", (nom) => {
    expect(parseTenantNameInput(nom)).toEqual(ok(nom));
    expect(parseCityInput(nom)).toEqual(ok(nom));
  });

  it("accepte plusieurs noms dans le champ (couple, R2)", () => {
    expect(parseTenantNameInput("Marie Durand et Paul Martin")).toEqual(
      ok("Marie Durand et Paul Martin"),
    );
  });

  it("un trait d'union insécable (U+2011) est accepté", () => {
    expect(parseTenantNameInput("Anne‑Sophie")).toEqual(ok("Anne‑Sophie"));
  });
});

describe("parseAddressComplementInput — facultatif (R1, R11)", () => {
  it.each([[""], ["   "], ["\t\n "]])(
    "CA15 — %j est accepté, la valeur est la chaîne vide",
    (saisie) => {
      expect(parseAddressComplementInput(saisie)).toEqual(ok(""));
    },
  );

  it("CA15 — normalise les espaces", () => {
    expect(parseAddressComplementInput("  Bât.   B ")).toEqual(ok("Bât. B"));
  });

  it("CA15 — 100 caractères sont acceptés, 101 refusés (L3)", () => {
    expect(parseAddressComplementInput("a".repeat(100))).toEqual(ok("a".repeat(100)));
    expect(parseAddressComplementInput("a".repeat(101))).toEqual(ko("L3"));
  });

  it("CA15 — 100 emojis sont acceptés, 101 refusés (L3)", () => {
    expect(parseAddressComplementInput("😀".repeat(100))).toEqual(ok("😀".repeat(100)));
    expect(parseAddressComplementInput("😀".repeat(101))).toEqual(ko("L3"));
  });

  it("CA15 — nul et U+202E refusés (L25)", () => {
    expect(parseAddressComplementInput("Bât.\u0000B")).toEqual(ko("L25"));
    expect(parseAddressComplementInput("Bât.‮B")).toEqual(ko("L25"));
  });

  it("R10 — plus de 500 caractères bruts : L3", () => {
    expect(parseAddressComplementInput(" ".repeat(501))).toEqual(ko("L3"));
  });
});

describe("parsePostalCodeInput (R12)", () => {
  it.each([
    ["75011", "75011"],
    [" 75011 ", "75011"],
    ["75 011", "75011"],
    ["75 011", "75011"],
    ["75 011", "75011"],
    ["69 003", "69003"],
    ["01000", "01000"],
    ["97400", "97400"],
    ["20000", "20000"],
    ["00000", "00000"], // l'existence du code n'est pas vérifiée
    ["98000", "98000"],
  ])("CA15 — accepte %j, enregistré %s", (saisie, attendu) => {
    expect(parsePostalCodeInput(saisie)).toEqual(ok(attendu));
  });

  it.each([
    ["7501"],
    ["750111"],
    ["7501A"],
    ["75-011"],
    ["７５０１１"], // pleine largeur
    ["٧٥٠١١"], // arabes-indiens
    ["75.011"],
    ["75011\u0000"],
    ["abcde"],
    ["+7501"],
    ["-7501"],
    ["7501e"],
    ["7 5 0 1"],
    ["1"],
  ])("CA15 — refuse %j avec L5", (saisie) => {
    expect(parsePostalCodeInput(saisie)).toEqual(ko("L5"));
  });

  it("CA15 — le champ vide donne L4", () => {
    expect(parsePostalCodeInput("")).toEqual(ko("L4"));
    expect(parsePostalCodeInput("   ")).toEqual(ko("L4"));
  });

  it("R10 — plus de 500 caractères bruts : message de format L5", () => {
    expect(parsePostalCodeInput("1".repeat(501))).toEqual(ko("L5"));
    expect(parsePostalCodeInput(`75011${" ".repeat(500)}`)).toEqual(ko("L5"));
  });
});

describe("parseTenantEmailInput (R13)", () => {
  it("CA15 — normalise : espaces de bord retirées, minuscules, rien d'autre", () => {
    expect(parseTenantEmailInput(" Paul.Martin+loyer@Exemple.FR ")).toEqual(
      ok("paul.martin+loyer@exemple.fr"),
    );
  });

  it("CA15 — conserve les points et le suffixe +…", () => {
    expect(parseTenantEmailInput("p.a.u.l+x+y@exemple.fr")).toEqual(ok("p.a.u.l+x+y@exemple.fr"));
  });

  it.each([
    ["paul@exemple.fr"],
    ["paul_martin@sub.exemple.co.uk"],
    ["o'brien@exemple.fr"],
    ["p@e.fr"],
    ["a-b@c-d.fr"],
    ["paul-ba3d5@quittances.test"],
  ])("accepte %s", (adresse) => {
    expect(parseTenantEmailInput(adresse)).toEqual(ok(adresse));
  });

  it.each([[""], ["   "], ["\t"]])("CA15 — %j (vide) donne L10", (saisie) => {
    expect(parseTenantEmailInput(saisie)).toEqual(ko("L10"));
  });

  it.each([
    ["paul"],
    ["paul@"],
    ["@exemple.fr"],
    ["paul@exemple"],
    ["paul..martin@exemple.fr"],
    ["pàul@exemple.fr"],
    ["pa ul@exemple.fr"],
    ["paul@@exemple.fr"],
    ["paul@a@exemple.fr"],
    ["paul@.exemple.fr"],
    ["paul@exemple.fr."],
    ["paul@exemple..fr"],
    ["paul@exémple.fr"],
    ["paul@exemple.fr extra"],
    ["pa\tul@exemple.fr"],
    ["paul\u0000@exemple.fr"],
    ["paul😀@exemple.fr"],
    ["paul@exemple.fr\u0000"],
    ["pa ul@exemple.fr"],
    ["paul@exemple。fr"],
  ])("CA15 — refuse %j avec L11", (saisie) => {
    expect(parseTenantEmailInput(saisie)).toEqual(ko("L11"));
  });

  it("CA15 — 254 caractères sont acceptés, 255 refusés (L11)", () => {
    const domaine = "@exemple.fr";
    const a254 = `${"a".repeat(254 - domaine.length)}${domaine}`;
    const a255 = `${"a".repeat(255 - domaine.length)}${domaine}`;
    expect(a254).toHaveLength(254);
    expect(parseTenantEmailInput(a254)).toEqual(ok(a254));
    expect(parseTenantEmailInput(a255)).toEqual(ko("L11"));
  });

  it("R10 — plus de 500 caractères bruts : message de format L11", () => {
    expect(parseTenantEmailInput(`${"a".repeat(500)}@exemple.fr`)).toEqual(ko("L11"));
  });
});
