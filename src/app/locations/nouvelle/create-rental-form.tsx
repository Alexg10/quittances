"use client";

// Branche le formulaire de location sur l'action de création. Client Component,
// pour une seule raison : useActionState, qui garde la dernière réponse du
// serveur (erreurs, valeurs saisies) et l'état d'attente.
// C'est la seule frontière client de la page, avec l'en-tête.
import { useActionState } from "react";

import { DASHBOARD_PATH } from "@/auth/return-path";
import { RentalForm } from "@/components/rental-form";
import { EMPTY_RENTAL_FORM_STATE } from "@/rentals/rental-form-state";

import { createRentalAction } from "./actions";

export function CreateRentalForm() {
  // state : la dernière réponse du serveur. formAction : l'action à donner au
  // formulaire. pending : vrai entre l'envoi et la réponse.
  // Sans JavaScript, le navigateur envoie le formulaire en POST à la même
  // adresse et le serveur renvoie la page rendue avec ce même état : les
  // messages et les valeurs saisies sont dans le HTML (R34).
  const [state, formAction, pending] = useActionState(
    createRentalAction,
    EMPTY_RENTAL_FORM_STATE,
  );

  return (
    <RentalForm
      state={state}
      action={formAction}
      pending={pending}
      submitLabel="Ajouter la location"
      pendingLabel="Ajout en cours"
      cancelHref={DASHBOARD_PATH}
    />
  );
}
