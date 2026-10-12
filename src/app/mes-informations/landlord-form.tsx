"use client";

// Formulaire « Mes informations » (R35 de la spécification 04). Client Component
// pour deux raisons seulement : useActionState, qui garde la dernière réponse du
// serveur (erreurs, valeurs saisies) et l'état d'attente du bouton, et le
// déplacement du focus après une erreur (useFocusOnError).
// Sans JavaScript, le navigateur envoie le formulaire en POST à la même adresse
// et le serveur renvoie la page rendue avec l'état de l'action.
import Link from "next/link";
import { useActionState, useRef } from "react";

import { DASHBOARD_PATH } from "@/auth/return-path";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { useFocusOnError } from "@/components/use-focus-on-error";
import type { LandlordFormState } from "@/receipts/landlord-form-state";
import type { LandlordFormField } from "@/receipts/landlord-validation";
import { receiptErrorMessage } from "@/receipts/receipt-messages";

import { saveLandlordAction } from "./actions";

type LandlordFieldSpec = {
  name: LandlordFormField;
  label: string;
  // Ces champs décrivent le propriétaire lui-même : le navigateur peut les
  // remplir avec son identité (R35), au contraire de ceux d'une location.
  autoComplete:
    | "name"
    | "address-line1"
    | "address-line2"
    | "postal-code"
    | "address-level2";
  inputMode?: "numeric";
  hint?: string;
  required: boolean;
};

// Les cinq champs, dans l'ordre de la spécification (« Contenus »). Des données
// plutôt que du balisage répété cinq fois.
const LANDLORD_FIELDS: LandlordFieldSpec[] = [
  {
    name: "name",
    label: "Nom du bailleur",
    autoComplete: "name",
    hint: "Prénom et nom, ou dénomination pour une société. Pour plusieurs bailleurs, indiquez tous les noms.",
    required: true,
  },
  {
    name: "address",
    label: "Adresse",
    autoComplete: "address-line1",
    required: true,
  },
  {
    name: "addressComplement",
    label: "Complément d'adresse (facultatif)",
    autoComplete: "address-line2",
    hint: "Bâtiment, étage, numéro d'appartement.",
    required: false,
  },
  {
    name: "postalCode",
    label: "Code postal",
    autoComplete: "postal-code",
    inputMode: "numeric",
    required: true,
  },
  {
    name: "city",
    label: "Ville",
    autoComplete: "address-level2",
    required: true,
  },
];

type LandlordFormProps = {
  // Les valeurs enregistrées, ou des champs vides (voir toLandlordFormState).
  initialState: LandlordFormState;
};

export function LandlordForm({ initialState }: LandlordFormProps) {
  // state : la dernière réponse du serveur. formAction : l'action à donner au
  // formulaire. pending : vrai entre l'envoi et la réponse.
  const [state, formAction, pending] = useActionState(
    saveLandlordAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  // Sans erreur (premier affichage), aucun champ ne prend le focus.
  useFocusOnError(formRef, state);

  return (
    <form
      ref={formRef}
      action={formAction}
      // Pas de bulles natives : le serveur valide et fournit les messages.
      noValidate
      className="flex flex-col gap-8"
    >
      <FormMessage message={state.formError} />

      {/* fieldset + legend : le groupe est annoncé avec son nom. */}
      <fieldset className="flex min-w-0 flex-col gap-4 border-0 p-0">
        <legend className="mb-4 p-0 font-display text-body font-bold">
          Le bailleur
        </legend>
        {LANDLORD_FIELDS.map((spec) => {
          const errorCode = state.errors[spec.name];
          return (
            <Field
              key={spec.name}
              id={spec.name}
              name={spec.name}
              label={spec.label}
              type="text"
              inputMode={spec.inputMode}
              autoComplete={spec.autoComplete}
              required={spec.required}
              // Champ non contrôlé : après la réponse, React remet le champ à
              // cette valeur, c'est-à-dire à ce que l'utilisateur avait saisi.
              defaultValue={state.fields[spec.name]}
              error={errorCode ? receiptErrorMessage(errorCode) : undefined}
              hint={spec.hint}
            />
          );
        })}
      </fieldset>

      <div className="flex flex-col gap-4">
        <SubmitButton
          label="Enregistrer mes informations"
          pendingLabel="Enregistrement en cours"
          pending={pending}
        />
        <Link
          href={DASHBOARD_PATH}
          className="self-start text-primary underline"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
