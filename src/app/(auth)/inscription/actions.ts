"use server";

// Server Action de l'inscription. C'est un point d'entrée HTTP public : n'importe
// qui peut lui envoyer un POST sans passer par notre formulaire. Elle valide donc
// tout ce qu'elle reçoit et ne lit que les deux champs attendus.
import { redirect } from "next/navigation";

import { createAccount, type CreateAccountResult } from "@/auth/create-account";
import { readTextField, type AuthFormState } from "@/auth/form-state";
import { ERROR_MESSAGES } from "@/auth/messages";
import {
  validateNewPassword,
  validateSignUpEmail,
} from "@/auth/sign-up-validation";

// Signature imposée par useActionState : l'état précédent, puis le formulaire.
// L'état précédent revient du navigateur : on ne s'en sert pas.
export async function signUp(
  previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const emailInput = readTextField(formData, "email");
  const password = readTextField(formData, "password");

  // Les deux champs sont validés ensemble : ils peuvent être en erreur en même
  // temps (R25).
  const emailError = validateSignUpEmail(emailInput).error;
  const passwordError = validateNewPassword(password);
  if (emailError || passwordError) {
    return {
      email: emailInput,
      emailError: emailError ? ERROR_MESSAGES[emailError] : undefined,
      passwordError: passwordError ? ERROR_MESSAGES[passwordError] : undefined,
    };
  }

  let result: CreateAccountResult;
  try {
    // En cas de succès, la session est ouverte et son cookie est posé.
    result = await createAccount(emailInput, password);
  } catch (error) {
    // Panne (base injoignable, erreur inattendue) : aucun compte, aucune session.
    // On ne journalise que le type de l'erreur : son message peut contenir la
    // requête SQL et ses valeurs.
    console.error(
      "Inscription : erreur inattendue",
      error instanceof Error ? error.name : typeof error,
    );
    return { email: emailInput, formError: ERROR_MESSAGES.E8 };
  }

  if (result === "email-already-used") {
    return { email: emailInput, emailError: ERROR_MESSAGES.E3 };
  }
  if (result === "email-rejected") {
    return { email: emailInput, emailError: ERROR_MESSAGES.E2 };
  }

  // Destination fixe : rien de ce que le visiteur a envoyé ne la choisit (R11).
  // redirect() fonctionne en levant une erreur : il est appelé hors du try, qui
  // sinon l'intercepterait et afficherait une panne.
  redirect("/tableau-de-bord");
}
