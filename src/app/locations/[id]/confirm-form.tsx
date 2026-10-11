"use client";

// Formulaire sans champ : un seul bouton, qui envoie une action en POST
// (« Rouvrir la location », « Supprimer définitivement »).
// Client Component pour une seule raison : useActionState, qui donne l'état
// d'attente du bouton et la dernière réponse du serveur (le message E8 en cas
// de panne). Sans JavaScript, le navigateur envoie le formulaire lui-même et le
// serveur répond par une redirection, ou par la page avec son message (R34).
import { useActionState, useRef } from "react";

import { FormMessage } from "@/components/form-message";
import { useFocusOnError } from "@/components/use-focus-on-error";
import {
  EMPTY_CONFIRM_FORM_STATE,
  type ConfirmFormState,
} from "@/rentals/rental-operation-state";

type ConfirmFormProps = {
  // La Server Action, à laquelle la page a déjà lié l'identifiant de la
  // location. Ce composant ne connaît donc pas cet identifiant.
  action: (state: ConfirmFormState) => Promise<ConfirmFormState>;
  label: string;
  // Libellé affiché entre l'envoi et la réponse.
  pendingLabel: string;
  // Apparence du bouton (secondaire ou destructive) : une constante de
  // components/button-styles.
  buttonClassName: string;
};

export function ConfirmForm({
  action,
  label,
  pendingLabel,
  buttonClassName,
}: ConfirmFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    EMPTY_CONFIRM_FORM_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  // Après une panne, le focus va sur le message de formulaire.
  useFocusOnError(formRef, state);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <FormMessage message={state.formError} />
      <button
        type="submit"
        // Une seule demande : le bouton ne peut pas être activé deux fois.
        disabled={pending}
        className={`${buttonClassName} self-start disabled:opacity-60`}
      >
        {pending ? pendingLabel : label}
      </button>
      {/* Un bouton désactivé n'est pas relu par un lecteur d'écran : cette
          zone, invisible à l'écran, annonce le début de l'attente. */}
      <p role="status" className="sr-only">
        {pending ? pendingLabel : ""}
      </p>
    </form>
  );
}
