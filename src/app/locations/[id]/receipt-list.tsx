// Liste des quittances d'une location (section « Quittances » du détail, R36 de
// la spécification 04) : une carte, des lignes séparées par un filet.
// Server Component : aucun état, aucun JavaScript envoyé au navigateur.
// Tout ce qui est affiché vient des valeurs figées de chaque quittance, jamais
// de la location : modifier la location ne change pas ces lignes (R7).
import Link from "next/link";

import {
  DESTRUCTIVE_BUTTON_SMALL_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from "@/components/button-styles";
import {
  formatMonthInSentence,
  formatMonthLabel,
} from "@/receipts/receipt-months";
import { getReceiptReference } from "@/receipts/receipt-reference";
import type { Receipt } from "@/receipts/receipt-store";
import { formatAmount, totalInCents } from "@/rentals/rental-amount";
import { formatDate } from "@/rentals/rental-dates";

type ReceiptListProps = {
  // Déjà triées par le magasin : mois le plus récent d'abord.
  receipts: Receipt[];
  // false pour une location archivée, en consultation seule (R39) : les lignes
  // gardent « Télécharger » et n'ont pas de lien « Supprimer ». Ce n'est qu'un
  // affichage : la page et l'action de suppression refusent elles-mêmes une
  // quittance dont la location est archivée.
  canDelete?: boolean;
};

export function ReceiptList({ receipts, canDelete = true }: ReceiptListProps) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {receipts.map((receipt) => (
        <ReceiptRow key={receipt.id} receipt={receipt} canDelete={canDelete} />
      ))}
    </ul>
  );
}

type ReceiptRowProps = {
  receipt: Receipt;
  canDelete: boolean;
};

function ReceiptRow({ receipt, canDelete }: ReceiptRowProps) {
  // « octobre 2026 » : distingue les liens de même texte d'une ligne à l'autre.
  const monthInSentence = formatMonthInSentence(receipt.month);

  return (
    // En dessous de 768px les informations s'empilent ; au-delà, deux colonnes.
    <li className="flex flex-col gap-3 px-4 py-3 hover:bg-background md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">{formatMonthLabel(receipt.month)}</p>
        <p className="text-text-secondary">
          Du {formatDate(receipt.periodStart)} au{" "}
          {formatDate(receipt.periodEnd)}
        </p>
        {/* whitespace-nowrap : un montant ne se coupe jamais. Le total est
            calculé à l'affichage, il n'est pas enregistré (R6). */}
        <p className="whitespace-nowrap font-medium tabular-nums">
          {formatAmount(
            totalInCents(receipt.rentInCents, receipt.chargesInCents),
          )}{" "}
          <span className="font-normal text-text-secondary">
            charges comprises
          </span>
        </p>
        <p className="text-text-secondary">
          Payé le {formatDate(receipt.paymentDate)}
        </p>
        <p className="text-small text-text-secondary">
          Référence{" "}
          <span className="font-mono">
            {getReceiptReference(receipt.id, receipt.month)}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-3 md:shrink-0">
        {/* Un <a> natif, et non un Link (R34) : cette adresse n'est pas une
            page mais un fichier, servi par un Route Handler. Link la
            préchargerait dès l'affichage de la liste, puis au survol : chaque
            fois, le serveur construirait un PDF pour rien. Un <a> ne demande
            l'adresse qu'au moment où il est activé.
            Pas d'attribut `download` : c'est l'en-tête Content-Disposition de
            la réponse qui déclenche l'enregistrement, et une réponse 404
            s'affiche alors normalement dans l'onglet.
            C'est, avec la déconnexion, la seule exception à la règle « un lien
            interne est un Link ». `pnpm lint` ne signale pas cette ligne : il
            n'y a donc aucune règle à désactiver ici. */}
        <a
          href={`/quittances/${receipt.id}/pdf`}
          // Le nom accessible commence par le texte visible (R36).
          aria-label={`Télécharger la quittance, ${monthInSentence}`}
          className={SECONDARY_BUTTON_CLASSES}
        >
          Télécharger
        </a>
        {/* Un lien vers la page de confirmation : l'afficher ou la précharger
            ne supprime rien, seul l'envoi de son formulaire le fait (R18). */}
        {canDelete ? (
          <Link
            href={`/quittances/${receipt.id}/supprimer`}
            aria-label={`Supprimer la quittance, ${monthInSentence}`}
            className={DESTRUCTIVE_BUTTON_SMALL_CLASSES}
          >
            Supprimer
          </Link>
        ) : null}
      </div>
    </li>
  );
}
