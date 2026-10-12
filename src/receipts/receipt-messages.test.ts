import { describe, expect, it } from "vitest";

import { RENTAL_ERROR_MESSAGES } from "../rentals/rental-messages";
import { RECEIPT_ERROR_MESSAGES, receiptErrorMessage } from "./receipt-messages";

// Textes copiés de la table « Messages d'erreur » de la spécification 04.
const ATTENDUS = {
  B1: "Saisissez le nom du bailleur.",
  B2: "Le nom du bailleur ne peut pas dépasser 100 caractères.",
  B3: "Saisissez votre adresse.",
  Q1: "Choisissez un mois.",
  Q2: "Ce mois ne peut pas faire l'objet d'une quittance pour cette location.",
  Q3: "Une quittance existe déjà pour ce mois. Supprimez-la depuis la page de la location pour en produire une nouvelle.",
  Q4: "Saisissez la date du paiement.",
  Q5: "La date du paiement ne peut pas être dans le futur.",
  Q6: "Cochez la case pour confirmer que le loyer et les charges ont été reçus en totalité.",
  Q7: "Renseignez vos informations de bailleur avant de produire une quittance.",
  Q8: "Le nom du locataire ou l'adresse du logement contient des caractères que la quittance ne peut pas afficher. Modifiez la location puis réessayez.",
  Q9: "Vos informations de bailleur contiennent des caractères que la quittance ne peut pas afficher. Modifiez-les puis réessayez.",
} as const;

describe("RECEIPT_ERROR_MESSAGES (messages B1 à B3 et Q1 à Q9)", () => {
  it.each(Object.entries(ATTENDUS))("%s — texte exact de la spécification", (code, texte) => {
    expect(RECEIPT_ERROR_MESSAGES[code as keyof typeof RECEIPT_ERROR_MESSAGES]).toBe(texte);
  });

  it("n'a ni plus ni moins de messages que la spécification (douze)", () => {
    expect(Object.keys(RECEIPT_ERROR_MESSAGES).sort()).toEqual(Object.keys(ATTENDUS).sort());
  });

  it("utilise l'apostrophe droite de la spécification (Q2, Q8), pas l'apostrophe typographique", () => {
    expect(RECEIPT_ERROR_MESSAGES.Q2).toContain("l'objet");
    expect(RECEIPT_ERROR_MESSAGES.Q8).toContain("l'adresse");
    expect(RECEIPT_ERROR_MESSAGES.Q2).not.toContain("’");
  });
});

describe("receiptErrorMessage", () => {
  it.each(Object.entries(ATTENDUS))("rend le texte de %s", (code, texte) => {
    expect(receiptErrorMessage(code as keyof typeof ATTENDUS)).toBe(texte);
  });

  it.each(["L2", "L3", "L4", "L5", "L6", "L7", "L12", "L13", "L14", "L15", "L16", "L20", "L21", "L25"] as const)(
    "rend pour %s le texte de la spécification 03",
    (code) => {
      expect(receiptErrorMessage(code)).toBe(RENTAL_ERROR_MESSAGES[code]);
      expect(receiptErrorMessage(code)).not.toBe("");
    },
  );
});
