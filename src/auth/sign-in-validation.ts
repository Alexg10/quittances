// Règle de validation de la connexion (R13 de la spécification 02).
// Fonction pure, sans base ni serveur (R9).
import { normalizeEmail } from "./email";

export type SignInValidation = {
  // null : champ rempli.
  emailError: "E1" | null;
  passwordError: "E4" | null;
};

// La connexion ne contrôle que la présence des deux champs. Ni le format de
// l'adresse ni la longueur du mot de passe ne sont jugés ici : une adresse mal
// formée ou un mot de passe trop court donnent la même réponse qu'un mot de
// passe faux (E7), pour ne rien révéler de ce qui a échoué.
export function validateSignIn(
  emailInput: string,
  password: string,
): SignInValidation {
  return {
    // L'adresse est jugée après normalisation (R4) : des espaces seuls sont un
    // champ vide.
    emailError: normalizeEmail(emailInput) === "" ? "E1" : null,
    // Le mot de passe n'est jamais rogné : des espaces sont une saisie.
    passwordError: password === "" ? "E4" : null,
  };
}
