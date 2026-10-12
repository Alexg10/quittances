"use client"; // Une limite d'erreur est toujours un Client Component.

// Filet de sécurité des pages sous /quittances : toute erreur non prévue, levée
// pendant le rendu ou par une Server Action, affiche l'écran de panne (R31 de la spécification 03).
// Les pannes attendues (base injoignable) sont traitées par les pages et les
// actions elles-mêmes, sans passer par ici.
//
// `error` n'est volontairement pas affiché : aucun message technique ne doit
// parvenir à l'écran.
import { ServiceUnavailable } from "../tableau-de-bord/service-unavailable";

type ReceiptsErrorProps = {
  error: Error & { digest?: string };
  // Fournie par Next : redemande au serveur le contenu en erreur.
  retry: () => void;
};

export default function ReceiptsError({ retry }: ReceiptsErrorProps) {
  return <ServiceUnavailable retry={retry} />;
}
