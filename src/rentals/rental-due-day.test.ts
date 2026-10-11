import { describe, expect, it } from "vitest";

import {
  DUE_DAY_HELP_TEXT,
  formatDueDay,
  parseDueDayInput,
} from "./rental-due-day";

describe("parseDueDayInput (R17)", () => {
  it.each([
    ["1", 1],
    ["5", 5],
    ["05", 5],
    ["01", 1],
    ["09", 9],
    ["10", 10],
    ["28", 28],
    ["29", 29],
    ["30", 30],
    ["31", 31],
    [" 15 ", 15],
    ["\t15\n", 15],
    [" 15 ", 15],
  ])("CA12 — accepte %j et enregistre %i", (saisie, jour) => {
    expect(parseDueDayInput(saisie)).toEqual({ ok: true, value: jour });
  });

  it.each([
    ["0"],
    ["00"],
    ["32"],
    ["99"],
    ["005"],
    ["031"],
    ["100"],
    ["1,5"],
    ["1.0"],
    ["1.5"],
    ["-1"],
    ["+5"],
    ["cinq"],
    ["５"],
    ["１５"],
    ["٣"],
    ["١٥"],
    ["1 5"],
    ["3 1"],
    ["1e1"],
    ["0x1"],
    ["15 jours"],
    ["15."],
    ["NaN"],
    ["Infinity"],
  ])("CA12 — refuse %j avec L18", (saisie) => {
    expect(parseDueDayInput(saisie)).toEqual({ ok: false, error: "L18" });
  });

  it("CA12 — une valeur vide donne L17", () => {
    expect(parseDueDayInput("")).toEqual({ ok: false, error: "L17" });
  });

  it("une saisie faite d'espaces est vide après retrait des espaces de bord (R17) : L17", () => {
    expect(parseDueDayInput("   ")).toEqual({ ok: false, error: "L17" });
    expect(parseDueDayInput("\t\n")).toEqual({ ok: false, error: "L17" });
  });

  it("R10 — une valeur brute de plus de 500 caractères donne le message de format L18", () => {
    expect(parseDueDayInput(`${" ".repeat(250)}15${" ".repeat(250)}`)).toEqual({
      ok: false,
      error: "L18",
    });
    expect(parseDueDayInput("1".repeat(501))).toEqual({ ok: false, error: "L18" });
  });
});

describe("DUE_DAY_HELP_TEXT (R33)", () => {
  it("CA12 — texte d'aide mot pour mot", () => {
    expect(DUE_DAY_HELP_TEXT).toBe(
      "Un nombre de 1 à 31. Les mois plus courts, l'échéance tombe le dernier jour du mois.",
    );
  });
});

describe("formatDueDay (« Contenus », page de détail)", () => {
  it.each([1, 5, 15, 27, 28])("CA12 — le %i s'affiche « Le %i de chaque mois »", (jour) => {
    expect(formatDueDay(jour)).toBe(`Le ${jour} de chaque mois`);
  });

  it.each([29, 30, 31])(
    "CA12 — le %i énonce la règle des mois plus courts",
    (jour) => {
      expect(formatDueDay(jour)).toBe(
        `Le ${jour} de chaque mois, ou le dernier jour du mois s'il est plus court`,
      );
    },
  );
});
