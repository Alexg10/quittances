import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatArchiveDate,
  formatReceiptCount,
  getDeletionReceiptSentence,
} from "./rental-archive-text";

describe("formatArchiveDate — jour à Paris de l'instant d'archivage (R40, R41)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["CA50 — 15/09/2026 à midi UTC", "2026-09-15T12:00:00Z", "15/09/2026"],
    ["R39 — 31 octobre 22:59:59 UTC : encore le 31 à Paris (heure d'hiver depuis le 25)", "2026-10-31T22:59:59Z", "31/10/2026"],
    ["R39 — 31 octobre 23:00:00 UTC : le 1er novembre à Paris", "2026-10-31T23:00:00Z", "01/11/2026"],
    ["Q14 — 31 octobre 23:30 UTC : le 1er novembre à Paris", "2026-10-31T23:30:00Z", "01/11/2026"],
    ["été (UTC+2) — 14 juillet 21:59:59 UTC : encore le 14", "2026-07-14T21:59:59Z", "14/07/2026"],
    ["été (UTC+2) — 14 juillet 22:00:00 UTC : le 15", "2026-07-14T22:00:00Z", "15/07/2026"],
    ["hiver (UTC+1) — 15 janvier 22:59:59 UTC : encore le 15", "2026-01-15T22:59:59Z", "15/01/2026"],
    ["hiver (UTC+1) — 15 janvier 23:00:00 UTC : le 16", "2026-01-15T23:00:00Z", "16/01/2026"],
    ["31 décembre 23:30 UTC : le 1er janvier de l'année suivante", "2026-12-31T23:30:00Z", "01/01/2027"],
    ["31 décembre 22:59 UTC : encore le 31 décembre", "2026-12-31T22:59:00Z", "31/12/2026"],
    ["changement d'heure de printemps 2026 (29 mars) : 28 mars 23:00 UTC = 29 mars 00:00 à Paris", "2026-03-28T23:00:00Z", "29/03/2026"],
    ["changement d'heure d'automne 2026 (25 octobre) : 24 oct. 22:00 UTC = 25 oct. 00:00 à Paris", "2026-10-24T22:00:00Z", "25/10/2026"],
    ["année bissextile : 28 février 23:00 UTC 2028 = 29 février à Paris", "2028-02-28T23:00:00Z", "29/02/2028"],
  ])("%s", (_nom, instant, attendu) => {
    expect(formatArchiveDate(new Date(instant))).toBe(attendu);
  });

  it.each(["UTC", "America/Los_Angeles", "Pacific/Kiritimati"])(
    "le résultat ne dépend pas du fuseau de la machine (TZ=%s)",
    (tz) => {
      vi.stubEnv("TZ", tz);

      expect(formatArchiveDate(new Date("2026-10-31T23:30:00Z"))).toBe("01/11/2026");
      expect(formatArchiveDate(new Date("2026-10-31T22:59:59Z"))).toBe("31/10/2026");
      expect(formatArchiveDate(new Date("2026-12-31T23:30:00Z"))).toBe("01/01/2027");
    },
  );
});

describe("formatReceiptCount — R41", () => {
  it.each([
    [0, "Aucune quittance"],
    [1, "1 quittance"],
    [2, "2 quittances"],
    [10, "10 quittances"],
    [12345, "12345 quittances"],
  ])("%i → « %s »", (nombre, attendu) => {
    expect(formatReceiptCount(nombre)).toBe(attendu);
  });
});

describe("getDeletionReceiptSentence — page de suppression (CA52)", () => {
  it("CA52 — aucune quittance : aucune phrase", () => {
    expect(getDeletionReceiptSentence(0)).toBeNull();
  });

  it("CA52 — une quittance : singulier, « Elle sera supprimée »", () => {
    expect(getDeletionReceiptSentence(1)).toBe(
      "Cette location a 1 quittance. Elle sera supprimée avec la location.",
    );
  });

  it("CA52 — deux quittances : pluriel, « Elles seront supprimées »", () => {
    expect(getDeletionReceiptSentence(2)).toBe(
      "Cette location a 2 quittances. Elles seront supprimées avec la location.",
    );
  });

  it("un grand nombre de quittances : pluriel", () => {
    expect(getDeletionReceiptSentence(1200)).toBe(
      "Cette location a 1200 quittances. Elles seront supprimées avec la location.",
    );
  });
});
