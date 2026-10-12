// Le contenu d'une quittance comme données (R27 et R30 de la spécification 04).
// Fonction pure : à partir des valeurs figées, elle rend les douze blocs du
// document sous forme de textes prêts à poser. Le composant PDF (receipt-document)
// ne fait que les dessiner ; c'est ici que se vérifie « ce que dit le document ».
// Aucun import serveur ni de la bibliothèque PDF.
import { formatAmount, totalInCents } from "../rentals/rental-amount";
import { formatDate } from "../rentals/rental-dates";
import { formatMonthInSentence, formatMonthLabel } from "./receipt-months";
import { getReceiptReference } from "./receipt-reference";
import type { ReceiptSnapshot } from "./receipt-snapshot";

// Un bloc à libellé : le libellé, puis des lignes de texte.
export type ReceiptLabeledBlock = {
  label: string;
  lines: string[];
};

export type ReceiptDetailRow = {
  label: string;
  // Montant déjà formaté, prêt à poser (voir `drawableAmount`).
  amount: string;
};

export type ReceiptMetadata = {
  title: string;
  author: string;
  // Application d'origine.
  application: string;
  language: string;
};

// Les douze blocs de R27, dans l'ordre du document.
export type ReceiptContent = {
  // 1. Titre
  title: string;
  month: string;
  // 2. Référence
  reference: string;
  // 3. Bailleur
  landlord: ReceiptLabeledBlock;
  // 4. Locataire
  tenant: ReceiptLabeledBlock;
  // 5. Logement
  rental: ReceiptLabeledBlock;
  // 6. Période
  period: ReceiptLabeledBlock;
  // 7. Détail : loyer, provisions pour charges, total
  details: ReceiptDetailRow[];
  // 8. Attestation
  attestation: string;
  // 9. Paiement
  payment: string;
  // 10. Lieu et date
  place: string;
  // 11. Signature : libellé et nom, l'espace à signer est dessiné par le document
  signature: { label: string; name: string };
  // 12. Mention de réserve
  reserve: string;
  // Métadonnées du fichier (R30)
  metadata: ReceiptMetadata;
};

export const RECEIPT_TITLE = "Quittance de loyer";

export const RECEIPT_RESERVE =
  "La présente quittance ne libère le locataire que pour la période indiquée. Elle ne vaut pas quittance des loyers et des charges des périodes antérieures.";

// formatAmount (R16 de la spécification 03) sépare les milliers par une espace
// fine insécable (U+202F), que DM Sans ne dessine pas : elle laisserait un trou
// dans « 12 345,00 € ». Le document la remplace par l'espace insécable ordinaire
// (U+00A0), que la police dessine et qui ne se coupe pas non plus. Les critères
// comparent après remplacement de toute espace par une espace ordinaire.
function drawableAmount(cents: number): string {
  return formatAmount(cents).replace(/ /g, " ");
}

// Lignes d'une adresse : adresse, complément s'il existe, code postal et ville.
function addressLines(
  address: string,
  complement: string | null,
  postalCode: string,
  city: string,
): string[] {
  return [
    address,
    ...(complement === null ? [] : [complement]),
    `${postalCode} ${city}`,
  ];
}

export function buildReceiptContent(receipt: ReceiptSnapshot): ReceiptContent {
  const start = formatDate(receipt.periodStart);
  const end = formatDate(receipt.periodEnd);
  const total = drawableAmount(
    totalInCents(receipt.rentInCents, receipt.chargesInCents),
  );

  return {
    title: RECEIPT_TITLE,
    month: formatMonthLabel(receipt.month),
    reference: `Référence ${getReceiptReference(receipt.id, receipt.month)}`,
    landlord: {
      label: "Bailleur",
      lines: [
        receipt.landlordName,
        ...addressLines(
          receipt.landlordAddress,
          receipt.landlordAddressComplement,
          receipt.landlordPostalCode,
          receipt.landlordCity,
        ),
      ],
    },
    tenant: { label: "Locataire", lines: [receipt.tenantName] },
    rental: {
      label: "Logement loué",
      lines: addressLines(
        receipt.rentalAddress,
        receipt.rentalAddressComplement,
        receipt.rentalPostalCode,
        receipt.rentalCity,
      ),
    },
    period: { label: "Période", lines: [`Du ${start} au ${end}`] },
    details: [
      {
        label: "Loyer hors charges",
        amount: drawableAmount(receipt.rentInCents),
      },
      {
        label: "Provisions pour charges",
        amount: drawableAmount(receipt.chargesInCents),
      },
      { label: "Total", amount: total },
    ],
    attestation: `Reçu de ${receipt.tenantName} la somme de ${total} au titre du loyer et des charges du logement désigné ci-dessus, pour la période du ${start} au ${end}. Le bailleur en donne quittance au locataire.`,
    payment: `Paiement reçu le ${formatDate(receipt.paymentDate)}`,
    place: `Fait à ${receipt.landlordCity}, le ${formatDate(receipt.issueDate)}`,
    signature: { label: "Le bailleur", name: receipt.landlordName },
    reserve: RECEIPT_RESERVE,
    metadata: {
      title: `${RECEIPT_TITLE}, ${formatMonthInSentence(receipt.month)}`,
      author: receipt.landlordName,
      application: "Quittances",
      language: "fr-FR",
    },
  };
}
