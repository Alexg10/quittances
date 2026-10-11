"use client";

// Formulaire de location (R32 à R34 de la spécification 03), le même pour la
// création et la modification. Composant d'affichage : il ne connaît ni la
// Server Action ni les données, il reçoit tout en props.
//
// Client Component pour deux raisons seulement : le déplacement du focus après
// une erreur (useFocusOnError) et la lecture de `pending` pour le bouton. Les
// groupes et les champs viennent de données (rental-form-layout), les libellés
// et les messages de modules purs.
//
// Branchement (T5) : un petit Client Component appelle
//   const [state, formAction, pending] = useActionState(createRentalAction, EMPTY_RENTAL_FORM_STATE)
// puis rend <RentalForm state={state} action={formAction} pending={pending} … />.
// La frontière client passe donc par ce wrapper et ce composant, pas plus haut :
// la page (titre, repères) reste un Server Component.
import Link from "next/link";
import { useRef } from "react";

import { toDateInputValue } from "@/rentals/rental-dates";
import {
  RENTAL_FORM_GROUPS,
  type RentalFormFieldSpec,
} from "@/rentals/rental-form-layout";
import type { RentalFormState } from "@/rentals/rental-form-state";
import { rentalErrorMessage } from "@/rentals/rental-validation";

import { Field } from "./field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { useFocusOnError } from "./use-focus-on-error";

type RentalFormProps = {
  // Valeurs, erreurs et message à afficher. Un nouvel objet à chaque réponse du
  // serveur : c'est ce qui relance le focus sur l'erreur.
  state: RentalFormState;
  // L'action du formulaire : le `formAction` de useActionState. Sans JavaScript,
  // le navigateur envoie le formulaire en POST à la même adresse.
  action: (formData: FormData) => void;
  pending: boolean;
  // Libellés qui diffèrent entre création et modification (R32).
  submitLabel: string;
  pendingLabel: string;
  // Destination de « Annuler » : /tableau-de-bord ou /locations/<id>.
  cancelHref: string;
};

export function RentalForm({
  state,
  action,
  pending,
  submitLabel,
  pendingLabel,
  cancelHref,
}: RentalFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(formRef, state);

  return (
    <form
      ref={formRef}
      action={action}
      // Pas de bulles natives : le serveur valide et fournit les messages (R10).
      noValidate
      className="flex w-full max-w-160 flex-col gap-8"
    >
      <FormMessage message={state.formError} />

      {RENTAL_FORM_GROUPS.map((group) => (
        // fieldset + legend : le groupe est annoncé avec son nom (R33).
        <fieldset
          key={group.legend}
          className="flex min-w-0 flex-col gap-4 border-0 p-0"
        >
          <legend className="mb-4 p-0 font-display text-body font-bold">
            {group.legend}
          </legend>
          {group.fields.map((spec) => (
            <RentalFormField key={spec.name} spec={spec} state={state} />
          ))}
        </fieldset>
      ))}

      <div className="flex flex-col gap-4">
        <SubmitButton
          label={submitLabel}
          pendingLabel={pendingLabel}
          pending={pending}
        />
        <Link href={cancelHref} className="self-start text-primary underline">
          Annuler
        </Link>
      </div>
    </form>
  );
}

type RentalFormFieldProps = {
  spec: RentalFormFieldSpec;
  state: RentalFormState;
};

function RentalFormField({ spec, state }: RentalFormFieldProps) {
  const errorCode = state.errors[spec.name];
  const value = state.fields[spec.name];
  // Un champ de date ne sait afficher qu'une date qui existe : toute autre
  // valeur est remplacée par un champ vide (voir toDateInputValue).
  const defaultValue = spec.type === "date" ? toDateInputValue(value) : value;

  return (
    <Field
      id={spec.name}
      name={spec.name}
      label={spec.label}
      type={spec.type}
      inputMode={spec.inputMode}
      // Ces champs décrivent un tiers : le remplissage automatique y placerait
      // l'identité du propriétaire (R33).
      autoComplete="off"
      autoCapitalize={spec.type === "email" ? "none" : undefined}
      spellCheck={spec.type === "email" ? false : undefined}
      required={spec.required}
      // Champ non contrôlé : après la réponse, React remet le champ à cette
      // valeur, c'est-à-dire à ce que l'utilisateur avait saisi.
      defaultValue={defaultValue}
      error={errorCode ? rentalErrorMessage(errorCode) : undefined}
      hint={spec.hint}
    />
  );
}
