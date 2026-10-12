import { describe, expect, it } from "vitest";

import { isRentalArchivable } from "./rental-archivable";

describe("isRentalArchivable (R39)", () => {
  // Une ligne par ligne de la table de R39.
  it.each([
    ["11/10/2026 (hier)", "2026-10-11", "2026-10-12T10:00:00Z", true],
    ["12/10/2026 (aujourd'hui) : le dernier jour du bail est inclus", "2026-10-12", "2026-10-12T10:00:00Z", false],
    ["13/10/2026 (demain)", "2026-10-13", "2026-10-12T10:00:00Z", false],
    ["aucune date de fin", null, "2026-10-12T10:00:00Z", false],
    ["31/10/2026, à 23:59:59 à Paris", "2026-10-31", "2026-10-31T22:59:59Z", false],
    ["31/10/2026, à minuit à Paris (01/11)", "2026-10-31", "2026-10-31T23:00:00Z", true],
  ])("CA55 — date de fin %s : archivable = %s", (_cas, fin, instant, attendu) => {
    expect(isRentalArchivable(fin, new Date(instant))).toBe(attendu);
  });

  it("CA55 — une fin lointaine dans le passé est archivable", () => {
    expect(isRentalArchivable("1999-12-31", new Date("2026-10-12T10:00:00Z"))).toBe(true);
  });

  it("CA55 — une fin lointaine dans le futur ne l'est pas", () => {
    expect(isRentalArchivable("2099-12-31", new Date("2026-10-12T10:00:00Z"))).toBe(false);
  });

  it("CA55 — le changement d'année : fin le 31/12, archivable à minuit à Paris", () => {
    expect(isRentalArchivable("2026-12-31", new Date("2026-12-31T22:59:59Z"))).toBe(false);
    expect(isRentalArchivable("2026-12-31", new Date("2026-12-31T23:00:00Z"))).toBe(true);
  });

  it("CA55 — le 29 février d'une année bissextile : fin le 29/02/2028, archivable à minuit à Paris", () => {
    expect(isRentalArchivable("2028-02-29", new Date("2028-02-29T22:59:59Z"))).toBe(false);
    expect(isRentalArchivable("2028-02-29", new Date("2028-02-29T23:00:00Z"))).toBe(true);
  });

  it("CA55 — le changement d'heure du 29/03/2026 (fin ce jour-là) ne décale pas la limite", () => {
    // Le 29/03 Paris passe à l'heure d'été (UTC+2) à 01:00Z : minuit le 30/03 tombe à 22:00Z.
    expect(isRentalArchivable("2026-03-29", new Date("2026-03-29T21:59:59Z"))).toBe(false);
    expect(isRentalArchivable("2026-03-29", new Date("2026-03-29T22:00:00Z"))).toBe(true);
  });
});
