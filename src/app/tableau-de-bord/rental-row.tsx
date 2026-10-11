// Ligne de la liste des locations (R36 et R41 de la spécification 03).
// Server Component : le statut est calculé par la page et reçu en prop.
// Le type des props liste ce que la ligne affiche : l'adresse e-mail du locataire
// n'y figure pas (R36) et n'est jamais écrite dans la page.
import Link from "next/link";

import { RentalStatusChip } from "@/components/rental-status-chip";
import { formatAmount, totalInCents } from "@/rentals/rental-amount";
import { formatDate, type RentalStatus } from "@/rentals/rental-dates";

export type RentalRowData = {
  id: string;
  address: string;
  addressComplement: string | null;
  postalCode: string;
  city: string;
  tenantName: string;
  dueDay: number;
  rentInCents: number;
  chargesInCents: number;
  endDate: string | null;
};

type RentalRowProps = {
  rental: RentalRowData;
  status: RentalStatus;
};

export function RentalRow({ rental, status }: RentalRowProps) {
  const title = rental.addressComplement
    ? `${rental.address}, ${rental.addressComplement}`
    : rental.address;

  return (
    // En dessous de 768px les informations s'empilent ; au-delà, deux colonnes.
    <li className="flex flex-col gap-3 px-4 py-3 hover:bg-background md:flex-row md:items-start md:justify-between md:gap-6">
      {/* min-w-0 : sans lui, un mot très long empêcherait la colonne de
          rétrécir. wrap-anywhere le fait passer à la ligne. */}
      <div className="flex min-w-0 flex-col gap-1">
        {/* Seul lien de la ligne. Next le précharge : /locations/<id> n'existe
            qu'à partir de T5. */}
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
          Échéance le {rental.dueDay} du mois
        </p>
        {/* whitespace-nowrap : un montant ne se coupe jamais (R16). Les espaces
            du montant sont déjà insécables, c'est une seconde garantie. */}
        <p className="whitespace-nowrap font-medium tabular-nums">
          {formatAmount(totalInCents(rental.rentInCents, rental.chargesInCents))}{" "}
          <span className="font-normal text-text-secondary">
            charges comprises
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <RentalStatusChip status={status} />
          {rental.endDate ? (
            <span className="text-small text-text-secondary">
              {status === "ended" ? "Terminée le" : "Fin prévue le"}{" "}
              {formatDate(rental.endDate)}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
