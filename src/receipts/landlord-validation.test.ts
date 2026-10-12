import { describe, expect, it } from "vitest";

import {
  LANDLORD_FORM_FIELDS,
  readLandlordFormFields,
  validateLandlordForm,
  type LandlordFormFields,
} from "./landlord-validation";
import { receiptErrorMessage } from "./receipt-messages";

const TYPE: LandlordFormFields = {
  name: "Marie Durand",
  address: "3 rue de la Paix",
  addressComplement: "",
  postalCode: "75002",
  city: "Paris",
};

const VIDE: LandlordFormFields = {
  name: "",
  address: "",
  addressComplement: "",
  postalCode: "",
  city: "",
};

function erreurs(fields: LandlordFormFields) {
  const result = validateLandlordForm(fields);
  return result.ok ? null : result.errors;
}

describe("validateLandlordForm (R1)", () => {
  it("CA12 — cinq valeurs vides : B1, B3, L4, L6 et aucune erreur pour le complément", () => {
    expect(erreurs(VIDE)).toEqual({ name: "B1", address: "B3", postalCode: "L4", city: "L6" });
  });

  it("CA12 — des valeurs faites d'espaces comptent comme vides", () => {
    const blancs = { name: "  ", address: "\t", addressComplement: " ", postalCode: " ", city: "\n" };
    expect(erreurs(blancs)).toEqual({ name: "B1", address: "B3", postalCode: "L4", city: "L6" });
  });

  it("CA2 — normalise `  Marie   Durand `, un complément vide, `75 002` et ` Paris `", () => {
    const result = validateLandlordForm({
      name: "  Marie   Durand ",
      address: "3 rue de la Paix",
      addressComplement: "",
      postalCode: "75 002",
      city: " Paris ",
    });
    expect(result).toEqual({
      ok: true,
      values: {
        name: "Marie Durand",
        address: "3 rue de la Paix",
        addressComplement: null,
        postalCode: "75002",
        city: "Paris",
      },
    });
  });

  it("R1 — le complément facultatif vaut null (absent) quand il est vide ou fait d'espaces, jamais une chaîne vide", () => {
    for (const complement of ["", "   ", " "]) {
      const result = validateLandlordForm({ ...TYPE, addressComplement: complement });
      expect(result).toMatchObject({ ok: true, values: { addressComplement: null } });
    }
  });

  it("R1 — garde un complément renseigné, normalisé", () => {
    const result = validateLandlordForm({ ...TYPE, addressComplement: "  Bât.   B " });
    expect(result).toMatchObject({ ok: true, values: { addressComplement: "Bât. B" } });
  });

  it.each([
    ["name", "B2", 100],
    ["address", "L2", 200],
    ["addressComplement", "L3", 100],
    ["city", "L7", 100],
  ] as const)("CA12 — %s : accepté à %i caractères, refusé avec un de plus (%s)", (champ, code, max) => {
    expect(validateLandlordForm({ ...TYPE, [champ]: "a".repeat(max) }).ok).toBe(true);
    expect(erreurs({ ...TYPE, [champ]: "a".repeat(max + 1) })).toEqual({ [champ]: code });
  });

  it("CA12 — compte les caractères Unicode, pas les unités UTF-16 : 100 emojis sont acceptés, 101 refusés", () => {
    expect(validateLandlordForm({ ...TYPE, name: "😀".repeat(100) }).ok).toBe(true);
    expect(erreurs({ ...TYPE, name: "😀".repeat(101) })).toEqual({ name: "B2" });
  });

  it("CA12 — la longueur se compte après normalisation des espaces", () => {
    const nom = `${"a".repeat(50)}      ${"b".repeat(49)}`; // 50 + 1 + 49 = 100 après normalisation
    expect(validateLandlordForm({ ...TYPE, name: nom }).ok).toBe(true);
  });

  it("CA12 — `7501` donne L5", () => {
    expect(erreurs({ ...TYPE, postalCode: "7501" })).toEqual({ postalCode: "L5" });
  });

  it.each([["750111"], ["7501A"], ["75-011"], ["７５０１１"]])("R12 de la spécification 03 — %s donne L5", (cp) => {
    expect(erreurs({ ...TYPE, postalCode: cp })).toEqual({ postalCode: "L5" });
  });

  it.each([["01000"], ["97400"], [" 75011 "], ["75 011"]])("R12 de la spécification 03 — %j est accepté", (cp) => {
    expect(validateLandlordForm({ ...TYPE, postalCode: cp }).ok).toBe(true);
  });

  it("CA12 — une valeur contenant U+202E donne L25", () => {
    expect(erreurs({ ...TYPE, name: "Marie‮Durand" })).toEqual({ name: "L25" });
    expect(erreurs({ ...TYPE, address: "3 rue‮ de la Paix" })).toEqual({ address: "L25" });
    expect(erreurs({ ...TYPE, addressComplement: "Bât.‮ B" })).toEqual({ addressComplement: "L25" });
    expect(erreurs({ ...TYPE, city: "Pa‮ris" })).toEqual({ city: "L25" });
  });

  it("R11 de la spécification 03 — un caractère de contrôle (nul) est refusé (L25)", () => {
    expect(erreurs({ ...TYPE, name: "Marie\u0000Durand" })).toEqual({ name: "L25" });
  });

  it("R17 — le formulaire accepte les caractères que le document n'affiche pas (emoji, arabe) : c'est la production qui les refuse (Q9)", () => {
    const result = validateLandlordForm({ ...TYPE, name: "Paul 😀", city: "محمد" });
    expect(result.ok).toBe(true);
  });

  it("R11 de la spécification 03 — accepte <, &, guillemets et apostrophes, enregistrés tels quels", () => {
    const result = validateLandlordForm({ ...TYPE, name: `<b>&"L'Atelier"` });
    expect(result).toMatchObject({ ok: true, values: { name: `<b>&"L'Atelier"` } });
  });

  it("R1 — jeu complet ou absent : une seule erreur empêche de rendre la moindre valeur", () => {
    const result = validateLandlordForm({ ...TYPE, city: "" });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("values");
  });

  it("R10 de la spécification 03 — toutes les erreurs sont renvoyées ensemble, une par champ", () => {
    const result = validateLandlordForm({
      name: "a".repeat(101),
      address: "",
      addressComplement: "a".repeat(101),
      postalCode: "12",
      city: "a".repeat(101),
    });
    expect(result).toMatchObject({
      ok: false,
      errors: { name: "B2", address: "B3", addressComplement: "L3", postalCode: "L5", city: "L7" },
    });
  });

  it("R10 de la spécification 03 — les valeurs à réafficher sont celles saisies, sans normalisation", () => {
    const saisie = { ...VIDE, name: "  Marie   Durand ", city: "" };
    const result = validateLandlordForm(saisie);
    expect(result).toMatchObject({ ok: false, fields: saisie });
  });

  it("R10 de la spécification 03 — une valeur brute de plus de 500 caractères est refusée avec le message de longueur et réaffichée vide", () => {
    const long = "a".repeat(501);
    const result = validateLandlordForm({ ...TYPE, name: long, address: long, addressComplement: long, city: long });
    expect(result).toMatchObject({
      ok: false,
      errors: { name: "B2", address: "L2", addressComplement: "L3", city: "L7" },
      fields: { name: "", address: "", addressComplement: "", city: "", postalCode: "75002" },
    });
  });

  it("R10 de la spécification 03 — 501 caractères bruts sont refusés même si la valeur normalisée serait courte", () => {
    const result = validateLandlordForm({ ...TYPE, name: `${" ".repeat(496)}Marie` });
    expect(result).toMatchObject({ ok: false, errors: { name: "B2" }, fields: { name: "" } });
  });

  it("R10 de la spécification 03 — 500 caractères bruts exactement sont analysés", () => {
    expect(validateLandlordForm({ ...TYPE, name: `${" ".repeat(495)}Marie` }).ok).toBe(true);
  });

  it("R10 de la spécification 03 — un code postal brut de plus de 500 caractères est refusé (L5) et réaffiché vide", () => {
    const result = validateLandlordForm({ ...TYPE, postalCode: "1".repeat(501) });
    expect(result).toMatchObject({ ok: false, errors: { postalCode: "L5" }, fields: { postalCode: "" } });
  });

  it("R1 — les messages B1 à B3 sont ceux de la spécification", () => {
    expect(receiptErrorMessage("B1")).toBe("Saisissez le nom du bailleur.");
    expect(receiptErrorMessage("B2")).toBe("Le nom du bailleur ne peut pas dépasser 100 caractères.");
    expect(receiptErrorMessage("B3")).toBe("Saisissez votre adresse.");
  });
});

describe("readLandlordFormFields", () => {
  function formulaire(entrees: Array<[string, string | File]>): FormData {
    const data = new FormData();
    for (const [nom, valeur] of entrees) data.append(nom, valeur);
    return data;
  }

  it("lit les cinq champs, dans l'ordre du formulaire", () => {
    expect(LANDLORD_FORM_FIELDS).toEqual(["name", "address", "addressComplement", "postalCode", "city"]);
    const data = formulaire([
      ["name", "Marie Durand"],
      ["address", "3 rue de la Paix"],
      ["addressComplement", "Bât. B"],
      ["postalCode", "75002"],
      ["city", "Paris"],
    ]);
    expect(readLandlordFormFields(data)).toEqual({
      name: "Marie Durand",
      address: "3 rue de la Paix",
      addressComplement: "Bât. B",
      postalCode: "75002",
      city: "Paris",
    });
  });

  it("R26 — ignore tout autre champ (propriétaire, courriel, référence)", () => {
    const lus = readLandlordFormFields(
      formulaire([
        ["name", "Marie Durand"],
        ["ownerId", "autre-compte"],
        ["email", "x@quittances.test"],
        ["id", "123"],
      ]),
    );
    expect(Object.keys(lus).sort()).toEqual([...LANDLORD_FORM_FIELDS].sort());
    expect(JSON.stringify(lus)).not.toContain("autre-compte");
  });

  it("R10 de la spécification 03 — un champ absent, en double ou envoyé comme fichier est lu vide", () => {
    const lus = readLandlordFormFields(
      formulaire([
        ["name", "A"],
        ["name", "B"],
        ["address", new File(["x"], "x.txt")],
      ]),
    );
    expect(lus).toEqual(VIDE);
  });
});
