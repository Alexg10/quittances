"use client"; // Une limite d'erreur est toujours un Client Component.

// Filet de sécurité de la page /archives : toute erreur non prévue, levée
// pendant le rendu, affiche l'écran de panne (R31 de la spécification 03).
// Les pannes attendues (base injoignable) sont traitées par la page elle-même,
// sans passer par ici.
//
// `error` n'est volontairement pas affiché : aucun message technique ne doit
// parvenir à l'écran.
import { ServiceUnavailable } from "../tableau-de-bord/service-unavailable";

type ArchivesErrorProps = {
  error: Error & { digest?: string };
  // Fournie par Next : redemande au serveur le contenu en erreur.
  retry: () => void;
};

export default function ArchivesError({ retry }: ArchivesErrorProps) {
  return <ServiceUnavailable retry={retry} />;
}
