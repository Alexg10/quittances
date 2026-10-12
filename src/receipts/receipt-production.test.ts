import { describe, expect, it } from "vitest";

import { getProductionState } from "./receipt-production";

// Instants de la spécification 04 (R8).
const MIDI_PARIS = new Date("2026-10-12T10:00:00Z");

function mois(state: ReturnType<typeof getProductionState>) {
  if (state.kind !== "form") {
    throw new Error(`état inattendu : ${state.kind}`);
  }
  return state.months;
}

describe("getProductionState — formulaire (R8, R11, R25, CA23)", () => {
  it("CA23 — bail du 15/01 au 20/03/2026 : trois mois, le plus récent d'abord, avec leurs libellés", () => {
    const state = getProductionState("2026-01-15", "2026-03-20", [], MIDI_PARIS);

    expect(mois(state)).toEqual([
      { value: "2026-03", label: "Mars 2026 (du 01/03/2026 au 20/03/2026)" },
      { value: "2026-02", label: "Février 2026" },
      { value: "2026-01", label: "Janvier 2026 (du 15/01/2026 au 31/01/2026)" },
    ]);
  });

  it("R25 — le premier mois de la liste est le plus récent (celui que le formulaire présélectionne)", () => {
    const state = getProductionState("2026-01-15", null, [], MIDI_PARIS);

    expect(mois(state)[0].value).toBe("2026-10");
  });

  it("R8 — bail sans fin commencé le 15/01/2026, le 12/10/2026 : dix mois, de 2026-10 à 2026-01", () => {
    const state = getProductionState("2026-01-15", null, [], MIDI_PARIS);

    expect(mois(state).map((m) => m.value)).toEqual([
      "2026-10", "2026-09", "2026-08", "2026-07", "2026-06",
      "2026-05", "2026-04", "2026-03", "2026-02", "2026-01",
    ]);
  });

  it("R8 — bail du 01/01/2025 au 31/03/2027 (à venir) : vingt-deux mois, de 2026-10 à 2025-01", () => {
    const valeurs = mois(
      getProductionState("2025-01-01", "2027-03-31", [], MIDI_PARIS),
    ).map((m) => m.value);

    expect(valeurs).toHaveLength(22);
    expect(valeurs[0]).toBe("2026-10");
    expect(valeurs[21]).toBe("2025-01");
  });

  it("R15, R25 — les mois qui ont déjà une quittance sont retirés de la liste", () => {
    const state = getProductionState(
      "2026-01-15",
      "2026-03-20",
      ["2026-02"],
      MIDI_PARIS,
    );

    expect(mois(state).map((m) => m.value)).toEqual(["2026-03", "2026-01"]);
  });

  it("R25 — si le mois le plus récent est déjà produit, le premier proposé est le suivant", () => {
    const state = getProductionState(
      "2026-01-15",
      "2026-03-20",
      ["2026-03"],
      MIDI_PARIS,
    );

    expect(mois(state)[0]).toEqual({ value: "2026-02", label: "Février 2026" });
  });

  it("R25 — un mois produit mais que R8 n'accepte pas (2099-12) ne change rien à la liste", () => {
    const state = getProductionState(
      "2026-01-15",
      "2026-03-20",
      ["2099-12", "2025-12"],
      MIDI_PARIS,
    );

    expect(mois(state).map((m) => m.value)).toEqual([
      "2026-03", "2026-02", "2026-01",
    ]);
  });

  it("R25 — ne modifie pas le tableau des mois produits qu'on lui passe", () => {
    const produits = ["2026-02", "2026-01"];

    getProductionState("2026-01-15", "2026-03-20", produits, MIDI_PARIS);

    expect(produits).toEqual(["2026-02", "2026-01"]);
  });

  it("R8 — bail qui commence demain (13/10/2026) : le mois courant est proposé, période incomplète signalée", () => {
    const state = getProductionState("2026-10-13", null, [], MIDI_PARIS);

    expect(mois(state)).toEqual([
      { value: "2026-10", label: "Octobre 2026 (du 13/10/2026 au 31/10/2026)" },
    ]);
  });

  it("R8 — bail d'un seul jour (12/10/2026 au 12/10/2026) : le mois courant", () => {
    const state = getProductionState("2026-10-12", "2026-10-12", [], MIDI_PARIS);

    expect(mois(state)).toEqual([
      { value: "2026-10", label: "Octobre 2026 (du 12/10/2026 au 12/10/2026)" },
    ]);
  });
});

describe("getProductionState — « bail à venir » (R25 état 4, CA27)", () => {
  it("CA27 — bail qui commence le 01/01/2099 : bail à venir", () => {
    expect(
      getProductionState("2099-01-01", null, [], MIDI_PARIS),
    ).toEqual({ kind: "lease-not-started" });
  });

  it("R8 — bail du 01/11/2026 le 31/10/2026 à 23:59:59 Paris (22:59:59Z) : bail à venir", () => {
    expect(
      getProductionState("2026-11-01", null, [], new Date("2026-10-31T22:59:59Z")),
    ).toEqual({ kind: "lease-not-started" });
  });

  it("R8 — le même bail à minuit à Paris (23:00:00Z) : novembre 2026 devient proposé", () => {
    const state = getProductionState(
      "2026-11-01",
      null,
      [],
      new Date("2026-10-31T23:00:00Z"),
    );

    expect(mois(state)).toEqual([{ value: "2026-11", label: "Novembre 2026" }]);
  });

  it("R25 — « bail à venir » passe avant « rien à produire » même si des mois sont notés produits", () => {
    expect(
      getProductionState("2099-01-01", null, ["2099-01"], MIDI_PARIS),
    ).toEqual({ kind: "lease-not-started" });
  });
});

describe("getProductionState — « rien à produire » (R25 état 5, CA27)", () => {
  it("CA27 — bail du 10/03 au 20/03/2026 dont mars a sa quittance : rien à produire", () => {
    expect(
      getProductionState("2026-03-10", "2026-03-20", ["2026-03"], MIDI_PARIS),
    ).toEqual({ kind: "nothing-to-produce" });
  });

  it("R25 — tous les mois d'un bail de trois mois produits : rien à produire", () => {
    expect(
      getProductionState(
        "2026-01-15",
        "2026-03-20",
        ["2026-01", "2026-02", "2026-03"],
        MIDI_PARIS,
      ),
    ).toEqual({ kind: "nothing-to-produce" });
  });

  it("R25 — il suffit qu'un mois accepté manque pour revenir au formulaire", () => {
    const state = getProductionState(
      "2026-01-15",
      "2026-03-20",
      ["2026-01", "2026-03"],
      MIDI_PARIS,
    );

    expect(mois(state).map((m) => m.value)).toEqual(["2026-02"]);
  });
});

describe("getProductionState — changement de mois à Paris (R8)", () => {
  const bail = ["2026-01-15", null] as const;

  it.each([
    ["31/10 à 23:59:59 Paris", "2026-10-31T22:59:59Z", "2026-10"],
    ["01/11 à 00:00:00 Paris", "2026-10-31T23:00:00Z", "2026-11"],
    ["30/06/2027 à 23:59:59 Paris", "2027-06-30T21:59:59Z", "2027-06"],
    ["01/07/2027 à 00:00:00 Paris", "2027-06-30T22:00:00Z", "2027-07"],
    ["01/01/2027 à 00:30 Paris (le 31/12 en UTC)", "2026-12-31T23:30:00Z", "2027-01"],
  ])("R8 — %s : le mois le plus récent proposé est %s", (_nom, instant, attendu) => {
    const state = getProductionState(bail[0], bail[1], [], new Date(instant));

    expect(mois(state)[0].value).toBe(attendu);
  });

  it("R8 — le nombre de mois proposés grandit d'un seul au passage de minuit à Paris", () => {
    const avant = mois(
      getProductionState("2026-01-15", null, [], new Date("2026-10-31T22:59:59Z")),
    );
    const apres = mois(
      getProductionState("2026-01-15", null, [], new Date("2026-10-31T23:00:00Z")),
    );

    expect(apres).toHaveLength(avant.length + 1);
  });

  it("R8 — le bail terminé en mars reste limité à mars quel que soit l'instant (2027)", () => {
    const state = getProductionState(
      "2026-01-15",
      "2026-03-20",
      [],
      new Date("2027-06-01T10:00:00Z"),
    );

    expect(mois(state).map((m) => m.value)).toEqual([
      "2026-03", "2026-02", "2026-01",
    ]);
  });
});
