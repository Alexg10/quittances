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
// La longueur se compte en caractères Unicode (points de code), pas avec
// `String.length`, qui compte des unités UTF-16 : un emoji y vaut 2, et six
// emojis passeraient pour douze caractères.
// Better Auth, lui, compte avec `String.length` : ses bornes sont réglées en
// conséquence dans ./auth, pour qu'il ne refuse jamais ce que cette règle
// accepte.
// Renvoie null si le mot de passe est valide.
export function validateNewPassword(
  password: string,
): "E4" | "E5" | "E6" | null {
  if (password === "") {
    return "E4";
  }
  const length = countCharacters(password);
  if (length < PASSWORD_MIN_LENGTH) {
    return "E5";
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return "E6";
  }
  return null;
}

// Parcourir une chaîne avec l'opérateur de décomposition la découpe en points
// de code : "😀".length vaut 2, [..."😀"].length vaut 1.
function countCharacters(text: string): number {
  return [...text].length;
}
