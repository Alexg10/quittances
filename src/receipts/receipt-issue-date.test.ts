import { describe, expect, it } from "vitest";

import { getReceiptIssueDate, isIssueDateConsistent } from "./receipt-issue-date";

describe("getReceiptIssueDate (R6)", () => {
  it.each([
    ["2026-10-12T10:00:00Z", "2026-10-12"],
    ["2026-10-31T22:59:59Z", "2026-10-31"],
    ["2026-10-31T23:00:00Z", "2026-11-01"],
    ["2026-10-31T23:30:00Z", "2026-11-01"],
    ["2026-12-31T23:30:00Z", "2027-01-01"],
    ["2028-02-29T23:30:00Z", "2028-03-01"],
    ["2026-01-01T00:00:00Z", "2026-01-01"],
  ])("R6 — l'instant %s donne le jour à Paris %s", (instant, attendu) => {
    expect(getReceiptIssueDate(new Date(instant))).toBe(attendu);
  });
});

describe("isIssueDateConsistent (R13)", () => {
  it("R13 — un paiement le jour même de l'émission est cohérent", () => {
    expect(isIssueDateConsistent("2026-10-12", "2026-10-12")).toBe(true);
  });

  it("R13 — un paiement antérieur à l'émission est cohérent", () => {
    expect(isIssueDateConsistent("2026-10-12", "2026-01-20")).toBe(true);
  });

  it("R13 — l'exemple des treize jours : émission le 12/10, paiement le 25/10, incohérent", () => {
    expect(isIssueDateConsistent("2026-10-12", "2026-10-25")).toBe(false);
  });

  it("R13 — un paiement le lendemain de l'émission est incohérent", () => {
    expect(isIssueDateConsistent("2026-10-12", "2026-10-13")).toBe(false);
  });

  it("R13 — compare les dates comme des dates, pas comme des nombres (changement d'année)", () => {
    expect(isIssueDateConsistent("2027-01-01", "2026-12-31")).toBe(true);
    expect(isIssueDateConsistent("2026-12-31", "2027-01-01")).toBe(false);
  });
});
