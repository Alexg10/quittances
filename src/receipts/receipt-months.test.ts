import { describe, expect, it } from "vitest";

import {
  formatMonthInSentence,
  formatMonthLabel,
  formatMonthOption,
  getAcceptedMonths,
  getReceiptPeriod,
  isMonthAccepted,
  parseMonthInput,
  validateMonthInput,
} from "./receipt-months";

const ok = (value: string) => ({ ok: true, value });
const ko = (error: string) => ({ ok: false, error });

// Liste des mois de `from` à `to` inclus, pour écrire les tables sans les recopier.
function mois(from: string, to: string): string[] {
  const result: string[] = [];
  let [y, m] = from.split("-").map(Number);
  for (;;) {
    const current = `${y}-${String(m).padStart(2, "0")}`;
    result.push(current);
    if (current === to) return result;
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
}

describe("getAcceptedMonths (R8)", () => {
  // Une ligne par ligne de la table de R8 : début, fin, instant UTC, derniers mois attendus.
  it.each([
    ["15/01/2026, sans fin, 12/10 midi", "2026-01-15", null, "2026-10-12T10:00:00Z", mois("2026-01", "2026-10")],
    ["31/10 à 23:59:59 à Paris", "2026-01-15", null, "2026-10-31T22:59:59Z", mois("2026-01", "2026-10")],
    ["01/11 à 00:00:00 à Paris", "2026-01-15", null, "2026-10-31T23:00:00Z", mois("2026-01", "2026-11")],
    ["30/06/2027 à 23:59:59 à Paris", "2026-01-15", null, "2027-06-30T21:59:59Z", mois("2026-01", "2027-06")],
    ["01/07/2027 à 00:00:00 à Paris (30 juin en UTC)", "2026-01-15", null, "2027-06-30T22:00:00Z", mois("2026-01", "2027-07")],
    ["01/01/2027 à 00:30 à Paris (31 décembre en UTC)", "2026-01-15", null, "2026-12-31T23:30:00Z", mois("2026-01", "2027-01")],
    ["bail terminé le 20/03/2026", "2026-01-15", "2026-03-20", "2026-10-12T10:00:00Z", ["2026-01", "2026-02", "2026-03"]],
    ["fin à venir (31/03/2027)", "2025-01-01", "2027-03-31", "2026-10-12T10:00:00Z", mois("2025-01", "2026-10")],
    ["bail commençant le 01/11 : la veille à 23:59:59 Paris", "2026-11-01", null, "2026-10-31T22:59:59Z", []],
    ["bail commençant le 01/11 : à minuit Paris", "2026-11-01", null, "2026-10-31T23:00:00Z", ["2026-11"]],
    ["bail commençant demain", "2026-10-13", null, "2026-10-12T10:00:00Z", ["2026-10"]],
    ["bail d'un seul jour, aujourd'hui", "2026-10-12", "2026-10-12", "2026-10-12T10:00:00Z", ["2026-10"]],
  ])("CA8 — %s", (_cas, debut, fin, instant, attendus) => {
    expect(getAcceptedMonths(debut, fin, new Date(instant))).toEqual(attendus);
  });

  it("CA8 — la table de R8 compte dix mois, puis vingt-deux mois pour le bail du 01/01/2025", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    expect(getAcceptedMonths("2026-01-15", null, now)).toHaveLength(10);
    expect(getAcceptedMonths("2025-01-01", "2027-03-31", now)).toHaveLength(22);
  });

  it("CA8 — le premier mois est celui du début du bail, même commencé le dernier jour du mois", () => {
    const months = getAcceptedMonths("2026-01-31", null, new Date("2026-03-15T10:00:00Z"));
    expect(months).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("CA8 — le dernier mois est celui de la fin, même terminée le premier jour du mois", () => {
    const months = getAcceptedMonths("2026-01-15", "2026-04-01", new Date("2026-10-12T10:00:00Z"));
    expect(months.at(-1)).toBe("2026-04");
  });

  it("CA8 — ne propose jamais un mois futur, quelle que soit la date de fin", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    expect(getAcceptedMonths("2026-01-15", "2099-12-31", now).at(-1)).toBe("2026-10");
    expect(getAcceptedMonths("2026-01-15", null, now)).not.toContain("2026-11");
  });

  it("CA8 — passe d'un 31 décembre à janvier de l'année suivante sans mois « 13 »", () => {
    const months = getAcceptedMonths("2026-11-05", null, new Date("2027-02-10T10:00:00Z"));
    expect(months).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("CA8 — le 29 février à Paris, le mois courant est février", () => {
    const now = new Date("2028-02-29T12:00:00Z");
    expect(getAcceptedMonths("2028-01-10", null, now)).toEqual(["2028-01", "2028-02"]);
  });

  it("CA8 — le soir du 29 février en UTC, c'est déjà mars à Paris", () => {
    const now = new Date("2028-02-29T23:30:00Z");
    expect(getAcceptedMonths("2028-01-10", null, now)).toEqual(["2028-01", "2028-02", "2028-03"]);
  });

  it("CA8 — le changement d'heure de printemps (29/03/2026) ne décale pas le mois", () => {
    // 2026-03-31T21:59:59Z = 23:59:59 à Paris (heure d'été) ; 22:00:00Z = 00:00:00 le 1er avril.
    expect(getAcceptedMonths("2026-01-01", null, new Date("2026-03-31T21:59:59Z")).at(-1)).toBe("2026-03");
    expect(getAcceptedMonths("2026-01-01", null, new Date("2026-03-31T22:00:00Z")).at(-1)).toBe("2026-04");
  });

  it("CA8 — le changement d'heure d'automne (25/10/2026) ne décale pas le mois", () => {
    // 2026-11-30T22:59:59Z = 23:59:59 à Paris (heure d'hiver) ; 23:00:00Z = 00:00:00 le 1er décembre.
    expect(getAcceptedMonths("2026-01-01", null, new Date("2026-11-30T22:59:59Z")).at(-1)).toBe("2026-11");
    expect(getAcceptedMonths("2026-01-01", null, new Date("2026-11-30T23:00:00Z")).at(-1)).toBe("2026-12");
  });

  it("CA8 — le 1er janvier à Paris, le mois courant est janvier de la nouvelle année", () => {
    const now = new Date("2026-12-31T23:00:00Z");
    expect(getAcceptedMonths("2026-01-15", null, now).at(-1)).toBe("2027-01");
  });
});

describe("isMonthAccepted (R8)", () => {
  const now = new Date("2026-10-12T10:00:00Z");

  it.each([
    ["2026-01", true],
    ["2026-10", true],
    ["2026-11", false],
    ["2025-12", false],
    ["2099-12", false],
  ])("CA8 — bail du 15/01/2026 sans fin : %s accepté = %s", (month, attendu) => {
    expect(isMonthAccepted(month, "2026-01-15", null, now)).toBe(attendu);
  });

  it("CA8 — le mois suivant la fin du bail est refusé, celui de la fin accepté", () => {
    expect(isMonthAccepted("2026-03", "2026-01-15", "2026-03-20", now)).toBe(true);
    expect(isMonthAccepted("2026-04", "2026-01-15", "2026-03-20", now)).toBe(false);
  });

  it("CA8 — le mois qui suit le mois courant est refusé, même à la dernière seconde du mois à Paris", () => {
    expect(isMonthAccepted("2026-11", "2026-01-15", null, new Date("2026-10-31T22:59:59Z"))).toBe(false);
    expect(isMonthAccepted("2026-11", "2026-01-15", null, new Date("2026-10-31T23:00:00Z"))).toBe(true);
  });

  it("CA8 — est d'accord avec getAcceptedMonths pour tous les mois d'une plage", () => {
    const accepted = getAcceptedMonths("2026-01-15", "2026-08-02", now);
    for (const month of mois("2025-10", "2027-02")) {
      expect(isMonthAccepted(month, "2026-01-15", "2026-08-02", now)).toBe(accepted.includes(month));
    }
  });
});

describe("getReceiptPeriod (R9)", () => {
  // Une ligne par ligne de la table de R9.
  it.each([
    ["2026-01-15", null, "2026-01", "2026-01-15", "2026-01-31", false],
    ["2026-01-15", null, "2026-02", "2026-02-01", "2026-02-28", true],
    ["2026-01-15", null, "2028-02", "2028-02-01", "2028-02-29", true],
    ["2026-01-15", null, "2026-12", "2026-12-01", "2026-12-31", true],
    ["2026-01-31", null, "2026-01", "2026-01-31", "2026-01-31", false],
    ["2028-02-29", null, "2028-02", "2028-02-29", "2028-02-29", false],
    ["2026-01-15", "2026-03-20", "2026-03", "2026-03-01", "2026-03-20", false],
    ["2026-03-10", "2026-03-20", "2026-03", "2026-03-10", "2026-03-20", false],
    ["2026-01-15", "2026-06-30", "2026-06", "2026-06-01", "2026-06-30", true],
    ["2026-01-15", "2026-04-01", "2026-04", "2026-04-01", "2026-04-01", false],
  ])("CA9 — bail %s → %s, mois %s : du %s au %s (complète : %s)", (debut, fin, month, start, end, complete) => {
    expect(getReceiptPeriod(month, debut, fin)).toEqual({ start, end, complete });
  });

  it("CA9 — un mois de 30 jours finit le 30, un mois de 31 jours le 31", () => {
    expect(getReceiptPeriod("2026-04", "2026-01-01", null).end).toBe("2026-04-30");
    expect(getReceiptPeriod("2026-05", "2026-01-01", null).end).toBe("2026-05-31");
  });

  it("CA9 — février 2100 n'est pas bissextile, février 2000 l'est", () => {
    expect(getReceiptPeriod("2100-02", "2000-01-01", null).end).toBe("2100-02-28");
    expect(getReceiptPeriod("2000-02", "2000-01-01", null).end).toBe("2000-02-29");
  });

  it("CA9 — un bail qui finit après le mois n'écourte pas la période", () => {
    expect(getReceiptPeriod("2026-02", "2026-01-15", "2026-05-10")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
      complete: true,
    });
  });
});

describe("parseMonthInput et validateMonthInput (R10)", () => {
  const now = new Date("2026-10-12T10:00:00Z");

  it.each([
    [""],
    ["2026-13"],
    ["2026-00"],
    ["2026-1"],
    ["26-10"],
    ["2026-10-01"],
    ["2026/10"],
    ["octobre 2026"],
    ["２０２６-10"],
    ["../"],
    ["2026-10\n"],
    [" 2026-10"],
    ["2026-10 "],
    ["2026-１0"],
    ["x".repeat(10_000)],
  ])("CA10 — %j est mal formé (Q1)", (valeur) => {
    expect(parseMonthInput(valeur)).toEqual(ko("Q1"));
    expect(validateMonthInput(valeur, "2026-01-15", null, now)).toEqual(ko("Q1"));
  });

  it("CA10 — lit 2026-10", () => {
    expect(parseMonthInput("2026-10")).toEqual(ok("2026-10"));
  });

  it.each([["2026-01"], ["2026-09"], ["2026-12"], ["1999-07"]])("CA10 — lit %s (forme seule)", (valeur) => {
    expect(parseMonthInput(valeur)).toEqual(ok(valeur));
  });

  it.each([
    ["2099-12", "2026-01-15", null],
    ["2025-12", "2026-01-15", null],
    ["2026-04", "2026-01-15", "2026-03-20"],
    ["2026-11", "2026-01-15", null],
  ])("CA10 — %s, bail du %s au %s : bien formé mais refusé (Q2)", (valeur, debut, fin) => {
    expect(validateMonthInput(valeur, debut, fin, now)).toEqual(ko("Q2"));
  });

  it("CA10 — un mois bien formé et accepté est rendu tel quel", () => {
    expect(validateMonthInput("2026-03", "2026-01-15", "2026-03-20", now)).toEqual(ok("2026-03"));
  });

  it("CA10 — un mois mal formé donne Q1 même si le bail le rendrait impossible (pas Q2)", () => {
    expect(validateMonthInput("2099-13", "2026-01-15", null, now)).toEqual(ko("Q1"));
  });
});

describe("formatMonthLabel, formatMonthInSentence et formatMonthOption (R11)", () => {
  it("CA10 — 2026-10 s'écrit « Octobre 2026 » et « octobre 2026 »", () => {
    expect(formatMonthLabel("2026-10")).toBe("Octobre 2026");
    expect(formatMonthInSentence("2026-10")).toBe("octobre 2026");
  });

  it("CA10 — 2026-08 s'écrit « Août 2026 » et 2026-02 « Février 2026 »", () => {
    expect(formatMonthLabel("2026-08")).toBe("Août 2026");
    expect(formatMonthLabel("2026-02")).toBe("Février 2026");
  });

  it("R11 — les douze mois, accents compris", () => {
    const attendus = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
    ];
    attendus.forEach((nom, index) => {
      const month = `2026-${String(index + 1).padStart(2, "0")}`;
      expect(formatMonthLabel(month)).toBe(`${nom} 2026`);
      expect(formatMonthInSentence(month)).toBe(`${nom.toLowerCase()} 2026`);
    });
  });

  it("R11 — l'année tient sur quatre chiffres", () => {
    expect(formatMonthLabel("2099-12")).toBe("Décembre 2099");
    expect(formatMonthLabel("1999-01")).toBe("Janvier 1999");
  });

  it("CA10 — l'option d'une période incomplète porte les dates exactes", () => {
    const period = getReceiptPeriod("2026-01", "2026-01-15", null);
    expect(formatMonthOption("2026-01", period)).toBe("Janvier 2026 (du 15/01/2026 au 31/01/2026)");
  });

  it("CA10 — l'option d'une période complète est le seul libellé du mois", () => {
    const period = getReceiptPeriod("2026-02", "2026-01-15", null);
    expect(formatMonthOption("2026-02", period)).toBe("Février 2026");
  });

  it("CA10 — l'option d'un mois de fin de bail incomplet signale la date de fin", () => {
    const period = getReceiptPeriod("2026-03", "2026-01-15", "2026-03-20");
    expect(formatMonthOption("2026-03", period)).toBe("Mars 2026 (du 01/03/2026 au 20/03/2026)");
  });
});
