// Le contenu du message qui porte une quittance (R21 à R23 de la spécification
// 05), sous forme de données. Fonction pure : le composant HTML
// (receipt-email.tsx) et la version texte lisent TOUS DEUX cet objet, ce qui
// garantit qu'ils disent la même chose. Aucun import serveur.
import { formatAmount, totalInCents } from "../rentals/rental-amount";
import { formatDate } from "../rentals/rental-dates";
import { sanitizeHeaderText } from "../email/email-header";
import { formatMonthInSentence } from "./receipt-months";
import { getReceiptReference } from "./receipt-reference";
import type { ReceiptSnapshot } from "./receipt-snapshot";

// R21 : le nom affiché de l'application, et la valeur de repli d'un nom vidé
// par l'assainissement (R22).
export const SENDER_DISPLAY_NAME = "Quittances";

export type ReceiptEmailContent = {
  // R22. Aucun nom de personne ni adresse.
  subject: string;
  greeting: string;
  // Deux phrases qui se suivent à la ligne dans le texte brut.
  introduction: string;
  attachmentNote: string;
  // Total, date de paiement, référence : une ligne chacune.
  details: string[];
  replyNote: string;
  reason: string;
};

// R22 : « Quittance de loyer, octobre 2026 ».
export function getReceiptEmailSubject(month: string): string {
  return `Quittance de loyer, ${formatMonthInSentence(month)}`;
}

// R22 : le nom du bailleur tel qu'il apparaît dans un en-tête (Reply-To).
export function getReplyToName(landlordName: string): string {
  return sanitizeHeaderText(landlordName, SENDER_DISPLAY_NAME);
}

export function buildReceiptEmailContent(
  receipt: ReceiptSnapshot,
): ReceiptEmailContent {
  const total = formatAmount(
    totalInCents(receipt.rentInCents, receipt.chargesInCents),
  );
  return {
    subject: getReceiptEmailSubject(receipt.month),
    greeting: `Bonjour ${receipt.tenantName},`,
    introduction: `${receipt.landlordName} vous transmet la quittance de loyer de ${formatMonthInSentence(receipt.month)} pour le logement situé ${receipt.rentalAddress}, ${receipt.rentalPostalCode} ${receipt.rentalCity}.`,
    attachmentNote: "Elle est jointe à ce message au format PDF.",
    details: [
      `Total, charges comprises : ${total}`,
      `Paiement reçu le ${formatDate(receipt.paymentDate)}`,
      `Référence : ${getReceiptReference(receipt.id, receipt.month)}`,
    ],
    replyNote: `Pour répondre, utilisez simplement la réponse de votre messagerie : votre message sera adressé à ${receipt.landlordName}.`,
    reason:
      "Vous recevez ce message parce que votre bailleur a indiqué que vous acceptez de recevoir vos quittances de loyer par e-mail. Si ce n'est pas le cas, dites-le-lui en répondant à ce message.",
  };
}

// La version texte brut, mot pour mot (section « E-mail envoyé »). Paragraphes
// séparés par une ligne vide.
export function buildReceiptEmailText(content: ReceiptEmailContent): string {
  return [
    content.greeting,
    [content.introduction, content.attachmentNote].join("\n"),
    content.details.join("\n"),
    content.replyNote,
    content.reason,
  ].join("\n\n");
}
