// Rappel de la location visée par une page d'action (date de fin, suppression) :
// l'adresse et son complément, le code postal et la ville, le nom du locataire.
// Jamais l'adresse e-mail du locataire (R43 de la spécification 03).
// Server Component sans état : il n'envoie aucun JavaScript au navigateur.
import type { Rental } from "@/rentals/rental-store";

type RentalReminderProps = {
  rental: Rental;
  // true : texte secondaire (page de date de fin). Par défaut, texte principal.
  muted?: boolean;
};

export function RentalReminder({ rental, muted = false }: RentalReminderProps) {
  return (
    // Les valeurs sont rendues comme du texte : React les échappe (R11).
    // wrap-anywhere : une adresse très longue passe à la ligne.
    <p className={`wrap-anywhere ${muted ? "text-text-secondary" : ""}`}>
      <span className="block">
        {rental.address}
        {rental.addressComplement ? `, ${rental.addressComplement}` : ""}
      </span>
      <span className="block">
        {rental.postalCode} {rental.city}
      </span>
      <span className="block">{rental.tenantName}</span>
    </p>
  );
}
