import { describe, expect, it } from "vitest";

import {
  checkStartAgainstEnd,
  DATE_MAX,
  DATE_MIN,
  formatDate,
  getRentalStatus,
  getTodayInParis,
  parseDateInput,
  parseEndDateInput,
  RENTAL_STATUS_LABELS,
  toDateInputValue,
} from "./rental-dates";

const ok = (value: string) => ({ ok: true, value });
const ko = (error: string) => ({ ok: false, error });

describe("parseDateInput (R19)", () => {
  it.each([
    ["2026-01-05"],
    ["2028-02-29"],
    ["2000-02-29"],
    ["1950-01-01"],
    ["2099-12-31"],
  ])("CA13 — accepte %s", (date) => {
    expect(parseDateInput(date, "start")).toEqual(ok(date));
    expect(parseDateInput(date, "end")).toEqual(ok(date));
  });

  it("CA13 — champ vide : L19 pour le début, L23 pour la fin", () => {
    expect(parseDateInput("", "start")).toEqual(ko("L19"));
    expect(parseDateInput("", "end")).toEqual(ko("L23"));
  });

  it.each([
    ["2027-02-29"],
    ["2026-02-30"],
    ["2026-04-31"],
    ["2026-13-01"],
    ["2026-00-10"],
    ["2026-01-00"],
    ["2026-01-32"],
    ["2026-12-32"],
    ["0000-00-00"],
  ])("CA13 — %s est impossible (L20)", (date) => {
    expect(parseDateInput(date, "start")).toEqual(ko("L20"));
    expect(parseDateInput(date, "end")).toEqual(ko("L20"));
  });

  it.each([
    ["05/01/2026"],
    ["2026-1-5"],
    ["26-01-05"],
    ["2026-01-05T00:00"],
    ["2026-01-05T00:00:00Z"],
    ["2026-01-05 00:00"],
    ["20260105"],
    ["demain"],
    ["2026/01/05"],
    ["2026.01.05"],
    ["2026-01-051"],
    ["12026-01-05"],
    ["+2026-01-05"],
    [" 2026-01-05"],
    ["2026-01-05 "],
    ["2026-01-05\n"],
    ["２０２６-０１-０５"], // chiffres pleine largeur
    ["٢٠٢٦-٠١-٠٥"], // chiffres arabes-indiens
  ])("CA13 — %j n'a pas la forme AAAA-MM-JJ (L20)", (saisie) => {
    expect(parseDateInput(saisie, "start")).toEqual(ko("L20"));
    expect(parseDateInput(saisie, "end")).toEqual(ko("L20"));
  });

  it("CA13 — une saisie faite d'espaces n'est pas de la forme AAAA-MM-JJ (lecture non tranchée par R19 : vide ou autre format ; comportement actuel L20)", () => {
    expect(parseDateInput("   ", "start")).toEqual(ko("L20"));
  });

  it.each([["1949-12-31"], ["2100-01-01"], ["9999-12-31"], ["0001-01-01"], ["1900-01-01"]])(
    "CA13 — %s est hors bornes (L21)",
    (date) => {
      expect(parseDateInput(date, "start")).toEqual(ko("L21"));
      expect(parseDateInput(date, "end")).toEqual(ko("L21"));
    },
  );

  it("CA13 — les bornes exportées sont celles de R19", () => {
    expect(DATE_MIN).toBe("1950-01-01");
    expect(DATE_MAX).toBe("2099-12-31");
  });

  it("CA13 — le jour qui précède la borne basse et celui qui suit la borne haute sont refusés, les bornes acceptées", () => {
    expect(parseDateInput("1949-12-31", "start")).toEqual(ko("L21"));
    expect(parseDateInput("1950-01-01", "start")).toEqual(ok("1950-01-01"));
    expect(parseDateInput("2099-12-31", "start")).toEqual(ok("2099-12-31"));
    expect(parseDateInput("2100-01-01", "start")).toEqual(ko("L21"));
  });

  it("la forme et l'existence du jour passent avant les bornes (ordre de la spécification)", () => {
    expect(parseDateInput("2100-02-29", "start")).toEqual(ko("L20"));
    expect(parseDateInput("1900-02-29", "start")).toEqual(ko("L20"));
    expect(parseDateInput("1949-13-01", "start")).toEqual(ko("L20"));
  });

  describe("jours de chaque mois", () => {
    it.each(["01", "03", "05", "07", "08", "10", "12"])(
      "le mois %s a 31 jours",
      (mois) => {
        expect(parseDateInput(`2026-${mois}-31`, "start")).toEqual(ok(`2026-${mois}-31`));
        expect(parseDateInput(`2026-${mois}-32`, "start")).toEqual(ko("L20"));
      },
    );

    it.each(["04", "06", "09", "11"])("le mois %s a 30 jours", (mois) => {
      expect(parseDateInput(`2026-${mois}-30`, "start")).toEqual(ok(`2026-${mois}-30`));
      expect(parseDateInput(`2026-${mois}-31`, "start")).toEqual(ko("L20"));
    });
  });

  describe("29 février", () => {
    it.each(["1952", "1996", "2000", "2024", "2028", "2096"])(
      "%s est bissextile : le 29 février existe",
      (annee) => {
        expect(parseDateInput(`${annee}-02-29`, "start")).toEqual(ok(`${annee}-02-29`));
        expect(parseDateInput(`${annee}-02-30`, "start")).toEqual(ko("L20"));
      },
    );

    it.each(["1951", "2023", "2025", "2026", "2027", "2029", "2099"])(
      "%s n'est pas bissextile : le 29 février n'existe pas (L20), le 28 existe",
      (annee) => {
        expect(parseDateInput(`${annee}-02-29`, "start")).toEqual(ko("L20"));
        expect(parseDateInput(`${annee}-02-28`, "start")).toEqual(ok(`${annee}-02-28`));
      },
    );

    it("2000 est bissextile (divisible par 400)", () => {
      expect(parseDateInput("2000-02-29", "start")).toEqual(ok("2000-02-29"));
    });

    it("1900 et 2100 ne sont pas bissextiles (divisibles par 100 mais pas par 400) : le 29 février n'existe pas", () => {
      expect(parseDateInput("1900-02-29", "start")).toEqual(ko("L20"));
      expect(parseDateInput("2100-02-29", "start")).toEqual(ko("L20"));
    });

    it("1900-02-28 et 2100-02-28 existent mais sont hors bornes (L21)", () => {
      expect(parseDateInput("1900-02-28", "start")).toEqual(ko("L21"));
      expect(parseDateInput("2100-02-28", "start")).toEqual(ko("L21"));
    });
  });
});

describe("parseEndDateInput (R21)", () => {
  const debut = "2026-01-05";

  it("CA13 — une date de fin égale à la date de début est acceptée (bail d'un jour)", () => {
    expect(parseEndDateInput("2026-01-05", debut)).toEqual(ok("2026-01-05"));
  });

  it("CA13 — une date de fin antérieure d'un jour est refusée (L24)", () => {
    expect(parseEndDateInput("2026-01-04", debut)).toEqual(ko("L24"));
  });

  it("une date de fin postérieure d'un jour est acceptée", () => {
    expect(parseEndDateInput("2026-01-06", debut)).toEqual(ok("2026-01-06"));
  });

  it("la comparaison traverse les mois et les années", () => {
    expect(parseEndDateInput("2026-02-28", "2026-03-01")).toEqual(ko("L24"));
    expect(parseEndDateInput("2026-12-31", "2027-01-01")).toEqual(ko("L24"));
    expect(parseEndDateInput("2027-01-01", "2026-12-31")).toEqual(ok("2027-01-01"));
    expect(parseEndDateInput("2099-12-31", "2026-01-05")).toEqual(ok("2099-12-31"));
  });

  it("une date de fin vide donne L23", () => {
    expect(parseEndDateInput("", debut)).toEqual(ko("L23"));
  });

  it("une date de fin impossible donne L20, pas L24", () => {
    expect(parseEndDateInput("2026-02-30", debut)).toEqual(ko("L20"));
  });

  it("une date de fin hors bornes donne L21, avant la cohérence avec le début", () => {
    expect(parseEndDateInput("2100-01-01", debut)).toEqual(ko("L21"));
    expect(parseEndDateInput("1949-12-31", debut)).toEqual(ko("L21"));
  });
});

describe("checkStartAgainstEnd (R22)", () => {
  it("CA13 — début postérieur d'un jour à la fin existante : L22", () => {
    expect(checkStartAgainstEnd("2026-01-06", "2026-01-05")).toBe("L22");
  });

  it("début égal à la fin existante : accepté", () => {
    expect(checkStartAgainstEnd("2026-01-05", "2026-01-05")).toBeNull();
  });

  it("début antérieur à la fin existante : accepté", () => {
    expect(checkStartAgainstEnd("2026-01-04", "2026-01-05")).toBeNull();
  });

  it("sans date de fin : accepté, quel que soit le début", () => {
    expect(checkStartAgainstEnd("2099-12-31", null)).toBeNull();
  });

  it("la comparaison traverse les mois et les années", () => {
    expect(checkStartAgainstEnd("2027-01-01", "2026-12-31")).toBe("L22");
    expect(checkStartAgainstEnd("2026-03-01", "2026-02-28")).toBe("L22");
    expect(checkStartAgainstEnd("2026-12-31", "2027-01-01")).toBeNull();
  });
});

describe("formatDate (R19)", () => {
  it.each([
    ["2026-01-05", "05/01/2026"],
    ["2026-01-01", "01/01/2026"],
    ["1950-01-01", "01/01/1950"],
    ["2099-12-31", "31/12/2099"],
    ["2028-02-29", "29/02/2028"],
    ["2026-10-11", "11/10/2026"],
  ])("CA13 — %s s'affiche %s", (date, attendu) => {
    expect(formatDate(date)).toBe(attendu);
  });

  it("CA13 — ne passe par aucune conversion de fuseau : 2026-01-01 reste 01/01/2026 (la suite est lancée sous trois fuseaux)", () => {
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });
});

describe("RENTAL_STATUS_LABELS (R39)", () => {
  it("les deux libellés sont En cours et Terminée", () => {
    expect(Object.values(RENTAL_STATUS_LABELS).sort()).toEqual(["En cours", "Terminée"]);
  });
});

// Statut, de bout en bout : la date du jour est celle de Paris pour l'instant
// donné, puis la règle de statut (R20). Le libellé évite de dépendre du nom
// interne des statuts.
function statutA(dateDeFin: string | null, instant: string): string {
  return RENTAL_STATUS_LABELS[
    getRentalStatus(dateDeFin, getTodayInParis(new Date(instant)))
  ];
}

describe("statut d'une location (R20)", () => {
  it.each([
    [null, "2026-10-11T10:00:00Z", "En cours"],
    [null, "1999-01-01T00:00:00Z", "En cours"],
    [null, "2098-06-30T12:00:00Z", "En cours"],
    ["2026-10-31", "2026-10-31T22:59:59Z", "En cours"],
    ["2026-10-31", "2026-10-31T23:00:00Z", "Terminée"],
    ["2027-06-30", "2027-06-30T21:59:59Z", "En cours"],
    ["2027-06-30", "2027-06-30T22:00:00Z", "Terminée"],
    ["2026-12-31", "2026-12-31T23:30:00Z", "Terminée"],
    ["2027-01-01", "2026-12-31T23:30:00Z", "En cours"],
    ["2099-12-31", "2026-10-11T10:00:00Z", "En cours"],
  ])("CA14 — fin %j à l'instant %s : %s", (fin, instant, attendu) => {
    expect(statutA(fin, instant)).toBe(attendu);
  });

  it("CA14 — le jour de la date de fin, la location est encore en cours", () => {
    expect(getRentalStatus("2026-10-11", "2026-10-11")).toBe(getRentalStatus(null, "2026-10-11"));
    expect(RENTAL_STATUS_LABELS[getRentalStatus("2026-10-11", "2026-10-11")]).toBe("En cours");
  });

  it("CA14 — la veille de la date de fin : en cours ; le lendemain : terminée", () => {
    expect(RENTAL_STATUS_LABELS[getRentalStatus("2026-10-12", "2026-10-11")]).toBe("En cours");
    expect(RENTAL_STATUS_LABELS[getRentalStatus("2026-10-10", "2026-10-11")]).toBe("Terminée");
  });

  it("CA14 — la comparaison traverse les mois et les années", () => {
    expect(RENTAL_STATUS_LABELS[getRentalStatus("2026-12-31", "2027-01-01")]).toBe("Terminée");
    expect(RENTAL_STATUS_LABELS[getRentalStatus("2026-02-28", "2026-03-01")]).toBe("Terminée");
    expect(RENTAL_STATUS_LABELS[getRentalStatus("2028-02-29", "2028-02-29")]).toBe("En cours");
  });

  it("sans date de fin, la location est en cours, même si elle a commencé il y a longtemps", () => {
    expect(RENTAL_STATUS_LABELS[getRentalStatus(null, "2099-12-31")]).toBe("En cours");
  });
});

describe("getTodayInParis (R20)", () => {
  it.each([
    // Minuit à Paris en hiver (UTC+1) : encore la veille en UTC, déjà le lendemain.
    ["2026-10-31T22:59:59Z", "2026-10-31"],
    ["2026-10-31T23:00:00Z", "2026-11-01"],
    ["2026-01-14T22:59:59Z", "2026-01-14"],
    ["2026-01-14T23:00:00Z", "2026-01-15"],
    // Minuit à Paris en été (UTC+2).
    ["2027-06-30T21:59:59Z", "2027-06-30"],
    ["2027-06-30T22:00:00Z", "2027-07-01"],
    // Paris est déjà le lendemain alors que l'UTC est encore le même jour.
    ["2026-07-14T22:30:00Z", "2026-07-15"],
    // Milieu de journée.
    ["2026-10-11T10:00:00Z", "2026-10-11"],
    ["2026-10-11T00:00:00Z", "2026-10-11"],
  ])("instant %s : %s", (instant, attendu) => {
    expect(getTodayInParis(new Date(instant))).toBe(attendu);
  });

  describe("changements d'heure de 2026", () => {
    // Passage à l'heure d'été : dimanche 29 mars 2026, 01:00 UTC (02:00 -> 03:00).
    it.each([
      ["2026-03-28T22:59:59Z", "2026-03-28"],
      ["2026-03-28T23:00:00Z", "2026-03-29"],
      ["2026-03-29T00:59:59Z", "2026-03-29"],
      ["2026-03-29T01:00:00Z", "2026-03-29"],
      ["2026-03-29T21:59:59Z", "2026-03-29"], // 23:59:59 CEST
      ["2026-03-29T22:00:00Z", "2026-03-30"], // 00:00 CEST
    ])("passage à l'heure d'été — %s : %s", (instant, attendu) => {
      expect(getTodayInParis(new Date(instant))).toBe(attendu);
    });

    // Retour à l'heure d'hiver : dimanche 25 octobre 2026, 01:00 UTC (03:00 -> 02:00).
    it.each([
      ["2026-10-24T21:59:59Z", "2026-10-24"], // 23:59:59 CEST
      ["2026-10-24T22:00:00Z", "2026-10-25"], // 00:00 CEST
      ["2026-10-25T00:59:59Z", "2026-10-25"],
      ["2026-10-25T01:00:00Z", "2026-10-25"],
      ["2026-10-25T22:59:59Z", "2026-10-25"], // 23:59:59 CET
      ["2026-10-25T23:00:00Z", "2026-10-26"], // 00:00 CET
    ])("retour à l'heure d'hiver — %s : %s", (instant, attendu) => {
      expect(getTodayInParis(new Date(instant))).toBe(attendu);
    });
  });

  describe("fins d'année et 29 février", () => {
    it.each([
      ["2026-12-30T23:00:00Z", "2026-12-31"],
      ["2026-12-31T22:59:59Z", "2026-12-31"],
      ["2026-12-31T23:00:00Z", "2027-01-01"],
      ["2026-12-31T23:30:00Z", "2027-01-01"],
      ["2099-12-31T22:59:59Z", "2099-12-31"],
      ["2099-12-31T23:00:00Z", "2100-01-01"],
    ])("31 décembre — %s : %s", (instant, attendu) => {
      expect(getTodayInParis(new Date(instant))).toBe(attendu);
    });

    it.each([
      ["2028-02-28T22:59:59Z", "2028-02-28"],
      ["2028-02-28T23:00:00Z", "2028-02-29"],
      ["2028-02-29T22:59:59Z", "2028-02-29"],
      ["2028-02-29T23:00:00Z", "2028-03-01"],
    ])("année bissextile — %s : %s", (instant, attendu) => {
      expect(getTodayInParis(new Date(instant))).toBe(attendu);
    });

    it.each([
      ["2027-02-28T22:59:59Z", "2027-02-28"],
      ["2027-02-28T23:00:00Z", "2027-03-01"],
    ])("année non bissextile — %s : %s", (instant, attendu) => {
      expect(getTodayInParis(new Date(instant))).toBe(attendu);
    });
  });

  it("rend toujours une date AAAA-MM-JJ", () => {
    expect(getTodayInParis(new Date("2026-01-05T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getTodayInParis(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });

  it("le résultat ne dépend pas du fuseau du processus : mêmes dates pour les mêmes instants, que la suite tourne sous UTC, America/Los_Angeles ou Pacific/Kiritimati (voir le compte rendu)", () => {
    const attendus: Array<[string, string]> = [
      ["2026-10-31T22:59:59Z", "2026-10-31"],
      ["2026-10-31T23:00:00Z", "2026-11-01"],
      ["2026-12-31T23:30:00Z", "2027-01-01"],
      ["2028-02-29T22:59:59Z", "2028-02-29"],
    ];
    for (const [instant, date] of attendus) {
      expect(getTodayInParis(new Date(instant))).toBe(date);
    }
  });
});

// Valeur donnée à un champ <input type="date"> quand on réaffiche une saisie.
// Source : note de tête de la spécification 03 (« après L20, il revient vide, le
// message restant affiché ») et R19. CA36 demande que la valeur « soit conservée »
// pour 2100-01-01 (L21) : une date réelle hors bornes reste donc affichée.
describe("toDateInputValue (R19, note de tête, CA24, CA36)", () => {
  it.each(["2026-01-05", "2028-02-29", "2000-02-29", "1950-01-01", "2099-12-31"])(
    "R19 — la date valide %s est rendue telle quelle",
    (date) => {
      expect(toDateInputValue(date)).toBe(date);
    },
  );

  it.each([
    ["chaîne vide", ""],
    ["espaces seules", "   "],
    ["espace autour d'une date valide", " 2026-01-05 "],
  ])("CA24 — %s : champ vide", (_nom, saisie) => {
    expect(toDateInputValue(saisie)).toBe("");
  });

  it.each(["05/01/2026", "2026-1-5", "26-01-05", "20260105", "demain"])(
    "R19 — le format %s (L20) : champ vide",
    (saisie) => {
      expect(toDateInputValue(saisie)).toBe("");
    },
  );

  it("R19 — une date avec heure (2026-01-05T00:00, L20) : champ vide", () => {
    expect(toDateInputValue("2026-01-05T00:00")).toBe("");
  });

  it.each([
    ["30 février", "2026-02-30"],
    ["29 février d'une année non bissextile", "2027-02-29"],
    ["31 avril", "2026-04-31"],
    ["mois 13", "2026-13-01"],
    ["mois 00", "2026-00-10"],
    ["jour 0", "2026-01-00"],
  ])("R19 — %s (L20) : champ vide", (_nom, saisie) => {
    expect(toDateInputValue(saisie)).toBe("");
  });

  it("R19 — 1900 n'est pas bissextile (siècle) : 1900-02-29 est vidée", () => {
    expect(toDateInputValue("1900-02-29")).toBe("");
  });

  it("R19 — 2000 est bissextile : 2000-02-29 est conservée", () => {
    expect(toDateInputValue("2000-02-29")).toBe("2000-02-29");
  });

  it("R19 — 1900-02-28 existe : conservée (hors bornes, L21)", () => {
    expect(toDateInputValue("1900-02-28")).toBe("1900-02-28");
  });

  it("note de tête — l'année 0000 n'existe pas pour un champ de date : vidée", () => {
    expect(toDateInputValue("0000-01-01")).toBe("");
  });

  // La spécification ne dit pas ce que le champ affiche pour une date réelle
  // hors bornes ; CA36 dit seulement « la valeur saisie est conservée » pour
  // 2100-01-01. On fige donc : conservée, le message L21 expliquant l'erreur.
  it.each(["1949-12-31", "2100-01-01", "9999-12-31"])(
    "CA36 — la date réelle hors bornes %s (L21) est conservée",
    (date) => {
      expect(toDateInputValue(date)).toBe(date);
    },
  );
});
