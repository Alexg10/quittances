// Ce que la Server Action d'un formulaire d'authentification renvoie au
// navigateur, et ce qu'elle lit dans la requête. Fichier pur, sans dépendance.

// État d'un formulaire « adresse e-mail + mot de passe » après une soumission
// refusée. Il ne contient jamais le mot de passe (R21) : le champ est donc vide
// au réaffichage (R26).
export type AuthFormState = {
  // L'adresse telle que saisie, pour la remettre dans son champ (R26).
  email: string;
  // Message sous le champ « Adresse e-mail » (E1, E2, E3).
  emailError?: string;
  // Message sous le champ « Mot de passe » (E4, E5, E6).
  passwordError?: string;
  // Message de formulaire, au-dessus des champs (E7, E8).
  formError?: string;
};

// État d'un formulaire qui n'a pas encore été envoyé.
export const EMPTY_AUTH_FORM_STATE: AuthFormState = { email: "" };

// Lit un champ de texte d'un formulaire reçu par le serveur.
// Une Server Action est un point d'entrée HTTP public : rien ne garantit que la
// requête vient de notre formulaire. Un champ peut être absent, envoyé plusieurs
// fois, ou être un fichier. Dans tous ces cas on renvoie une chaîne vide, que la
// validation traite comme un champ non rempli.
// La valeur n'est ni rognée ni modifiée.
export function readTextField(formData: FormData, name: string): string {
  const values = formData.getAll(name);
  if (values.length !== 1) {
    return "";
  }
  const [value] = values;
  return typeof value === "string" ? value : "";
}
