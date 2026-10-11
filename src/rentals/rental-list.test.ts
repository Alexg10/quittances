import { describe, expect, it } from "vitest";

import { splitRentals } from "./rental-list";
import type { Rental } from "./rental-store";

const TODAY = "2026-10-11";

let counter = 0;
function rental(
  name: string,
  endDate: string | null,
  createdAt: string,
): Rental {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    address: name,
    addressComplement: null,
    postalCode: "69003",
    city: "Lyon",
    tenantName: "Marie Durand",
    tenantEmail: "marie@quittances.test",
    rentInCents: 85000,
    chargesInCents: 5000,
    dueDay: 5,
    startDate: "2025-01-01",
    endDate,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

const names = (list: Rental[]) => list.map((r) => r.address);

describe("splitRentals — séparation (R35, R20)", () => {
  it("CA17 — sans date de fin : en cours", () => {
    const { ongoing, ended } = splitRentals(
      [rental("A", null, "2026-01-01T10:00:00Z")],
      TODAY,
    );
    expect(names(ongoing)).toEqual(["A"]);
    expect(ended).toEqual([]);
  });

  it("CA17 — date de fin à venir : en cours", () => {
    const { ongoing, ended } = splitRentals(
      [rental("A", "2026-10-12", "2026-01-01T10:00:00Z")],
      TODAY,
    );
    expect(names(ongoing)).toEqual(["A"]);
    expect(ended).toEqual([]);
  });

  it("R20 — date de fin égale à aujourd'hui : encore en cours (dernier jour inclus)", () => {
    const { ongoing, ended } = splitRentals(
      [rental("A", "2026-10-11", "2026-01-01T10:00:00Z")],
      TODAY,
    );
    expect(names(ongoing)).toEqual(["A"]);
    expect(ended).toEqual([]);
  });

  it("CA17 — date de fin d'hier : terminée", () => {
    const { ongoing, ended } = splitRentals(
      [rental("A", "2026-10-10", "2026-01-01T10:00:00Z")],
      TODAY,
    );
    expect(ongoing).toEqual([]);
    expect(names(ended)).toEqual(["A"]);
  });

  it("R20 — la date du jour fait basculer : la même location est terminée le lendemain", () => {
    const list = [rental("A", "2026-10-11", "2026-01-01T10:00:00Z")];
    expect(splitRentals(list, "2026-10-11").ongoing).toHaveLength(1);
    expect(splitRentals(list, "2026-10-12").ended).toHaveLength(1);
  });

  it("R20 — une date de début à venir ne change rien : en cours", () => {
    const future = { ...rental("A", null, "2026-01-01T10:00:00Z"), startDate: "2030-01-01" };
    expect(names(splitRentals([future], TODAY).ongoing)).toEqual(["A"]);
  });

  it("CA18 — listes vides", () => {
    expect(splitRentals([], TODAY)).toEqual({ ongoing: [], ended: [] });
  });

  it("CA18 — uniquement des terminées : aucune en cours", () => {
    const { ongoing, ended } = splitRentals(
      [
        rental("A", "2026-01-31", "2026-01-01T10:00:00Z"),
        rental("B", "2026-06-30", "2026-01-02T10:00:00Z"),
      ],
      TODAY,
    );
    expect(ongoing).toEqual([]);
    expect(ended).toHaveLength(2);
  });
});

describe("splitRentals — ordre (R35)", () => {
  it("CA17 — les locations en cours gardent l'ordre de création, la plus ancienne d'abord", () => {
    const x = rental("X", null, "2026-01-01T10:00:00Z");
    const y = rental("Y", null, "2026-02-01T10:00:00Z");
    const z = rental("Z", "2027-01-01", "2026-03-01T10:00:00Z");

    const { ongoing } = splitRentals([x, y, z], TODAY);

    expect(names(ongoing)).toEqual(["X", "Y", "Z"]);
  });

  it("CA17 — les terminées : date de fin la plus récente d'abord", () => {
    const janvier = rental("Janvier", "2026-01-31", "2025-01-01T10:00:00Z");
    const juin = rental("Juin", "2026-06-30", "2025-02-01T10:00:00Z");

    const { ended } = splitRentals([janvier, juin], TODAY);

    expect(names(ended)).toEqual(["Juin", "Janvier"]);
  });

  it("R35 — une modification de la location (updatedAt) ne déplace rien", () => {
    const x = rental("X", null, "2026-01-01T10:00:00Z");
    const y = rental("Y", null, "2026-02-01T10:00:00Z");
    x.updatedAt = new Date("2026-09-01T10:00:00Z");

    expect(names(splitRentals([x, y], TODAY).ongoing)).toEqual(["X", "Y"]);
  });

  // R35 dit « puis par date de création » pour les terminées sans en préciser
  // le sens : on ne fige que le regroupement, pas la direction (ambiguïté signalée).
  it("R35 — à date de fin égale, les deux terminées restent adjacentes et après la plus récente", () => {
    const a = rental("A", "2026-03-01", "2025-01-01T10:00:00Z");
    const b = rental("B", "2026-03-01", "2025-02-01T10:00:00Z");
    const recent = rental("Récente", "2026-09-01", "2025-03-01T10:00:00Z");

    const { ended } = splitRentals([a, recent, b], TODAY);

    expect(names(ended)[0]).toBe("Récente");
    expect(names(ended).slice(1).sort()).toEqual(["A", "B"]);
  });
});

describe("splitRentals — pureté", () => {
  it("ne modifie ni le tableau d'entrée ni ses éléments", () => {
    const list = [
      rental("A", "2026-01-31", "2025-01-01T10:00:00Z"),
      rental("B", null, "2025-02-01T10:00:00Z"),
      rental("C", "2026-06-30", "2025-03-01T10:00:00Z"),
    ];
    const copy = structuredClone(list);

    splitRentals(list, TODAY);

    expect(list).toEqual(copy);
  });

  it("ne perd ni ne duplique aucune location", () => {
    const list = [
      rental("A", "2026-01-31", "2025-01-01T10:00:00Z"),
      rental("B", null, "2025-02-01T10:00:00Z"),
      rental("C", "2026-10-11", "2025-03-01T10:00:00Z"),
    ];
    const { ongoing, ended } = splitRentals(list, TODAY);

    expect([...names(ongoing), ...names(ended)].sort()).toEqual(["A", "B", "C"]);
  });
});
