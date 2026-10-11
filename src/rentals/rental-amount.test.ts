import { describe, expect, it } from "vitest";

import {
  CHARGES_MAX_IN_CENTS,
  formatAmount,
  formatAmountForInput,
  parseChargesInput,
  parseRentInput,
  RENT_MAX_IN_CENTS,
  totalInCents,
} from "./rental-amount";

// Espaces utilisées dans les saisies et les affichages (R15, R16).
const NBSP = " ";
const NNBSP = " ";

const ok = (value: number) => ({ ok: true, value });
const ko = (error: string) => ({ ok: false, error });

// Les deux champs de montant suivent les mêmes règles de forme (R15) ; ils ne
// diffèrent que par le message du champ vide (L12 / L16) et par le zéro (L14).
const FIELDS = [
  ["loyer", parseRentInput, "L12"],
  ["charges", parseChargesInput, "L16"],
] as const;

describe.each(FIELDS)("saisie d'un montant — %s (R15)", (_nom, parse, emptyCode) => {
  it.each([
    ["850", 85000],
    ["850,00", 85000],
    ["850.5", 85050],
    ["850,50 €", 85050],
    ["1250,5€", 125050],
    ["1 250,50", 125050],
    [`1${NBSP}250,50`, 125050],
    [`1${NNBSP}250,50`, 125050],
    [" 850 ", 85000],
    ["0,01", 1],
    ["99999,99", 9999999],
    ["99 999,99 €", 9999999],
  ])("CA10 — accepte %j et enregistre %i centimes", (saisie, centimes) => {
    expect(parse(saisie)).toEqual(ok(centimes));
  });

  it.each([["100000"], ["100 000,00"], ["1 000 000"]])(
    "CA10 — %j, forme correcte hors bornes, donne L15",
    (saisie) => {
      expect(parse(saisie)).toEqual(ko("L15"));
    },
  );

  it.each([
    ["850,555"],
    ["1.250"],
    ["1,250"],
    ["1.250,50"],
    ["1,250.50"],
    ["850,5,0"],
    ["850,"],
    ["850."],
    [",50"],
    [".5"],
    ["12 50"],
    ["1  250"],
    ["1250 000"],
    ["1 2500"],
    ["-850"],
    ["+850"],
    ["1e3"],
    ["0x10"],
    ["0850"],
    ["00"],
    ["€850"],
    ["850 EUR"],
    ["850 euros"],
    ["850€€"],
    ["huit cents"],
    ["８５０"],
  ])("CA10 — refuse %j avec L13", (saisie) => {
    expect(parse(saisie)).toEqual(ko("L13"));
  });

  it.each([[""], ["   "], ["\t\n"], [`${NBSP}${NNBSP}`]])(
    `CA10 — champ vide ou fait d'espaces (%j) donne ${emptyCode}`,
    (saisie) => {
      expect(parse(saisie)).toEqual(ko(emptyCode));
    },
  );

  it("CA10 — trois décimales : 1.250 n'est jamais lu comme 1250 ni comme 1,25", () => {
    expect(parse("1.250")).toEqual(ko("L13"));
    expect(parse("1.250")).not.toEqual(ok(125000));
  });

  it("CA10 — trois décimales : 850,555 n'est pas arrondi", () => {
    expect(parse("850,555")).toEqual(ko("L13"));
    expect(parse("850,999")).toEqual(ko("L13"));
    expect(parse("0,001")).toEqual(ko("L13"));
  });

  it("R15 — le point et la virgule ne sont jamais des séparateurs de milliers", () => {
    expect(parse("1,250,50")).toEqual(ko("L13"));
    expect(parse("1.250.50")).toEqual(ko("L13"));
    expect(parse("12,345")).toEqual(ko("L13"));
  });

  describe("séparateur de milliers", () => {
    it.each([
      ["1 250", 125000],
      ["12 345,67", 1234567],
      ["10 000", 1000000],
      ["99 999", 9999900],
      [`12${NBSP}345`, 1234500],
      [`12${NNBSP}345`, 1234500],
    ])("accepte %j (%i centimes)", (saisie, centimes) => {
      expect(parse(saisie)).toEqual(ok(centimes));
    });

    it("les trois espaces autorisées peuvent être mélangées : « 1 234\u00a0567 » est de forme correcte (L15, hors bornes) et non L13 (lecture de « chacun », R15)", () => {
      expect(parse(`1 234${NBSP}567`)).toEqual(ko("L15"));
      expect(parse(`1${NNBSP}234 567`)).toEqual(ko("L15"));
    });

    it.each([
      ["1 25"],
      ["1 2500"],
      ["12 3456"],
      ["1 250 00"],
      ["0 250"],
      ["01 250"],
      ["1250 000"],
      ["1  250"],
      [`1 ${NBSP}250`],
      ["1\t250"],
      ["1\n250"],
      ["1 250"], // espace fine ordinaire : non autorisée
      ["1　250"], // espace idéographique : non autorisée
      ["1 250 ,50"],
      ["1 250, 50"],
    ])("refuse %j (L13)", (saisie) => {
      expect(parse(saisie)).toEqual(ko("L13"));
    });
  });

  describe("symbole €", () => {
    it.each([
      ["850 €"],
      ["850€"],
      [`850${NBSP}€`],
      [`850${NNBSP}€`],
      ["850   €"],
      ["850 €  "],
      ["  850 €"],
    ])("accepte un seul € final : %j", (saisie) => {
      expect(parse(saisie)).toEqual(ok(85000));
    });

    it.each([["€ 850"], ["850 € €"], ["850 €€"], ["€"], ["€€"], ["8€50"], ["850 € 0"], ["$850"], ["850 $"]])(
      "refuse %j (L13)",
      (saisie) => {
        expect(parse(saisie)).toEqual(ko("L13"));
      },
    );
  });

  describe("signes et notations", () => {
    it.each([
      ["-850"], ["+850"], ["-0"], ["+0,5"], ["−850"], ["--5"],
      ["1e3"], ["1E3"], ["1e+3"], ["5e-1"], ["0x10"], ["0X1F"], ["0b11"], ["0o7"],
      ["Infinity"], ["-Infinity"], ["NaN"], ["null"], ["undefined"], ["1_000"],
      ["850abc"], ["abc"], ["8 5 0"],
    ])("refuse %j (L13)", (saisie) => {
      expect(parse(saisie)).toEqual(ko("L13"));
    });

    it.each([["0850"], ["00"], ["000"], ["007"], ["00,50"], ["01"]])(
      "refuse le zéro initial superflu : %j (L13)",
      (saisie) => {
        expect(parse(saisie)).toEqual(ko("L13"));
      },
    );
  });

  describe("chiffres non ASCII", () => {
    it.each([
      ["８５０"], // pleine chasse
      ["８５０,５０"],
      ["٨٥٠"], // arabes-indiens
      ["٨٥٠,٥٠"],
      ["۸۵۰"], // persans
      ["८५०"], // devanagari
      ["850,٥٠"], // partie décimale arabe-indienne
      ["85０"], // un seul chiffre pleine chasse
      ["1 ２５０"],
    ])("refuse %j (L13)", (saisie) => {
      expect(parse(saisie)).toEqual(ko("L13"));
    });
  });

  describe("décimales", () => {
    it.each([
      ["0,5", 50],
      ["0.5", 50],
      ["0,50", 50],
      ["850,5", 85050],
      ["850,05", 85005],
      ["850.05", 85005],
      ["1,1", 110],
      ["0,10", 10],
      ["0,09", 9],
    ])("lit %j comme %i centimes", (saisie, centimes) => {
      expect(parse(saisie)).toEqual(ok(centimes));
    });
  });

  describe("valeurs où un calcul en virgule flottante se tromperait", () => {
    // 0,07 × 100 = 7.000000000000001 ; 1,15 × 100 = 114.99999999999999 ;
    // 8,2 × 100 = 819.9999999999999 ; 1005,35 × 100 = 100534.99999999999 ;
    // 19,99 × 100 = 1998.9999999999998 ; 4,35 × 100 = 434.99999999999994.
    it.each([
      ["0,07", 7],
      ["0.07", 7],
      ["1,15", 115],
      ["1.15", 115],
      ["8,2", 820],
      ["8.2", 820],
      ["1 005,35", 100535],
      ["1005.35", 100535],
      ["19,99", 1999],
      ["99 999,99", 9999999],
      ["4,35", 435],
      ["0,57", 57],
      ["0,29", 29],
      ["16,67", 1667],
      ["33,33", 3333],
    ])("CA10 — %j donne exactement l'entier %i", (saisie, centimes) => {
      const result = parse(saisie);
      expect(result).toEqual(ok(centimes));
      expect(Number.isInteger((result as { value: number }).value)).toBe(true);
    });
  });

  describe("bornes", () => {
    it("accepte le maximum exact : 99 999,99 € = 9 999 999 centimes", () => {
      expect(parse("99999,99")).toEqual(ok(9999999));
    });

    it.each([["100000"], ["100000,00"], ["100000,01"], ["100 000,01"], ["100 000 €"]])(
      "un centime au-dessus (ou plus) : %j donne L15",
      (saisie) => {
        expect(parse(saisie)).toEqual(ko("L15"));
      },
    );

    it("un montant démesuré donne L15, sans perte de précision", () => {
      expect(parse("1".repeat(16))).toEqual(ko("L15"));
      expect(parse("9".repeat(20))).toEqual(ko("L15"));
      expect(parse("1".repeat(300))).toEqual(ko("L15"));
      expect(parse("99999999999999999999,99")).toEqual(ko("L15"));
    });

    it("la forme est jugée avant les bornes : trop grand ET mal formé donne L13", () => {
      expect(parse("100000,555")).toEqual(ko("L13"));
      expect(parse("-100000")).toEqual(ko("L13"));
    });

    it("R10 — une valeur brute de plus de 500 caractères donne le message de format L13 (le champ n'a pas de message de longueur)", () => {
      expect(parse("1".repeat(501))).toEqual(ko("L13"));
      expect(parse(`${" ".repeat(250)}850${" ".repeat(250)}`)).toEqual(ko("L13"));
    });

    it("une valeur brute de 500 caractères exactement est encore analysée", () => {
      expect(parse(`${" ".repeat(497)}850`)).toEqual(ok(85000));
    });
  });
});

describe("loyer — zéro et minimum (R14)", () => {
  it.each([["0"], ["0,00"], ["0.0"], ["0 €"], ["0,00 €"], [" 0 "]])(
    "CA10 — %j donne L14 (le zéro est une forme correcte, hors bornes)",
    (saisie) => {
      expect(parseRentInput(saisie)).toEqual(ko("L14"));
    },
  );

  it("CA10 — le plus petit loyer accepté est 0,01 € (1 centime)", () => {
    expect(parseRentInput("0,01")).toEqual(ok(1));
    expect(parseRentInput("0.01")).toEqual(ok(1));
  });

  it("un loyer mal formé commençant par zéro donne L13 et non L14", () => {
    expect(parseRentInput("00")).toEqual(ko("L13"));
    expect(parseRentInput("0,000")).toEqual(ko("L13"));
  });

  it("le champ vide donne L12, pas L14", () => {
    expect(parseRentInput("")).toEqual(ko("L12"));
  });

  it("exporte la borne maximale de 9 999 999 centimes", () => {
    expect(RENT_MAX_IN_CENTS).toBe(9999999);
  });
});

describe("charges — zéro (R14)", () => {
  it.each([["0"], ["0,00"], ["0.0"], ["0 €"], ["0,00 €"], [" 0 "]])(
    "CA10 — %j est accepté et vaut 0 centime",
    (saisie) => {
      expect(parseChargesInput(saisie)).toEqual(ok(0));
    },
  );

  it("CA10 — le champ vide est refusé (L16) : zéro doit être saisi explicitement", () => {
    expect(parseChargesInput("")).toEqual(ko("L16"));
  });

  it("exporte la borne maximale de 9 999 999 centimes", () => {
    expect(CHARGES_MAX_IN_CENTS).toBe(9999999);
  });
});

describe("totalInCents (R14)", () => {
  it("CA11 — 650 € de loyer et 50 € de charges donnent 700 €", () => {
    const loyer = parseRentInput("650");
    const charges = parseChargesInput("50");
    expect(loyer.ok && charges.ok).toBe(true);
    if (loyer.ok && charges.ok) {
      expect(totalInCents(loyer.value, charges.value)).toBe(70000);
      expect(formatAmount(totalInCents(loyer.value, charges.value))).toBe(
        `700,00${NBSP}€`,
      );
    }
  });

  it("CA11 — la somme maximale est 19 999 998 centimes", () => {
    expect(totalInCents(9999999, 9999999)).toBe(19999998);
  });

  it("CA11 — 0,10 € + 0,20 € font exactement 0,30 € (pas 0,30000000000000004)", () => {
    expect(totalInCents(10, 20)).toBe(30);
    expect(formatAmount(totalInCents(10, 20))).toBe(`0,30${NBSP}€`);
  });

  it("CA11 — charges nulles : le total est le loyer", () => {
    expect(totalInCents(125050, 0)).toBe(125050);
  });
});

describe("affichage d'un montant (R16)", () => {
  it.each([
    [85000, `850,00${NBSP}€`],
    [125050, `1${NNBSP}250,50${NBSP}€`],
    [0, `0,00${NBSP}€`],
    [1, `0,01${NBSP}€`],
    [9999999, `99${NNBSP}999,99${NBSP}€`],
    [19999998, `199${NNBSP}999,98${NBSP}€`],
  ])("CA11 — %i centimes s'affichent exactement %j", (centimes, attendu) => {
    expect(formatAmount(centimes)).toBe(attendu);
  });

  it.each([
    [5, `0,05${NBSP}€`],
    [9, `0,09${NBSP}€`],
    [10, `0,10${NBSP}€`],
    [99, `0,99${NBSP}€`],
    [100, `1,00${NBSP}€`],
    [99900, `999,00${NBSP}€`],
    [100000, `1${NNBSP}000,00${NBSP}€`],
    [100001, `1${NNBSP}000,01${NBSP}€`],
    [1234567, `12${NNBSP}345,67${NBSP}€`],
    [99999900, `999${NNBSP}999,00${NBSP}€`],
  ])("%i centimes s'affichent %j", (centimes, attendu) => {
    expect(formatAmount(centimes)).toBe(attendu);
  });

  it("CA11 — le montant ne contient aucune espace sécable (U+0020)", () => {
    for (const centimes of [0, 1, 85000, 125050, 9999999, 19999998]) {
      expect(formatAmount(centimes)).not.toContain(" ");
    }
  });

  it("R16 — l'espace des milliers est U+202F et l'espace avant € est U+00A0", () => {
    const texte = formatAmount(125050);
    const codes = [...texte].map((c) => c.codePointAt(0)!.toString(16));
    // 1 U+202F 2 5 0 , 5 0 U+00A0 €
    expect(codes).toEqual(["31", "202f", "32", "35", "30", "2c", "35", "30", "a0", "20ac"]);
  });

  it("R16 — le montant sans espace insécable ni fine insécable se compare à une espace ordinaire", () => {
    expect(formatAmount(125050).replace(/\s/g, " ")).toBe("1 250,50 €");
    expect(formatAmount(19999998).replace(/\s/g, " ")).toBe("199 999,98 €");
  });

  it("R16 — toujours deux décimales, virgule décimale", () => {
    expect(formatAmount(1000)).toBe(`10,00${NBSP}€`);
    expect(formatAmount(1000)).not.toContain(".");
  });
});

describe("valeur d'un champ prérempli (R16)", () => {
  it.each([
    [125050, "1250,50"],
    [0, "0,00"],
    [85000, "850,00"],
    [1, "0,01"],
    [5, "0,05"],
    [9999999, "99999,99"],
    [100000, "1000,00"],
  ])("CA11 — %i centimes donnent %j, sans milliers ni symbole", (centimes, attendu) => {
    expect(formatAmountForInput(centimes)).toBe(attendu);
  });
});

describe("aller-retour affichage → saisie (CA11)", () => {
  // Bornes, puissances de dix et leurs voisines, valeurs proches des bornes,
  // tous les petits montants, puis un pas régulier sur toute l'étendue.
  const echantillon: number[] = [];
  for (let c = 0; c <= 2500; c++) echantillon.push(c);
  for (let p = 1; p <= 9_999_999; p *= 10) {
    echantillon.push(p - 1, p, p + 1);
  }
  for (let d = 0; d <= 200; d++) {
    echantillon.push(9_999_999 - d);
  }
  for (let c = 0; c <= 9_999_999; c += 997) echantillon.push(c);
  for (let c = 5; c <= 9_999_999; c += 10_007) echantillon.push(c);
  const valeurs = [...new Set(echantillon)].filter((c) => c >= 0 && c <= 9_999_999);

  it("l'échantillon contient bien les bornes et plus de dix mille valeurs", () => {
    expect(valeurs).toContain(0);
    expect(valeurs).toContain(1);
    expect(valeurs).toContain(9_999_999);
    expect(valeurs.length).toBeGreaterThan(10_000);
  });

  it("charges : parse(formatAmountForInput(c)) === c pour toute valeur de l'échantillon", () => {
    const ecarts = valeurs.filter((c) => {
      const r = parseChargesInput(formatAmountForInput(c));
      return !(r.ok && r.value === c);
    });
    expect(ecarts).toEqual([]);
  });

  it("loyer : parse(formatAmountForInput(c)) === c pour toute valeur de l'échantillon sauf 0 (L14)", () => {
    const ecarts = valeurs
      .filter((c) => c >= 1)
      .filter((c) => {
        const r = parseRentInput(formatAmountForInput(c));
        return !(r.ok && r.value === c);
      });
    expect(ecarts).toEqual([]);
    expect(parseRentInput(formatAmountForInput(0))).toEqual(ko("L14"));
  });

  it("l'affichage avec milliers et symbole est lui aussi relu à l'identique", () => {
    const ecarts = valeurs.filter((c) => {
      const r = parseChargesInput(formatAmount(c));
      return !(r.ok && r.value === c);
    });
    expect(ecarts).toEqual([]);
  });

  it("le total de deux montants saisis est la somme exacte des centimes", () => {
    const paires: Array<[number, number]> = [];
    for (let i = 0; i < valeurs.length - 1; i += 7) {
      paires.push([valeurs[i], valeurs[valeurs.length - 1 - i]]);
    }
    const ecarts = paires.filter(([a, b]) => {
      const ra = parseChargesInput(formatAmountForInput(a));
      const rb = parseChargesInput(formatAmountForInput(b));
      return !(
        ra.ok && rb.ok && totalInCents(ra.value, rb.value) === a + b &&
        Number.isInteger(totalInCents(ra.value, rb.value))
      );
    });
    expect(paires.length).toBeGreaterThan(100);
    expect(ecarts).toEqual([]);
  });
});
