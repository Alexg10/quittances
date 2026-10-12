// Date d'émission d'une quittance (R6 et R13 de la spécification 04).
import { getTodayInParis } from "../rentals/rental-dates";

// R6 : la date d'émission est le jour à Europe/Paris de l'instant de production.
// L'instant est un paramètre, jamais lu ici.
export function getReceiptIssueDate(now: Date): string {
  return getTodayInParis(now);
}

// R13 : la date d'émission n'est jamais antérieure à la date du paiement. Les
// deux dates sont « AAAA-MM-JJ », comparées comme du texte. La base applique la
// même règle ; celle-ci sert à la vérifier avant d'écrire et aux tests.
export function isIssueDateConsistent(
  issueDate: string,
  paymentDate: string,
): boolean {
  return paymentDate <= issueDate;
}
