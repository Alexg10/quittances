// Chip de statut d'une location (R39 de la spécification 03). Le statut est
// écrit en toutes lettres : la couleur ne le porte jamais seule.
// Sans état ni événement : Server Component, jamais cliquable.
import {
  RENTAL_STATUS_LABELS,
  type RentalStatus,
} from "@/rentals/rental-dates";

const CHIP_COLORS: Record<RentalStatus, string> = {
  ongoing: "border-success-surface bg-success-surface text-success-text",
  ended: "border-border bg-background text-text-secondary",
};

type RentalStatusChipProps = {
  status: RentalStatus;
};

export function RentalStatusChip({ status }: RentalStatusChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-caption font-medium ${CHIP_COLORS[status]}`}
    >
      {RENTAL_STATUS_LABELS[status]}
    </span>
  );
}
