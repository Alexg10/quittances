// Rappel de la quittance visée par la page de suppression (« Contenus » de la
// spécification 04) : le mois et la période, l'adresse du logement, le nom du
// locataire, le total et la référence. Uniquement les valeurs figées dans la
// quittance : rien n'est relu dans la location, et l'adresse e-mail du
// locataire n'y figure pas (R37).
// Server Component sans état : il n'envoie aucun JavaScript au navigateur.
import { formatMonthLabel } from "@/receipts/receipt-months";
import { getReceiptReference } from "@/receipts/receipt-reference";
import type { Receipt } from "@/receipts/receipt-store";
import { formatAmount, totalInCents } from "@/rentals/rental-amount";
import { formatDate } from "@/rentals/rental-dates";

type ReceiptReminderProps = {
  receipt: Receipt;
};

export function ReceiptReminder({ receipt }: ReceiptReminderProps) {
  return (
    // Les valeurs sont rendues comme du texte : React les échappe.
    // wrap-anywhere : une adresse très longue passe à la ligne.
    <p className="wrap-anywhere">
      <span className="block">
        {formatMonthLabel(receipt.month)}, du {formatDate(receipt.periodStart)}{" "}
        au {formatDate(receipt.periodEnd)}
      </span>
      <span className="block">
        {receipt.rentalAddress}
        {receipt.rentalAddressComplement
          ? `, ${receipt.rentalAddressComplement}`
          : ""}
      </span>
      <span className="block">
        {receipt.rentalPostalCode} {receipt.rentalCity}
      </span>
      <span className="block">{receipt.tenantName}</span>
      {/* Un montant ne se coupe jamais, et ses chiffres sont tabulaires. */}
      <span className="block">
        <span className="whitespace-nowrap tabular-nums">
          {formatAmount(
            totalInCents(receipt.rentInCents, receipt.chargesInCents),
          )}
        </span>{" "}
        charges comprises
      </span>
      <span className="block">
        Référence{" "}
        <span className="font-mono">
          {getReceiptReference(receipt.id, receipt.month)}
        </span>
      </span>
    </p>
  );
}
