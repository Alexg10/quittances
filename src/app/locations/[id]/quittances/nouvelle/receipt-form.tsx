"use client";

// Formulaire de production d'une quittance (R35 de la spécification 04) : le
// mois, les deux montants reçus, la date du paiement et la case d'attestation.
// Client Component pour deux raisons seulement : useActionState, qui garde la
// dernière réponse du serveur (erreurs, valeurs saisies) et l'état d'attente du
// bouton, et le déplacement du focus après une erreur (useFocusOnError).
// Sans JavaScript, le navigateur envoie le formulaire en POST à la même adresse
// et le serveur renvoie la page rendue avec l'état de l'action.
import Link from "next/link";
import { useActionState, useRef } from "react";

import { CheckboxField } from "@/components/checkbox-field";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { SelectField, type SelectOption } from "@/components/select-field";
import { SubmitButton } from "@/components/submit-button";
import { useFocusOnError } from "@/components/use-focus-on-error";
import type { ReceiptFormState } from "@/receipts/receipt-form-state";
import {
  receiptErrorMessage,
  type ReceiptErrorCode,
} from "@/receipts/receipt-messages";
import { toDateInputValue } from "@/rentals/rental-dates";

type ReceiptFormProps = {
  // La Server Action, à laquelle la page a déjà lié l'identifiant de la
  // location : ce composant ne le reçoit pas et n'a pas de champ pour lui.
  action: (
    state: ReceiptFormState,
    formData: FormData,
  ) => Promise<ReceiptFormState>;
  // Mois le plus récent sélectionné, montants de la location, date vide.
  initialState: ReceiptFormState;
  // Les mois proposés, du plus récent au plus ancien. Ce n'est qu'une aide à
  // la saisie : le serveur recontrôle le mois à chaque envoi.
  months: SelectOption[];
  // Le détail de la location.
  cancelHref: string;
};

// Texte d'un code d'erreur, ou rien quand le champ est valide.
function errorText(code: ReceiptErrorCode | undefined): string | undefined {
  return code ? receiptErrorMessage(code) : undefined;
}

export function ReceiptForm({
  action,
  initialState,
  months,
  cancelHref,
}: ReceiptFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  // Sans erreur (premier affichage), aucun champ ne prend le focus.
  useFocusOnError(formRef, state);

  // L'ordre des champs dans le document est l'ordre de tabulation (R35) : mois,
  // loyer, charges, date, case, bouton d'envoi, « Annuler ».
  return (
    <form
      ref={formRef}
      action={formAction}
      // Pas de bulles natives : le serveur valide et fournit les messages.
      noValidate
      className="flex flex-col gap-4"
    >
      <FormMessage message={state.formError} />

      <SelectField
        // `key` : quand le serveur renvoie un autre mois que celui affiché au
        // départ, React remonte la liste. Sans cela, le mois choisi serait
        // perdu après une erreur : React ne lit le `defaultValue` d'un <select>
        // qu'à son montage, et il remet le formulaire à ses valeurs de départ
        // après chaque action (mesuré : la liste revenait au premier mois).
        key={state.fields.month}
        id="month"
        name="month"
        label="Mois"
        options={months}
        // Le mois choisi reste sélectionné après une erreur, s'il est encore
        // proposé.
        defaultValue={state.fields.month}
        autoComplete="off"
        required
        error={errorText(state.errors.month)}
      />
      {/* Champs de texte à clavier décimal, jamais de type number : la virgule
          française et la saisie telle quelle sont conservées (R12). */}
      <Field
        id="rent"
        name="rent"
        label="Loyer hors charges"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required
        defaultValue={state.fields.rent}
        error={errorText(state.errors.rent)}
        hint="Montant reçu pour ce mois, en euros. Modifiez-le si le mois est incomplet ou si le loyer a changé."
      />
      <Field
        id="charges"
        name="charges"
        label="Charges"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required
        defaultValue={state.fields.charges}
        error={errorText(state.errors.charges)}
        hint="Montant reçu pour ce mois, en euros. Saisissez 0 s'il n'y a pas de charges."
      />
      <Field
        id="paymentDate"
        name="paymentDate"
        label="Date du paiement"
        type="date"
        autoComplete="off"
        required
        // Un champ de date ne sait afficher qu'une date qui existe.
        defaultValue={toDateInputValue(state.fields.paymentDate)}
        error={errorText(state.errors.paymentDate)}
        hint="Jour où vous avez reçu le paiement."
      />
      {/* Jamais cochée d'avance, décochée après toute erreur (R14) : voir
          CheckboxField. */}
      <CheckboxField
        id="attestation"
        name="attestation"
        label="Je confirme avoir reçu en totalité le loyer et les charges indiqués ci-dessus pour ce mois."
        required
        error={errorText(state.errors.attestation)}
        hint="Une quittance atteste un paiement complet. Si le paiement est partiel, ne produisez pas de quittance."
      />

      <SubmitButton
        label="Produire la quittance"
        pendingLabel="Production en cours"
        pending={pending}
      />
      <Link href={cancelHref} className="self-start text-primary underline">
        Annuler
      </Link>
    </form>
  );
}
