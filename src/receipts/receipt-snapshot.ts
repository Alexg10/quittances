// Les valeurs figées d'une quittance (R6 de la spécification 04) : tout ce que le
// document affiche, copié à la production et jamais relu ailleurs. C'est le seul
// type que le contenu (receipt-content.ts) et le document PDF connaissent : ils
// ne savent rien de la base ni de la location d'origine.
//
// Fichier de types seulement : aucun import serveur. La tâche T3 (données) fait
// produire à la base des objets de cette forme.
export type ReceiptSnapshot = {
  // Identifiant de la quittance (UUID, forme canonique). La référence du
  // document en est tirée (R16) ; elle n'est pas enregistrée à part.
  id: string;
  // Mois de rattachement, « AAAA-MM ».
  month: string;
  // Période couverte, « AAAA-MM-JJ » (R9).
  periodStart: string;
  periodEnd: string;

  landlordName: string;
  landlordAddress: string;
  // null quand il n'y a pas de complément, jamais une chaîne vide.
  landlordAddressComplement: string | null;
  landlordPostalCode: string;
  landlordCity: string;

  tenantName: string;

  rentalAddress: string;
  rentalAddressComplement: string | null;
  rentalPostalCode: string;
  rentalCity: string;

  // Montants en centimes entiers. Le total n'est jamais enregistré (R6).
  rentInCents: number;
  chargesInCents: number;

  // « AAAA-MM-JJ ». La date d'émission est le jour à Paris de la production et
  // n'est jamais antérieure à la date du paiement (R13).
  paymentDate: string;
  issueDate: string;
};
