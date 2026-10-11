// Règles de validation de l'inscription (R4, R5, R7 de la spécification 02).
// Fonctions pures, sans base ni serveur (R9) : elles renvoient un code d'erreur
// (E1, E2, E4, E5, E6), dont le texte est dans ./messages.
import { normalizeEmail } from "./email";

export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type SignUpEmailValidation = {
  // Adresse normalisée (R4), que l'adresse soit valide ou non.
  email: string;
  // null : adresse valide. Un seul code, le premier applicable (R25).
  error: "E1" | "E2" | null;
};

export function validateSignUpEmail(input: string): SignUpEmailValidation {
  const email = normalizeEmail(input);

  if (email === "") {
    return { email, error: "E1" };
  }
  return { email, error: hasValidEmailFormat(email) ? null : "E2" };
}

// R5, sur une adresse déjà normalisée. Volontairement peu strict : sans envoi
// d'e-mail, rien ne prouve qu'une adresse bien formée existe.
function hasValidEmailFormat(email: string): boolean {
  if (email.length > EMAIL_MAX_LENGTH) {
    return false;
  }
  // Aucun espace, tabulation ni saut de ligne.
  if (/\s/.test(email)) {
    return false;
  }
  // Exactement un « @ » : le découpage donne deux morceaux, ni plus ni moins.
  const parts = email.split("@");
  if (parts.length !== 2) {
    return false;
  }
  const [localPart, domain] = parts;
  if (localPart === "") {
    return false;
  }
  // Le domaine contient un point, mais ni au début ni à la fin.
  return (
    domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".")
  );
}

// R7 : la longueur seule. Le mot de passe est jugé tel qu'il a été saisi, sans
// être rogné ni modifié : douze espaces sont un mot de passe valide.
// La longueur est celle de `String.length`, comme dans Better Auth : les deux
// contrôles ne peuvent donc pas se contredire.
// Renvoie null si le mot de passe est valide.
export function validateNewPassword(
  password: string,
): "E4" | "E5" | "E6" | null {
  if (password === "") {
    return "E4";
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return "E5";
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return "E6";
  }
  return null;
}
