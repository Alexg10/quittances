// Quittances figées utilisées par les tests du contenu et du PDF.
import type { ReceiptSnapshot } from "../receipts/receipt-snapshot";

// La quittance de CA14 : bailleur type (Marie Durand, sans complément), locataire
// Paul Martin, logement 12 rue des Lilas / Bât. B / 69003 Lyon, mois 2026-01,
// période du 15/01/2026 au 31/01/2026, 425,50 € de loyer et 0 de charges, paiement
// le 20/01/2026, émission le 12/10/2026. Référence attendue : 2026-01-3F9A1C2E.
export const QUITTANCE_TYPE: ReceiptSnapshot = {
  id: "3f9a1c2e-7b4d-4e8a-9c1f-0a2b3c4d5e6f",
  month: "2026-01",
  periodStart: "2026-01-15",
  periodEnd: "2026-01-31",
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
  rentInCents: 42550,
  chargesInCents: 0,
  paymentDate: "2026-01-20",
  issueDate: "2026-10-12",
};

// Les textes de CA14, dans l'ordre du document, tels que la spécification les donne.
export const TEXTES_CA14 = [
  "Quittance de loyer",
  "Janvier 2026",
  "Référence 2026-01-3F9A1C2E",
  "Bailleur",
  "Marie Durand",
  "3 rue de la Paix",
  "75002 Paris",
  "Locataire",
  "Paul Martin",
  "Logement loué",
  "12 rue des Lilas",
  "Bât. B",
  "69003 Lyon",
  "Période",
  "Du 15/01/2026 au 31/01/2026",
  "Loyer hors charges",
  "425,50 €",
  "Provisions pour charges",
  "0,00 €",
  "Total",
  "425,50 €",
  "Reçu de Paul Martin la somme de 425,50 € au titre du loyer et des charges du logement désigné ci-dessus, pour la période du 15/01/2026 au 31/01/2026. Le bailleur en donne quittance au locataire.",
  "Paiement reçu le 20/01/2026",
  "Fait à Paris, le 12/10/2026",
  "Le bailleur",
  "Marie Durand",
  "La présente quittance ne libère le locataire que pour la période indiquée. Elle ne vaut pas quittance des loyers et des charges des périodes antérieures.",
] as const;

// Un texte de `longueur` caractères, sans espace, fait de `lettre` répétée.
export function sansEspace(lettre: string, longueur: number): string {
  return Array.from({ length: longueur }, () => lettre).join("");
}

// Quittance aux longueurs maximales de R28 : nom 100, adresse 200, complément 100,
// ville 100 pour le bailleur et pour le logement, nom du locataire 100, sans
// espace, les deux montants à 99 999,99 €.
export function quittanceMaximale(lettre: string): ReceiptSnapshot {
  return {
    ...QUITTANCE_TYPE,
    landlordName: sansEspace(lettre, 100),
    landlordAddress: sansEspace(lettre, 200),
    landlordAddressComplement: sansEspace(lettre, 100),
    landlordCity: sansEspace(lettre, 100),
    tenantName: sansEspace(lettre, 100),
    rentalAddress: sansEspace(lettre, 200),
    rentalAddressComplement: sansEspace(lettre, 100),
    rentalCity: sansEspace(lettre, 100),
    rentInCents: 9_999_999,
    chargesInCents: 9_999_999,
  };
}
