"use client";

// Formulaire « Se déconnecter ». Client Component, pour une seule raison : la
// déconnexion doit se terminer par un rechargement complet du document (R18 de
// la spécification 02), et seul le navigateur peut le déclencher.
//
// Pourquoi un rechargement complet, alors que tout le reste de l'application
// navigue sans recharger : le routeur de Next garde en mémoire, dans le
// navigateur, les pages déjà affichées, pour les restituer au retour en
// arrière. Après une simple navigation vers /connexion, les pages du
// propriétaire resteraient dans cette mémoire. Recharger le document la vide
// entièrement : après une déconnexion, rien de ce compte ne subsiste dans
// l'onglet, quoi que le routeur ait gardé.
import { useTransition, type FormEvent } from "react";

import { SIGN_IN_PATH } from "@/auth/return-path";
import { SECONDARY_BUTTON_CLASSES } from "@/components/button-styles";

import { closeSession, signOut } from "./actions";

export function SignOutForm() {
  // pending : vrai entre l'envoi et le changement de page.
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // JavaScript est actif : on empêche l'envoi par `action` (qui finirait en
    // navigation côté client) et on mène la déconnexion nous-mêmes.
    event.preventDefault();
    // Dans une transition, une erreur de l'action (base injoignable) remonte à
    // la limite d'erreur de la page, qui affiche l'écran de panne.
    startTransition(async () => {
      // 1. Le serveur supprime la session et efface le cookie.
      await closeSession();
      // 2. Seulement ensuite, le navigateur charge /connexion comme une page
      //    neuve. Ce n'est pas une redirection ouverte : l'adresse est fixe.
      window.location.assign(SIGN_IN_PATH);
    });
  }

  return (
    // Un formulaire envoyé en POST, jamais un lien : le préchargement d'un lien
    // ne doit pas pouvoir déconnecter. `action` sert quand JavaScript est
    // absent ou pas encore chargé : le navigateur envoie alors le formulaire
    // lui-même, et la réponse du serveur est une redirection (R29).
    <form action={signOut} onSubmit={handleSubmit}>
      <button
        type="submit"
        // Une seule demande : le bouton ne peut pas être activé deux fois. Il
        // garde son libellé (la spécification n'en prévoit pas d'autre) et sa
        // taille ; son opacité baisse, comme le bouton d'envoi des formulaires.
        disabled={pending}
        className={`${SECONDARY_BUTTON_CLASSES} disabled:opacity-60`}
      >
        Se déconnecter
      </button>
    </form>
  );
}
