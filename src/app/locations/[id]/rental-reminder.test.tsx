import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Rental } from "@/rentals/rental-store";

import { RentalReminder } from "./rental-reminder";

const RENTAL: Rental = {
  id: "7f3b2c1a-1111-4222-8333-444455556666",
  address: "12 rue des Lilas",
  addressComplement: "Bâtiment B",
  postalCode: "69003",
  city: "Lyon",
  tenantName: "Marie Durand",
  tenantEmail: "marie.durand@quittances.test",
  dueDay: 5,
  rentInCents: 125050,
  chargesInCents: 0,
  startDate: "2026-01-05",
  endDate: "2026-06-30",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  archivedAt: null,
};

const texte = (rental: Rental, muted?: boolean) => {
  const { container } = render(<RentalReminder rental={rental} muted={muted} />);
  return container.textContent ?? "";
};

describe("RentalReminder (R24, R43, CA35, CA38)", () => {
  it("CA38 — nomme l'adresse, le complément, le code postal, la ville et le locataire", () => {
    const contenu = texte(RENTAL);

    expect(contenu).toContain("12 rue des Lilas, Bâtiment B");
    expect(contenu).toContain("69003 Lyon");
    expect(contenu).toContain("Marie Durand");
  });

  it("R24 — sans complément : ni virgule ni texte superflu après l'adresse", () => {
    const contenu = texte({ ...RENTAL, addressComplement: null });

    expect(contenu).toContain("12 rue des Lilas");
    expect(contenu).not.toContain(",");
    expect(contenu).not.toContain("null");
  });

  it("R43, CA38 — l'adresse e-mail du locataire n'y figure jamais", () => {
    const contenu = texte(RENTAL);

    expect(contenu).not.toContain("marie.durand@quittances.test");
    expect(contenu).not.toContain("@");
  });

  it("R43 — ni identifiant, ni montant, ni date n'y figurent", () => {
    const contenu = texte(RENTAL);

    expect(contenu).not.toContain("7f3b2c1a");
    expect(contenu).not.toMatch(/€|1250|30\/06\/2026|2026-/);
  });

  it("R11 — les valeurs sont rendues comme du texte, jamais comme du HTML", () => {
    const { container } = render(
      <RentalReminder rental={{ ...RENTAL, tenantName: "<b>Marie</b>" }} />,
    );

    expect(container.textContent).toContain("<b>Marie</b>");
    expect(container.querySelector("b")).toBeNull();
  });

  it("R24 — avec ou sans mode atténué, le contenu est le même", () => {
    expect(texte(RENTAL, true)).toBe(texte(RENTAL, false));
  });
});
