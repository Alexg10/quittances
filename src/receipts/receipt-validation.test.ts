import { describe, expect, it } from "vitest";

import { getReceiptIssueDate, isIssueDateConsistent } from "./receipt-issue-date";
import { receiptErrorMessage } from "./receipt-messages";
import {
  RECEIPT_FORM_FIELDS,
  readReceiptFormFields,
  validateReceiptForm,
  type ReceiptFormContext,
  type ReceiptFormFields,
} from "./receipt-validation";

// Location type : bail du 15/01/2026 au 20/03/2026 (loyer 850,00 €, charges 50,00 €).
const MAINTENANT = new Date("2026-10-12T10:00:00Z");
const CONTEXTE: ReceiptFormContext = { startDate: "2026-01-15", endDate: "2026-03-20", now: MAINTENANT };

// Un formulaire valide pour la location type : février, 850 et 50, payé le 05/02.
const VALIDE: ReceiptFormFields = {
  month: "2026-02",
  rent: "850,00",
  charges: "50,00",
  paymentDate: "2026-02-05",
  attestation: "on",
};

const VIDE: ReceiptFormFields = { month: "", rent: "", charges: "", paymentDate: "", attestation: "" };

function erreurs(fields: ReceiptFormFields, context: ReceiptFormContext = CONTEXTE) {
  const result = validateReceiptForm(fields, context);
  return result.ok ? null : result.errors;
}

describe("validateReceiptForm — cas valide", () => {
  it("rend le mois, la période, les montants en centimes et la date du paiement", () => {
    expect(validateReceiptForm(VALIDE, CONTEXTE)).toEqual({
      ok: true,
      values: {
        month: "2026-02",
        period: { start: "2026-02-01", end: "2026-02-28", complete: true },
        rentInCents: 85000,
        chargesInCents: 5000,
        paymentDate: "2026-02-05",
      },
    });
  });

  it("R9 — la période du dernier mois du bail s'arrête à la date de fin", () => {
    const result = validateReceiptForm({ ...VALIDE, month: "2026-03" }, CONTEXTE);
    expect(result).toMatchObject({
      ok: true,
      values: { period: { start: "2026-03-01", end: "2026-03-20", complete: false } },
    });
  });

  it("R9 — la période du premier mois commence à la date de début du bail", () => {
    const result = validateReceiptForm({ ...VALIDE, month: "2026-01" }, CONTEXTE);
    expect(result).toMatchObject({
      ok: true,
      values: { period: { start: "2026-01-15", end: "2026-01-31", complete: false } },
    });
  });

  it("R12 — les montants saisis sont lus tels quels, sans calcul au prorata sur une période incomplète", () => {
    const result = validateReceiptForm({ ...VALIDE, month: "2026-01", rent: "425,50", charges: "0" }, CONTEXTE);
    expect(result).toMatchObject({ ok: true, values: { rentInCents: 42550, chargesInCents: 0 } });
  });

  it("R35 — le formulaire ne lit que cinq champs", () => {
    expect([...RECEIPT_FORM_FIELDS]).toEqual(["month", "rent", "charges", "paymentDate", "attestation"]);
  });
});

describe("validateReceiptForm — mois (R8, R10)", () => {
  it.each([
    ["vide", "", "Q1"],
    ["mal formé", "2026-13", "Q1"],
    ["en toutes lettres", "février 2026", "Q1"],
    ["avec un saut de ligne", "2026-02\n", "Q1"],
    ["démesuré", "x".repeat(10_000), "Q1"],
    ["avant le bail", "2025-12", "Q2"],
    ["après la fin du bail", "2026-04", "Q2"],
    ["futur lointain", "2099-12", "Q2"],
  ])("CA13 — mois %s (%j) donne %s", (_cas, month, code) => {
    expect(erreurs({ ...VALIDE, month })).toEqual({ month: code });
  });

  it("CA13 — le mois 2026-04 donne Q2 pour la location type", () => {
    expect(erreurs({ ...VALIDE, month: "2026-04" })).toEqual({ month: "Q2" });
  });

  it("R8 — un mois futur est refusé même pour un bail sans fin (le mois prochain)", () => {
    const sansFin: ReceiptFormContext = { startDate: "2026-01-15", endDate: null, now: MAINTENANT };
    expect(erreurs({ ...VALIDE, month: "2026-11" }, sansFin)).toEqual({ month: "Q2" });
    expect(erreurs({ ...VALIDE, month: "2026-10" }, sansFin)).toBeNull();
  });

  it("R8 — le mois courant à Paris dépend de l'instant : refusé à 22:59:59Z, accepté à 23:00:00Z le dernier jour du mois", () => {
    const sansFin = { startDate: "2026-01-15", endDate: null };
    const champs = { ...VALIDE, month: "2026-11", paymentDate: "2026-10-31" };
    expect(erreurs(champs, { ...sansFin, now: new Date("2026-10-31T22:59:59Z") })).toEqual({ month: "Q2" });
    expect(erreurs(champs, { ...sansFin, now: new Date("2026-10-31T23:00:00Z") })).toBeNull();
  });
});

describe("validateReceiptForm — montants (R12)", () => {
  // Table de R15 de la spécification 03 : [saisie, loyer attendu, charges attendues]
  // où un nombre est la valeur en centimes et une chaîne un code d'erreur.
  const TABLE: Array<[string, number | string, number | string]> = [
    ["850", 85000, 85000],
    ["850,00", 85000, 85000],
    ["850.5", 85050, 85050],
    ["850,50 €", 85050, 85050],
    ["1250,5€", 125050, 125050],
    ["1 250,50", 125050, 125050],
    ["1 250,50", 125050, 125050],
    ["1 250,50", 125050, 125050],
    [" 850 ", 85000, 85000],
    ["0,01", 1, 1],
    ["99999,99", 9999999, 9999999],
    ["99 999,99 €", 9999999, 9999999],
    ["0", "L14", 0],
    ["0,00", "L14", 0],
    ["", "L12", "L16"],
    ["   ", "L12", "L16"],
    ["100000", "L15", "L15"],
    ["100 000,00", "L15", "L15"],
    ["1 000 000", "L15", "L15"],
    ["850,555", "L13", "L13"],
    ["1.250", "L13", "L13"],
    ["1,250", "L13", "L13"],
    ["1.250,50", "L13", "L13"],
    ["1,250.50", "L13", "L13"],
    ["850,5,0", "L13", "L13"],
    ["850,", "L13", "L13"],
    ["850.", "L13", "L13"],
    [",50", "L13", "L13"],
    [".5", "L13", "L13"],
    ["12 50", "L13", "L13"],
    ["1  250", "L13", "L13"],
    ["1250 000", "L13", "L13"],
    ["1 2500", "L13", "L13"],
  ];

  it.each(TABLE)("CA13 — loyer %j : %s", (saisie, attenduLoyer) => {
    const result = validateReceiptForm({ ...VALIDE, rent: saisie }, CONTEXTE);
    if (typeof attenduLoyer === "number") {
      expect(result).toMatchObject({ ok: true, values: { rentInCents: attenduLoyer } });
    } else {
      expect(result).toMatchObject({ ok: false, errors: { rent: attenduLoyer } });
    }
  });

  it.each(TABLE)("CA13 — charges %j : %s", (saisie, _loyer, attenduCharges) => {
    const result = validateReceiptForm({ ...VALIDE, charges: saisie }, CONTEXTE);
    if (typeof attenduCharges === "number") {
      expect(result).toMatchObject({ ok: true, values: { chargesInCents: attenduCharges } });
    } else {
      expect(result).toMatchObject({ ok: false, errors: { charges: attenduCharges } });
    }
  });

  it("CA13 — une erreur de loyer n'empêche pas de lire les charges : seules les fautes sont signalées", () => {
    expect(erreurs({ ...VALIDE, rent: "0" })).toEqual({ rent: "L14" });
  });
});

describe("validateReceiptForm — date du paiement (R13)", () => {
  const sansFin = { startDate: "2026-01-15", endDate: null };
  const paiement = (paymentDate: string, now: Date, month = "2026-10") =>
    erreurs({ ...VALIDE, month, paymentDate }, { ...sansFin, now });

  // Table de R13.
  it.each([
    ["2026-10-31T22:59:59Z", "2026-10-31", null],
    ["2026-10-31T22:59:59Z", "2026-11-01", "Q5"],
    ["2026-10-31T22:59:59Z", "2026-11-02", "Q5"],
    ["2026-10-31T23:00:00Z", "2026-10-31", null],
    ["2026-10-31T23:00:00Z", "2026-11-01", null],
    ["2026-10-31T23:00:00Z", "2026-11-02", "Q5"],
  ])("CA13 — à %s (Paris), un paiement daté du %s : %s", (instant, date, attendu) => {
    const result = paiement(date, new Date(instant), "2026-10");
    expect(result?.paymentDate ?? null).toBe(attendu);
  });

  it("CA13 — à 2026-10-12T10:00:00Z, 2026-10-25 donne Q5 et 2026-10-12 est acceptée", () => {
    expect(paiement("2026-10-25", MAINTENANT)).toEqual({ paymentDate: "Q5" });
    expect(paiement("2026-10-12", MAINTENANT)).toBeNull();
  });

  it("CA13 — une date vide donne Q4", () => {
    expect(paiement("", MAINTENANT)).toEqual({ paymentDate: "Q4" });
  });

  it("CA13 — une date faite d'espaces ne passe pas pour une date valide", () => {
    expect(paiement("   ", MAINTENANT)?.paymentDate).toMatch(/^(Q4|L20)$/);
  });

  it.each([["2026-02-30"], ["2027-02-29"], ["2026-13-01"], ["26-02-01"], ["12/02/2026"]])(
    "CA13 — %j donne L20",
    (date) => {
      expect(paiement(date, MAINTENANT)).toEqual({ paymentDate: "L20" });
    },
  );

  it("CA13 — 1949-12-31 donne L21 et 1950-01-01 est acceptée", () => {
    expect(paiement("1949-12-31", MAINTENANT)).toEqual({ paymentDate: "L21" });
    expect(paiement("1950-01-01", MAINTENANT)).toBeNull();
  });

  it("R13 — au-delà de 2099, c'est la borne de R19 (L21) qui répond, pas le futur (Q5)", () => {
    expect(paiement("2100-01-01", MAINTENANT)).toEqual({ paymentDate: "L21" });
  });

  it("R13 — un paiement futur, même dans les bornes de R19, donne Q5", () => {
    expect(paiement("2099-12-31", MAINTENANT)).toEqual({ paymentDate: "Q5" });
  });

  it("R13 — un paiement n'est comparé ni à la période ni au bail : avant le mois couvert ou longtemps après", () => {
    expect(paiement("2025-06-01", MAINTENANT, "2026-02")).toBeNull();
    expect(paiement("2026-10-01", MAINTENANT, "2026-02")).toBeNull();
  });

  it("R13 — le 29 février d'une année bissextile est une date de paiement valide", () => {
    const now = new Date("2028-03-10T10:00:00Z");
    expect(erreurs({ ...VALIDE, month: "2028-02", paymentDate: "2028-02-29" }, { startDate: "2028-01-01", endDate: null, now })).toBeNull();
  });

  it("R13 — l'exemple des treize jours : le 12/10/2026, un paiement du 25/10 est refusé, celui du 12/10 accepté", () => {
    expect(paiement("2026-10-25", MAINTENANT)).toEqual({ paymentDate: "Q5" });
    expect(paiement("2026-10-12", MAINTENANT)).toBeNull();
  });

  it("R13 — pour toute date de paiement acceptée, la date d'émission du même instant n'est pas antérieure", () => {
    const instants = [
      "2026-10-12T10:00:00Z",
      "2026-10-31T22:59:59Z",
      "2026-10-31T23:00:00Z",
      "2026-12-31T23:30:00Z",
      "2028-02-29T23:30:00Z",
    ];
    const dates = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-31", "2026-11-01", "2026-11-02", "2027-01-01", "2028-03-01"];
    for (const instant of instants) {
      const now = new Date(instant);
      for (const date of dates) {
        const result = erreurs({ ...VALIDE, month: "2026-01", paymentDate: date }, { startDate: "2026-01-01", endDate: null, now });
        if (result === null) {
          expect(isIssueDateConsistent(getReceiptIssueDate(now), date), `${instant} / ${date}`).toBe(true);
        }
      }
    }
  });
});

describe("validateReceiptForm — case d'attestation (R14)", () => {
  it("CA13 — la case absente (champ vide) donne Q6", () => {
    expect(erreurs({ ...VALIDE, attestation: "" })).toEqual({ attestation: "Q6" });
  });

  it("R14 — une case cochée envoie la valeur `on` d'une case sans attribut value : quittance produite", () => {
    expect(erreurs({ ...VALIDE, attestation: "on" })).toBeNull();
  });

  it.each([["off"], ["false"], ["0"], ["non"], [" "], ["x".repeat(600)]])("R14 — la valeur %j ne vaut pas case cochée (Q6)", (valeur) => {
    expect(erreurs({ ...VALIDE, attestation: valeur })).toEqual({ attestation: "Q6" });
  });

  it("R14 — la case envoyée deux fois est lue comme absente (Q6), comme tout champ en double", () => {
    const data = new FormData();
    for (const [nom, valeur] of Object.entries(VALIDE)) data.append(nom, valeur);
    data.append("attestation", "on");
    const result = validateReceiptForm(readReceiptFormFields(data), CONTEXTE);
    expect(result).toMatchObject({ ok: false, errors: { attestation: "Q6" } });
  });

  it("R14 — le message de Q6 est celui de la spécification", () => {
    expect(receiptErrorMessage("Q6")).toBe(
      "Cochez la case pour confirmer que le loyer et les charges ont été reçus en totalité.",
    );
  });
});

describe("validateReceiptForm — toutes les erreurs à la fois, valeurs à réafficher", () => {
  it("CA13 — tout envoyer vide donne Q1, L12, L16, Q4 et Q6 à la fois", () => {
    expect(erreurs(VIDE)).toEqual({
      month: "Q1",
      rent: "L12",
      charges: "L16",
      paymentDate: "Q4",
      attestation: "Q6",
    });
  });

  it("R10 de la spécification 03 — plusieurs erreurs différentes sont rendues ensemble, une par champ", () => {
    expect(
      erreurs({ month: "2026-04", rent: "0", charges: "1,250", paymentDate: "2026-02-30", attestation: "" }),
    ).toEqual({ month: "Q2", rent: "L14", charges: "L13", paymentDate: "L20", attestation: "Q6" });
  });

  it("R35 — les valeurs saisies sont rendues telles quelles et la case revient décochée", () => {
    const saisie: ReceiptFormFields = {
      month: "2026-04",
      rent: " 850,00 ",
      charges: "cinquante",
      paymentDate: "2026-02-30",
      attestation: "on",
    };
    const result = validateReceiptForm(saisie, CONTEXTE);
    expect(result).toMatchObject({ ok: false, fields: { ...saisie, attestation: "" } });
  });

  it("R35 — la case revient décochée même quand la case n'est pas la cause de l'erreur", () => {
    const result = validateReceiptForm({ ...VALIDE, rent: "0" }, CONTEXTE);
    expect(result).toMatchObject({ ok: false, fields: { attestation: "" } });
  });

  it("R10 de la spécification 03 — une valeur brute de plus de 500 caractères est réaffichée vide", () => {
    const result = validateReceiptForm({ ...VALIDE, charges: "9".repeat(501) }, CONTEXTE);
    expect(result).toMatchObject({ ok: false, fields: { charges: "", rent: "850,00" } });
    expect(result.ok ? null : result.errors.charges).toBeDefined();
  });

  it("R10 — un mois de 10 000 caractères donne Q1 et n'est pas réaffiché", () => {
    const result = validateReceiptForm({ ...VALIDE, month: "x".repeat(10_000) }, CONTEXTE);
    expect(result).toMatchObject({ ok: false, errors: { month: "Q1" }, fields: { month: "" } });
  });

  it("R14 — aucune valeur n'est rendue quand une erreur existe (rien n'est écrit)", () => {
    const result = validateReceiptForm({ ...VALIDE, attestation: "" }, CONTEXTE);
    expect(result).not.toHaveProperty("values");
  });
});

describe("readReceiptFormFields (R26)", () => {
  it("ignore tout autre champ : propriétaire, dates de période, date d'émission, référence", () => {
    const data = new FormData();
    for (const [nom, valeur] of Object.entries(VALIDE)) data.append(nom, valeur);
    data.append("ownerId", "autre");
    data.append("periodStart", "2026-02-10");
    data.append("issueDate", "2020-01-01");
    data.append("reference", "X");
    const lus = readReceiptFormFields(data);
    expect(lus).toEqual(VALIDE);
  });

  it("lit vide un champ absent, en double ou envoyé comme fichier (mois en double : Q1)", () => {
    const data = new FormData();
    data.append("month", "2026-02");
    data.append("month", "2026-03");
    data.append("rent", new File(["850"], "x.txt"));
    const lus = readReceiptFormFields(data);
    expect(lus).toEqual(VIDE);
    expect(erreurs(lus)?.month).toBe("Q1");
  });
});
