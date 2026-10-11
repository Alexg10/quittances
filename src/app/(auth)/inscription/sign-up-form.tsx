"use client";

// Formulaire d'inscription. Client Component, pour trois raisons : l'état
// renvoyé par la Server Action (erreurs), l'état d'attente du bouton, et le
// déplacement du focus après une erreur.
import { useActionState, useRef } from "react";

import { EMPTY_AUTH_FORM_STATE } from "@/auth/form-state";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { PasswordField } from "@/components/password-field";
import { SubmitButton } from "@/components/submit-button";
import { useFocusOnError } from "@/components/use-focus-on-error";

import { signUp } from "./actions";

export function SignUpForm() {
  // state : la dernière réponse du serveur. pending : vrai entre l'envoi et la
  // réponse. formAction : la Server Action, à donner au formulaire.
  // Sans JavaScript, le navigateur envoie le formulaire en POST à la même
  // adresse et le serveur renvoie la page avec ce même état (R29).
  const [state, formAction, pending] = useActionState(
    signUp,
    EMPTY_AUTH_FORM_STATE,
  );

  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(formRef, state);

  return (
    <form
      ref={formRef}
      action={formAction}
      // Pas de bulles de validation du navigateur : le serveur valide et fournit
      // tous les messages (R9).
      noValidate
      className="flex flex-col gap-6"
    >
      <FormMessage message={state.formError} />

      <div className="flex flex-col gap-4">
        {/* Champs non contrôlés : après la réponse, React les remet à leur
            valeur par défaut. L'adresse revient donc telle que saisie, et le mot
            de passe, qui n'a pas de valeur par défaut, est vidé (R26). */}
        <Field
          id="email"
          name="email"
          label="Adresse e-mail"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.email}
          error={state.emailError}
        />
        <PasswordField
          id="password"
          name="password"
          label="Mot de passe"
          autoComplete="new-password"
          error={state.passwordError}
          hint="12 caractères au minimum. Conservez-le précieusement, un mot de passe oublié ne peut pas encore être réinitialisé."
        />
      </div>

      <SubmitButton
        label="Créer mon compte"
        pendingLabel="Création en cours"
        pending={pending}
      />
    </form>
  );
}
