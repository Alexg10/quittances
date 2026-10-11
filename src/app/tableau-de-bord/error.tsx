"use client"; // Une limite d'erreur est toujours un Client Component.

// Filet de sécurité de l'espace réservé : toute erreur non prévue, levée
// pendant le rendu de la page ou par une de ses Server Actions (la déconnexion
// quand la base ne répond pas, par exemple), affiche l'écran de panne.
// Le cas attendu, la base injoignable à l'affichage, est traité par la page
// elle-même, sans passer par ici.
//
// `error` n'est volontairement pas affiché : aucun message technique ne doit
// parvenir à l'écran (R24). En production, Next le remplace de toute façon par
// un message générique pour les erreurs venues du serveur.
import { ServiceUnavailable } from "./service-unavailable";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  // Fournie par Next : redemande au serveur le contenu en erreur.
  retry: () => void;
};

export default function DashboardError({ retry }: DashboardErrorProps) {
  return <ServiceUnavailable retry={retry} />;
}
