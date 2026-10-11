import { describe, expect, it } from "vitest";

import { RENTAL_ERROR_MESSAGES } from "./rental-messages";
import {
  RENTAL_FORM_FIELDS,
  readRentalFormFields,
  rentalErrorMessage,
  toRentalFormFields,
  validateEndDate,
  validateRentalForm,
  type RentalFormFields,
} from "./rental-validation";

// Les dix champs de l'exemple de CA23.
const SAISIE_CA23: RentalFormFields = {
  address: "  12  rue des Lilas ",
  addressComplement: "Bât. B",
  postalCode: "69 003",
  city: " Lyon ",
  tenantName: " Paul   Martin ",
  tenantEmail: " Paul.Martin-x1@Quittances.test ",
  rent: "1 250,50 €",
  charges: "0",
  dueDay: "05",
  startDate: "2026-01-05",
};

const VALEURS_CA23 = {
  address: "12 rue des Lilas",
  addressComplement: "Bât. B",
  postalCode: "69003",
  city: "Lyon",
  tenantName: "Paul Martin",
  tenantEmail: "paul.martin-x1@quittances.test",
  rentInCents: 125050,
  chargesInCents: 0,
  dueDay: 5,
  startDate: "2026-01-05",
};

const VIDE: RentalFormFields = {
  address: "",
  addressComplement: "",
  postalCode: "",
  city: "",
  tenantName: "",
  tenantEmail: "",
  rent: "",
  charges: "",
  dueDay: "",
  startDate: "",
};

function formulaire(champs: Record<string, string | File | Array<string | File>>): FormData {
  const data = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) {
    for (const v of Array.isArray(valeur) ? valeur : [valeur]) {
      data.append(nom, v);
    }
  }
  return data;
}

describe("RENTAL_FORM_FIELDS (R33)", () => {
  it("liste les dix champs dans l'ordre du formulaire", () => {
    expect([...RENTAL_FORM_FIELDS]).toEqual([
      "address",
      "addressComplement",
      "postalCode",
      "city",
      "tenantName",
      "tenantEmail",
      "rent",
      "charges",
      "dueDay",
      "startDate",
    ]);
  });
});

describe("validateRentalForm — formulaire valide", () => {
  it("CA23 — rend les valeurs normalisées exactes", () => {
    expect(validateRentalForm(SAISIE_CA23)).toEqual({ ok: true, values: VALEURS_CA23 });
  });

  it("R1 — un complément d'adresse vide est absent (null)", () => {
    const resultat = validateRentalForm({ ...SAISIE_CA23, addressComplement: "   " });
    expect(resultat).toEqual({
      ok: true,
      values: { ...VALEURS_CA23, addressComplement: null },
    });
  });

  it("le loyer et les charges sont enregistrés en centimes entiers", () => {
    const resultat = validateRentalForm({ ...SAISIE_CA23, rent: "850", charges: "45,5" });
    expect(resultat).toMatchObject({
      ok: true,
      values: { rentInCents: 85000, chargesInCents: 4550 },
    });
  });

  it("R3 — aucune unicité : deux validations identiques réussissent", () => {
    expect(validateRentalForm(SAISIE_CA23).ok).toBe(true);
    expect(validateRentalForm(SAISIE_CA23).ok).toBe(true);
  });

  it("ne renvoie que les dix informations de R1 saisies (ni propriétaire, ni identifiant, ni date de fin)", () => {
    const resultat = validateRentalForm(SAISIE_CA23);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) {
      expect(Object.keys(resultat.values).sort()).toEqual(Object.keys(VALEURS_CA23).sort());
    }
  });
});

describe("validateRentalForm — formulaire vide", () => {
  it("CA24 — toutes les erreurs à la fois, le complément d'adresse sans erreur", () => {
    const resultat = validateRentalForm(VIDE);
    expect(resultat).toEqual({
      ok: false,
      fields: VIDE,
      errors: {
        address: "L1",
        postalCode: "L4",
        city: "L6",
        tenantName: "L8",
        tenantEmail: "L10",
        rent: "L12",
        charges: "L16",
        dueDay: "L17",
        startDate: "L19",
      },
    });
  });

  it("CA24 — le complément d'adresse n'a pas de clé d'erreur", () => {
    const resultat = validateRentalForm(VIDE);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).not.toHaveProperty("addressComplement");
    }
  });

  it("des champs faits d'espaces sont traités comme vides", () => {
    const espaces = Object.fromEntries(RENTAL_FORM_FIELDS.map((f) => [f, "   "])) as RentalFormFields;
    const resultat = validateRentalForm(espaces);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toMatchObject({
        address: "L1",
        postalCode: "L4",
        city: "L6",
        tenantName: "L8",
        tenantEmail: "L10",
        rent: "L12",
        charges: "L16",
        dueDay: "L17",
      });
      expect(resultat.errors).not.toHaveProperty("addressComplement");
    }
  });
});

describe("validateRentalForm — plusieurs erreurs simultanées", () => {
  const saisie: RentalFormFields = {
    ...SAISIE_CA23,
    postalCode: "7501",
    tenantEmail: "paul@exemple",
    rent: "850,555",
    charges: "-5",
    dueDay: "32",
    startDate: "2027-02-29",
  };

  it("CA24 — L5, L11, L13 (loyer), L13 (charges), L18 et L20 ensemble, les autres champs sans erreur", () => {
    const resultat = validateRentalForm(saisie);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toEqual({
        postalCode: "L5",
        tenantEmail: "L11",
        rent: "L13",
        charges: "L13",
        dueDay: "L18",
        startDate: "L20",
      });
    }
  });

  it("CA24 — chaque champ est réaffiché exactement tel que saisi, valides compris", () => {
    const resultat = validateRentalForm(saisie);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.fields).toEqual(saisie);
    }
  });

  it("un seul message par champ : le premier applicable", () => {
    const resultat = validateRentalForm({
      ...SAISIE_CA23,
      address: `${"a".repeat(200)}\u0000`,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toEqual({ address: "L25" });
    }
  });

  it("les messages de longueur de chaque champ de texte (L2, L3, L7, L9)", () => {
    const resultat = validateRentalForm({
      ...SAISIE_CA23,
      address: "a".repeat(201),
      addressComplement: "a".repeat(101),
      city: "a".repeat(101),
      tenantName: "a".repeat(101),
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toEqual({
        address: "L2",
        addressComplement: "L3",
        city: "L7",
        tenantName: "L9",
      });
    }
  });

  it("un loyer de zéro donne L14, des charges de zéro sont valides", () => {
    const resultat = validateRentalForm({ ...SAISIE_CA23, rent: "0", charges: "0" });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toEqual({ rent: "L14" });
    }
  });

  it("un montant trop grand donne L15 pour chacun des deux champs", () => {
    const resultat = validateRentalForm({ ...SAISIE_CA23, rent: "100000", charges: "100 000,00" });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toEqual({ rent: "L15", charges: "L15" });
    }
  });

  it("une date de début hors bornes donne L21", () => {
    const resultat = validateRentalForm({ ...SAISIE_CA23, startDate: "1949-12-31" });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toEqual({ startDate: "L21" });
    }
  });
});

describe("validateRentalForm — valeurs à réafficher (R10, R34)", () => {
  it("après une erreur, les valeurs sont celles saisies, non normalisées", () => {
    const saisie = { ...SAISIE_CA23, rent: "abc" };
    const resultat = validateRentalForm(saisie);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.fields).toEqual(saisie);
      expect(resultat.fields.address).toBe("  12  rue des Lilas ");
    }
  });

  it("R10 — une valeur brute de plus de 500 caractères est réaffichée vide, les autres champs intacts", () => {
    const saisie = { ...SAISIE_CA23, address: "a".repeat(501), rent: "1".repeat(501) };
    const resultat = validateRentalForm(saisie);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toEqual({ address: "L2", rent: "L13" });
      expect(resultat.fields.address).toBe("");
      expect(resultat.fields.rent).toBe("");
      expect(resultat.fields.city).toBe(saisie.city);
      expect(resultat.fields.tenantEmail).toBe(saisie.tenantEmail);
    }
  });

  it("R10 — une valeur de 500 caractères exactement est réaffichée telle quelle", () => {
    const saisie = { ...SAISIE_CA23, addressComplement: "a".repeat(500) };
    const resultat = validateRentalForm(saisie);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toEqual({ addressComplement: "L3" });
      expect(resultat.fields.addressComplement).toBe("a".repeat(500));
    }
  });

  it("ne modifie pas l'objet passé en argument", () => {
    const saisie = { ...SAISIE_CA23, address: "a".repeat(501) };
    const copie = { ...saisie };
    validateRentalForm(saisie);
    expect(saisie).toEqual(copie);
  });
});

describe("validateRentalForm — cohérence avec la date de fin existante (R22)", () => {
  it("CA13, CA36 — début postérieur d'un jour à la fin existante : L22 sous la date de début", () => {
    const resultat = validateRentalForm(
      { ...SAISIE_CA23, startDate: "2026-01-06" },
      { existingEndDate: "2026-01-05" },
    );
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.errors).toEqual({ startDate: "L22" });
    }
  });

  it("début égal à la fin existante : accepté", () => {
    expect(
      validateRentalForm({ ...SAISIE_CA23, startDate: "2026-01-05" }, { existingEndDate: "2026-01-05" }).ok,
    ).toBe(true);
  });

  it("début antérieur à la fin existante : accepté", () => {
    expect(
      validateRentalForm({ ...SAISIE_CA23, startDate: "2026-01-05" }, { existingEndDate: "2026-06-30" }).ok,
    ).toBe(true);
  });

  it("sans date de fin existante (null ou absente) : jamais de L22", () => {
    expect(validateRentalForm({ ...SAISIE_CA23, startDate: "2099-12-31" }, { existingEndDate: null }).ok).toBe(true);
    expect(validateRentalForm({ ...SAISIE_CA23, startDate: "2099-12-31" }).ok).toBe(true);
  });

  it("une date de début invalide garde son propre message (L20, L19), pas L22", () => {
    const impossible = validateRentalForm(
      { ...SAISIE_CA23, startDate: "2026-02-30" },
      { existingEndDate: "2026-01-05" },
    );
    const vide = validateRentalForm({ ...SAISIE_CA23, startDate: "" }, { existingEndDate: "2026-01-05" });
    expect(impossible.ok || impossible.errors.startDate).toBe("L20");
    expect(vide.ok || vide.errors.startDate).toBe("L19");
  });

  it("la date de fin existante ne produit jamais d'erreur sur un autre champ", () => {
    const resultat = validateRentalForm(
      { ...SAISIE_CA23, startDate: "2026-01-06" },
      { existingEndDate: "2026-01-05" },
    );
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(Object.keys(resultat.errors)).toEqual(["startDate"]);
    }
  });
});

describe("readRentalFormFields (R7)", () => {
  it("lit les dix champs tels que saisis, sans les modifier", () => {
    const champs = readRentalFormFields(formulaire({ ...SAISIE_CA23 }));
    expect(champs).toEqual(SAISIE_CA23);
  });

  it("un champ absent donne la chaîne vide", () => {
    const sansLoyer: Record<string, string> = { ...SAISIE_CA23 };
    delete sansLoyer.rent;
    const champs = readRentalFormFields(formulaire(sansLoyer));
    expect(champs.rent).toBe("");
    expect(champs.address).toBe(SAISIE_CA23.address);
  });

  it("un champ envoyé deux fois donne la chaîne vide", () => {
    const champs = readRentalFormFields(
      formulaire({ ...SAISIE_CA23, city: ["Lyon", "Paris"] }),
    );
    expect(champs.city).toBe("");
  });

  it("un champ envoyé comme fichier donne la chaîne vide", () => {
    const fichier = new File(["Lyon"], "ville.txt", { type: "text/plain" });
    const champs = readRentalFormFields(formulaire({ ...SAISIE_CA23, city: fichier }));
    expect(champs.city).toBe("");
  });

  it("R7 — un champ inattendu est ignoré : propriétaire, identifiant, date de fin, dates système", () => {
    const champs = readRentalFormFields(
      formulaire({
        ...SAISIE_CA23,
        ownerId: "owner-de-A",
        owner_id: "owner-de-A",
        userId: "owner-de-A",
        id: "00000000-0000-4000-8000-000000000000",
        endDate: "2026-06-30",
        createdAt: "2020-01-01",
        updatedAt: "2020-01-01",
      }),
    );
    expect(Object.keys(champs).sort()).toEqual([...RENTAL_FORM_FIELDS].sort());
    expect(champs).toEqual(SAISIE_CA23);
  });

  it("R7 — un champ inattendu n'apparaît pas dans les valeurs validées", () => {
    const champs = readRentalFormFields(
      formulaire({ ...SAISIE_CA23, ownerId: "owner-de-A", endDate: "2026-06-30", id: "x" }),
    );
    const resultat = validateRentalForm(champs);
    expect(resultat).toEqual({ ok: true, values: VALEURS_CA23 });
  });

  it("un formulaire sans aucun champ donne dix chaînes vides", () => {
    const champs = readRentalFormFields(new FormData());
    expect(champs).toEqual(VIDE);
  });
});

describe("validateEndDate (R21)", () => {
  const debut = "2026-01-05";

  it("CA36 — une date de fin vide donne L23, la valeur est conservée", () => {
    expect(validateEndDate("", debut)).toEqual({ ok: false, field: "", error: "L23" });
  });

  it.each([
    ["2026-02-30", "L20"],
    ["2100-01-01", "L21"],
    ["2026-01-04", "L24"],
    ["demain", "L20"],
    ["05/06/2026", "L20"],
    ["1949-12-31", "L21"],
  ])("CA36 — %s donne %s et la valeur saisie est conservée", (saisie, code) => {
    expect(validateEndDate(saisie, debut)).toEqual({ ok: false, field: saisie, error: code });
  });

  it("CA36 — la date de fin égale à la date de début est acceptée", () => {
    expect(validateEndDate("2026-01-05", debut)).toEqual({ ok: true, endDate: "2026-01-05" });
  });

  it("CA35 — une date à venir est acceptée, jusqu'au 2099-12-31 inclus", () => {
    expect(validateEndDate("2099-12-31", debut)).toEqual({ ok: true, endDate: "2099-12-31" });
    expect(validateEndDate("2026-06-30", debut)).toEqual({ ok: true, endDate: "2026-06-30" });
  });

  it("R10 — une valeur brute de plus de 500 caractères est réaffichée vide", () => {
    const resultat = validateEndDate("2".repeat(501), debut);
    expect(resultat).toMatchObject({ ok: false, field: "" });
  });
});

describe("rentalErrorMessage", () => {
  it("rend le texte exact du code (L13, L22, L28)", () => {
    expect(rentalErrorMessage("L13")).toBe("Saisissez un montant en euros, par exemple 850 ou 850,50.");
    expect(rentalErrorMessage("L22")).toBe(
      "La date de début ne peut pas être postérieure à la date de fin du bail.",
    );
    expect(rentalErrorMessage("L28")).toBe(
      "Vous avez atteint la limite de 100 locations. Supprimez-en une pour en ajouter une autre.",
    );
  });

  it("rend, pour chaque code, le texte de la table des messages", () => {
    for (const code of Object.keys(RENTAL_ERROR_MESSAGES) as Array<keyof typeof RENTAL_ERROR_MESSAGES>) {
      expect(rentalErrorMessage(code)).toBe(RENTAL_ERROR_MESSAGES[code]);
    }
  });
});

describe("toRentalFormFields (R16, R32)", () => {
  const enregistree = {
    ...VALEURS_CA23,
    addressComplement: null as string | null,
  };

  it("CA32 — formate les montants en 1250,50 et 0,00, le jour en nombre, la date telle quelle", () => {
    expect(toRentalFormFields(enregistree)).toEqual({
      address: "12 rue des Lilas",
      addressComplement: "",
      postalCode: "69003",
      city: "Lyon",
      tenantName: "Paul Martin",
      tenantEmail: "paul.martin-x1@quittances.test",
      rent: "1250,50",
      charges: "0,00",
      dueDay: "5",
      startDate: "2026-01-05",
    });
  });

  it("un complément d'adresse présent est repris tel quel", () => {
    expect(toRentalFormFields(VALEURS_CA23).addressComplement).toBe("Bât. B");
  });

  it.each([
    ["sans complément", enregistree],
    ["avec complément", VALEURS_CA23],
    ["loyer minimal", { ...VALEURS_CA23, rentInCents: 1, chargesInCents: 0 }],
    ["montants maximaux", { ...VALEURS_CA23, rentInCents: 9999999, chargesInCents: 9999999 }],
    ["jour 31", { ...VALEURS_CA23, dueDay: 31 }],
    ["début à la borne basse", { ...VALEURS_CA23, startDate: "1950-01-01" }],
  ])("CA32 — toRentalFormFields puis validateRentalForm redonne les mêmes valeurs (%s)", (_cas, valeurs) => {
    expect(validateRentalForm(toRentalFormFields(valeurs))).toEqual({ ok: true, values: valeurs });
  });
});
