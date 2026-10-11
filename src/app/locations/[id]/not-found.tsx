// Ce que Next affiche quand une page sous /locations/<id> appelle notFound() :
// le détail et toute adresse placée dessous. Un seul fichier pour ces pages :
// l'écran est donc le même partout (R5).
// Il est placé ici, et non un niveau plus haut : Next joint le contenu de ce
// fichier à la réponse de chaque page du dossier où il se trouve. Plus haut,
// le texte « Location introuvable » accompagnerait aussi /locations/nouvelle.
import { RentalNotFound } from "../rental-not-found";

export default function NotFound() {
  return <RentalNotFound />;
}
