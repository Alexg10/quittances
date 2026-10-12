// Liste des locations archivées (R41 de la spécification 04) : une carte, des
// lignes séparées par un filet, comme la liste du tableau de bord.
// Server Component : aucun état, aucun JavaScript envoyé au navigateur.
import Link from "next/link";

import {
  formatArchiveDate,
  formatReceiptCount,
} from "@/rentals/rental-archive-text";

// Ce qu'une ligne affiche, et rien d'autre. L'adresse e-mail du locataire n'y
// figure pas : elle n'est donc jamais écrite dans cette page (R37, point 5).
export type ArchivedRentalRowData = {
  id: string;
  address: string;
  addressComplement: string | null;
  postalCode: string;
  city: string;
  tenantName: string;
  archivedAt: Date;
  receiptCount: number;
};

type ArchivedRentalListProps = {
  // Déjà triées par le magasin : la plus récemment archivée d'abord.
  rentals: ArchivedRentalRowData[];
};

export function ArchivedRentalList({ rentals }: ArchivedRentalListProps) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {rentals.map((rental) => (
        <ArchivedRentalRow key={rental.id} rental={rental} />
      ))}
    </ul>
  );
}

function ArchivedRentalRow({ rental }: { rental: ArchivedRentalRowData }) {
  const title = rental.addressComplement
    ? `${rental.address}, ${rental.addressComplement}`
    : rental.address;

  return (
    // En dessous de 768px les informations s'empilent ; au-delà, deux colonnes.
    <li className="flex flex-col gap-3 px-4 py-3 hover:bg-background md:flex-row md:items-start md:justify-between md:gap-6">
      {/* min-w-0 : sans lui, un mot très long empêcherait la colonne de
          rétrécir. wrap-anywhere le fait passer à la ligne. */}
      <div className="flex min-w-0 flex-col gap-1">
        {/* Seul lien de la ligne : le détail, d'où l'on restaure ou supprime.
            Les valeurs sont rendues comme du texte : React les échappe. */}
        <Link
          href={`/locations/${rental.id}`}
          className="wrap-anywhere font-medium text-primary underline"
        >
          {title}
        </Link>
        <p className="wrap-anywhere text-text-secondary">
          {rental.postalCode} {rental.city}
        </p>
        <p className="wrap-anywhere">{rental.tenantName}</p>
      </div>

      <div className="flex flex-col gap-1 md:shrink-0 md:items-end md:text-right">
        <p className="text-text-secondary">
          Archivée le {formatArchiveDate(rental.archivedAt)}
        </p>
        <p className="text-text-secondary">
          {formatReceiptCount(rental.receiptCount)}
        </p>
      </div>
    </li>
  );
}
