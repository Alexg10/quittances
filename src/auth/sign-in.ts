// Ouverture d'une session par adresse e-mail et mot de passe (R13 de la
// spécification 02). Pendant de ./create-account pour la connexion.
import "server-only";

import { getAuth } from "./auth";
import { readAuthErrorCode } from "./auth-error";
import { normalizeEmail } from "./email";

export type SignInResult =
  // Session ouverte (cookie posé si l'appel vient d'une Server Action).
  | "signed-in"
  // Identifiants refusés, sans dire lesquels ni pourquoi.
  | "refused";

// Les refus de Better Auth qui tiennent à ce que le visiteur a saisi. Ils
// donnent tous la même réponse (E7) :
// - INVALID_EMAIL_OR_PASSWORD : adresse inconnue OU mot de passe faux. La
//   bibliothèque ne distingue pas les deux, et hache le mot de passe reçu même
//   quand le compte n'existe pas, pour que les deux cas prennent le même temps ;
// - INVALID_EMAIL : adresse mal formée ;
// - PASSWORD_TOO_LONG : mot de passe plus long que la borne réglée dans ./auth.
// Tout autre code (FAILED_TO_CREATE_SESSION, par exemple) est une panne.
const REFUSED_CREDENTIALS_CODES = [
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "PASSWORD_TOO_LONG",
];

// La présence des deux champs est à vérifier avant d'appeler cette fonction.
// Toute erreur qui n'est pas un refus d'identifiants (base injoignable, erreur
// inattendue) est relancée : l'appelant la traite comme une panne.
export async function signInWithPassword(
  emailInput: string,
  password: string,
): Promise<SignInResult> {
  try {
    // Seuls l'adresse et le mot de passe sont transmis. Les en-têtes de la
    // requête ne le sont volontairement pas : Better Auth y lirait l'adresse IP
    // et l'agent utilisateur pour les enregistrer avec la session (R17).
    await getAuth().api.signInEmail({
      body: { email: normalizeEmail(emailInput), password },
    });
    return "signed-in";
  } catch (error) {
    const code = readAuthErrorCode(error);
    if (code !== undefined && REFUSED_CREDENTIALS_CODES.includes(code)) {
      return "refused";
    }
    throw error;
  }
}
