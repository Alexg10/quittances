"use client";

// Formulaire de la date de fin (R21 de la spécification 03) : un champ de date,
// le bouton d'envoi et « Annuler ». Client Component pour useActionState (la
// dernière réponse du serveur, l'état d'attente) et pour le déplacement du
// focus après une erreur.
import Link from "next/link";
import { useActionState, useRef } from "react";

import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { useFocusOnError } from "@/components/use-focus-on-error";
import { toDateInputValue } from "@/rentals/rental-dates";
import type { EndDateFormState } from "@/rentals/rental-operation-state";
import { rentalErrorMessage } from "@/rentals/rental-validation";

type EndDateFormProps = {
  // La Server Action, à laquelle la page a déjà lié l'identifiant de la
  // location.
  action: (
    state: EndDateFormState,
    formData: FormData,
  ) => Promise<EndDateFormState>;
  // La date de fin enregistrée, ou "" s'il n'y en a pas.
  initialEndDate: string;
  // Le détail de la location.
  cancelHref: string;
};

export function EndDateForm({
  action,
  initialEndDate,
  cancelHref,
}: EndDateFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    endDate: initialEndDate,
  });
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(formRef, state);

  return (
    <form
      ref={formRef}
      action={formAction}
      // Pas de bulles natives : le serveur valide et fournit les messages (R10).
      noValidate
      className="flex flex-col gap-4"
    >
      <FormMessage message={state.formError} />
      <Field
        id="endDate"
        name="endDate"
        label="Date de fin du bail"
        type="date"
        autoComplete="off"
        required
        // Champ non contrôlé : après la réponse, React le remet à cette valeur.
        // Un champ de date ne sait afficher qu'une date qui existe.
        defaultValue={toDateInputValue(state.endDate)}
        error={state.error ? rentalErrorMessage(state.error) : undefined}
        hint="Dernier jour du bail. La date peut être à venir."
      />
      <SubmitButton
        label="Enregistrer la date de fin"
        pendingLabel="Enregistrement en cours"
        pending={pending}
      />
      <Link href={cancelHref} className="self-start text-primary underline">
        Annuler
      </Link>
    </form>
  );
}
