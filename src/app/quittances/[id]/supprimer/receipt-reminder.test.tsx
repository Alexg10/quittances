import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Receipt } from "@/receipts/receipt-store";

import { ReceiptReminder } from "./receipt-reminder";

const RECEIPT: Receipt = {
  id: "3f9a1c2e-7b4d-4e8a-9c1f-0a2b3c4d5e6f",
  rentalId: "7f3b2c1a-1111-4222-8333-444455556666",
  month: "2026-10",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  landlordName: "Marie Durand",
  landlordAddress: "3 rue de la Paix",
  landlordAddressComplement: null,
  landlordPostalCode: "75002",
  landlordCity: "Paris",
  tenantName: "Paul Martin",
  rentalAddress: "12 rue des Lilas",
  rentalAddressComplement: "Bât. B",
  rentalPostalCode: "69003",
  rentalCity: "Lyon",
  rentInCents: 85000,
  chargesInCents: 5000,
  paymentDate: "2026-10-03",
  issueDate: "2026-10-12",
  producedAt: new Date("2026-10-12T10:00:00Z"),
  emailSendState: null,
  emailSendStartedAt: null,
  emailSentAt: null,
  emailSentTo: null,
};

// Ramène toute espace (insécable comprise) à une espace ordinaire.
const texte = (receipt: Receipt) => {
  const { container } = render(<ReceiptReminder receipt={receipt} />);
  return (container.textContent ?? "").replace(/\s/g, " ");
};

describe("ReceiptReminder — rappel de la page de suppression (« Contenus », R37)", () => {
  it("le mois et la période : « Octobre 2026, du 01/10/2026 au 31/10/2026 »", () => {
    expect(texte(RECEIPT)).toContain("Octobre 2026, du 01/10/2026 au 31/10/2026");
  });

  it("l'adresse du logement avec son complément, puis le code postal et la ville", () => {
    const contenu = texte(RECEIPT);

    expect(contenu).toContain("12 rue des Lilas, Bât. B");
    expect(contenu).toContain("69003 Lyon");
  });

  it("sans complément : ni virgule superflue ni « null »", () => {
    const contenu = texte({ ...RECEIPT, rentalAddressComplement: null });

    expect(contenu).toContain("12 rue des Lilas");
    expect(contenu).not.toContain("12 rue des Lilas,");
    expect(contenu).not.toContain("null");
  });

  it("le nom du locataire", () => {
    expect(texte(RECEIPT)).toContain("Paul Martin");
  });

  it("le total (loyer + charges) : 850,00 + 50,00 = 900,00 €", () => {
    expect(texte(RECEIPT)).toContain("900,00 €");
  });

  it("la référence : 2026-10-3F9A1C2E", () => {
    expect(texte(RECEIPT)).toContain("Référence 2026-10-3F9A1C2E");
  });

  it("les éléments sont dans l'ordre de la spécification", () => {
    expect(texte(RECEIPT)).toMatch(
      /Octobre 2026.*12 rue des Lilas.*69003 Lyon.*Paul Martin.*900,00 €.*Référence 2026-10-3F9A1C2E/,
    );
  });

  it("R37 — n'affiche ni nom ni adresse du bailleur, ni date du paiement, ni date d'émission, ni identifiant", () => {
    const contenu = texte(RECEIPT);

    for (const interdit of ["Marie Durand", "rue de la Paix", "75002", "03/10/2026", "12/10/2026", RECEIPT.id]) {
      expect(contenu).not.toContain(interdit);
    }
  });

  it("R37 — aucune adresse e-mail ne figure dans le rappel", () => {
    expect(texte(RECEIPT)).not.toContain("@");
  });

  it("les valeurs sont celles figées dans la quittance : un autre jeu de valeurs donne un autre rappel", () => {
    const contenu = texte({
      ...RECEIPT,
      month: "2026-01",
      periodStart: "2026-01-15",
      periodEnd: "2026-01-31",
      tenantName: "Léa Bernard",
      rentInCents: 42550,
      chargesInCents: 0,
    });

    expect(contenu).toContain("Janvier 2026, du 15/01/2026 au 31/01/2026");
    expect(contenu).toContain("Léa Bernard");
    expect(contenu).toContain("425,50 €");
    expect(contenu).toContain("Référence 2026-01-3F9A1C2E");
  });

  it("un texte saisi qui ressemble à du HTML est affiché comme du texte", () => {
    const { container } = render(
      <ReceiptReminder receipt={{ ...RECEIPT, tenantName: "<b>Paul</b> & Fils" }} />,
    );

    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>Paul</b> & Fils");
  });
});
