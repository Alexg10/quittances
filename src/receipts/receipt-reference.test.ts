import { describe, expect, it } from "vitest";

import { getReceiptFileName, getReceiptReference } from "./receipt-reference";

const ID = "3f9a1c2e-7b4d-4e8a-9c1f-0a2b3c4d5e6f";

describe("getReceiptReference (R16)", () => {
  it("CA11 — donne 2026-10-3F9A1C2E pour l'identifiant type et 2026-10", () => {
    expect(getReceiptReference(ID, "2026-10")).toBe("2026-10-3F9A1C2E");
  });

  it("CA11 — met les huit caractères hexadécimaux en majuscules, le mois restant tel quel", () => {
    expect(getReceiptReference("abcdef12-7b4d-4e8a-9c1f-0a2b3c4d5e6f", "2026-01")).toBe("2026-01-ABCDEF12");
  });

  it("CA11 — ne reprend rien après les huit premiers caractères", () => {
    expect(getReceiptReference(ID, "2026-10")).not.toContain("7B4D");
  });

  it.each([
    ["identifiant vide", "", "2026-10"],
    ["identifiant trop court", "3f9a1c2e", "2026-10"],
    ["identifiant en majuscules", ID.toUpperCase(), "2026-10"],
    ["identifiant avec un suffixe", `${ID}x`, "2026-10"],
    ["identifiant de chemin", "../../etc/passwd", "2026-10"],
    ["mois vide", ID, ""],
    ["mois sans zéro", ID, "2026-1"],
    ["mois 13", ID, "2026-13"],
    ["mois avec un saut de ligne", ID, "2026-10\n"],
  ])("CA11 — refuse un %s", (_cas, id, month) => {
    expect(() => getReceiptReference(id, month)).toThrow();
  });
});

describe("getReceiptFileName (R32)", () => {
  it("CA11 — donne quittance-2026-10-3f9a1c2e.pdf pour l'identifiant type et 2026-10", () => {
    expect(getReceiptFileName(ID, "2026-10")).toBe("quittance-2026-10-3f9a1c2e.pdf");
  });

  it("CA11 — met l'identifiant en minuscules même si la référence est en majuscules", () => {
    expect(getReceiptFileName(ID, "2026-10")).toBe(getReceiptFileName(ID, "2026-10").toLowerCase());
    expect(getReceiptReference(ID, "2026-10")).toBe(getReceiptReference(ID, "2026-10").toUpperCase());
  });

  it("CA11 — ne contient que a à z, des chiffres, des tirets et un point, pour de nombreux identifiants", () => {
    const hexa = "0123456789abcdef";
    for (let i = 0; i < 200; i += 1) {
      const bloc = (n: number) => Array.from({ length: n }, (_, k) => hexa[(i * 7 + k * 3 + n) % 16]).join("");
      const id = `${bloc(8)}-${bloc(4)}-4${bloc(3)}-8${bloc(3)}-${bloc(12)}`;
      const month = `20${String(10 + (i % 80))}-${String((i % 12) + 1).padStart(2, "0")}`;
      expect(getReceiptFileName(id, month)).toMatch(/^[a-z0-9-]+\.pdf$/);
    }
  });

  it("CA11 — ne contient qu'un seul point", () => {
    expect(getReceiptFileName(ID, "2026-10").split(".")).toHaveLength(2);
  });

  it("CA11 — refuse un identifiant ou un mois mal formé plutôt que de fabriquer un autre nom", () => {
    expect(() => getReceiptFileName("Marie Durand", "2026-10")).toThrow();
    expect(() => getReceiptFileName(ID, "octobre 2026")).toThrow();
  });
});
