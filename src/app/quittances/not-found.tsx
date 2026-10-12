// Ce que Next affiche quand une page sous /quittances appelle notFound() : la
// page de suppression d'une quittance et toute autre adresse de cette section.
// Un seul fichier pour ces pages : l'écran est donc le même partout (R22).
// Il est placé à la racine de la section, et non sous [id] comme pour les
// locations : /quittances elle-même doit afficher cet écran (R24), et aucune
// page de cette section n'a d'autre sujet qu'une quittance.
import { ReceiptNotFound } from "./receipt-not-found";

export default function NotFound() {
  return <ReceiptNotFound />;
}
