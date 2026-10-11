"use client";

// Branche le formulaire de location sur l'action de modification. Client
// Component, pour une seule raison : useActionState, qui garde la dernière
// réponse du serveur (erreurs, valeurs saisies) et l'état d'attente.
import { useActionState } from "react";

import { RentalForm } from "@/components/rental-form";
import type { RentalFormState } from "@/rentals/rental-form-state";

type UpdateRentalFormProps = {
  // La Server Action, à laquelle la page a déjà lié l'identifiant de la
  // location : ce composant ne le reçoit pas et n'a pas de champ pour lui.
  action: (
    state: RentalFormState,
    formData: FormData,
  ) => Promise<RentalFormState>;
  // Les valeurs enregistrées, dans la forme des champs (R16, R19).
  initialState: RentalFormState;
  // Le détail de la location.
  cancelHref: string;
};

export function UpdateRentalForm({
  action,
  initialState,
  cancelHref,
}: UpdateRentalFormProps) {
  // Sans JavaScript, le navigateur envoie le formulaire en POST à la même
  // adresse et le serveur renvoie la page rendue avec l'état de l'action : les
  // messages et les valeurs saisies sont dans le HTML (R34).
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <RentalForm
      state={state}
      action={formAction}
      pending={pending}
      submitLabel="Enregistrer les modifications"
      pendingLabel="Enregistrement en cours"
      cancelHref={cancelHref}
    />
  );
}
