"use server";

// Server Action de la connexion. C'est un point d'entrée HTTP public : n'importe
// qui peut lui envoyer un POST sans passer par notre formulaire. Elle valide donc
// tout ce qu'elle reçoit et ne lit que les deux champs attendus.
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { readTextField, type AuthFormState } from "@/auth/form-state";
import { ERROR_MESSAGES } from "@/auth/messages";
import {
  closePreviousSession,
  readPreviousSessionToken,
} from "@/auth/previous-session";
import { getSafeReturnPathFromPageUrl } from "@/auth/return-path";
import { signInWithPassword, type SignInResult } from "@/auth/sign-in";
import { validateSignIn } from "@/auth/sign-in-validation";

// Signature imposée par useActionState : l'état précédent, puis le formulaire.
// L'état précédent revient du navigateur : on ne s'en sert pas.
export async function signIn(
  previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const emailInput = readTextField(formData, "email");
  const password = readTextField(formData, "password");

  // Seule la présence des deux champs est contrôlée (R13). Ils peuvent être en
  // erreur en même temps (R25).
  const { emailError, passwordError } = validateSignIn(emailInput, password);
  if (emailError || passwordError) {
    return {
      email: emailInput,
      emailError: emailError ? ERROR_MESSAGES[emailError] : undefined,
      passwordError: passwordError ? ERROR_MESSAGES[passwordError] : undefined,
    };
  }

  let previousSessionToken: string | null;
  let result: SignInResult;
  try {
    // La session que ce navigateur porte déjà, s'il y en a une (R3). Relevée
    // avant la connexion, fermée seulement après une connexion réussie.
    previousSessionToken = await readPreviousSessionToken();
    // En cas de succès, la session est ouverte et son cookie est posé.
    result = await signInWithPassword(emailInput, password);
  } catch (error) {
    // Panne (base injoignable, erreur inattendue) : aucune session.
    // On ne journalise que le type de l'erreur : son message peut contenir la
    // requête SQL et ses valeurs.
    console.error(
      "Connexion : erreur inattendue",
      error instanceof Error ? error.name : typeof error,
    );
    return { email: emailInput, formError: ERROR_MESSAGES.E8 };
  }

  if (result === "refused") {
    // Même réponse pour une adresse inconnue, un mot de passe faux ou une
    // adresse mal formée : rien ne dit ce qui a été refusé (R13).
    return { email: emailInput, formError: ERROR_MESSAGES.E7 };
  }

  // La connexion a réussi : l'ancienne session de ce navigateur est fermée sur
  // le serveur, qu'elle appartienne au même compte ou à un autre. Un échec de
  // cette fermeture n'annule pas la connexion (voir closePreviousSession).
  if (previousSessionToken !== null) {
    await closePreviousSession(previousSessionToken);
  }

  // Destination (R14). Le paramètre `retour` est dans l'adresse de la page de
  // connexion, que cette action ne reçoit pas : elle ne voit que la requête
  // d'envoi du formulaire. Le navigateur y joint l'adresse de la page qui
  // l'envoie, dans l'en-tête Referer, avec ou sans JavaScript.
  // Cet en-tête vient du navigateur : n'importe qui peut l'écrire. La valeur
  // passe donc par la règle de R14, qui ne retient qu'un chemin interne et
  // renvoie /tableau-de-bord pour tout le reste, en-tête absent compris.
  const pageUrl = (await headers()).get("referer");

  // redirect() fonctionne en levant une erreur : il est appelé hors du try, qui
  // sinon l'intercepterait et afficherait une panne.
  redirect(getSafeReturnPathFromPageUrl(pageUrl));
}
