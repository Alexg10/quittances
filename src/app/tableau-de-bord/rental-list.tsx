// Liste sémantique de locations (R35, R41) : une carte, des lignes séparées par
// un filet. Server Component.
import type { RentalStatus } from "@/rentals/rental-dates";

import { RentalRow, type RentalRowData } from "./rental-row";

type RentalListProps = {
  rentals: RentalRowData[];
  // Tous les éléments d'une liste ont le même statut : celui du groupe.
  status: RentalStatus;
};

export function RentalList({ rentals, status }: RentalListProps) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {rentals.map((rental) => (
        <RentalRow key={rental.id} rental={rental} status={status} />
      ))}
    </ul>
  );
}
