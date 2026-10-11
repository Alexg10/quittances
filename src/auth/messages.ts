// Messages d'erreur des formulaires d'inscription et de connexion, mot pour mot
// ceux de la spécification 02 (section « Contenus »). Un seul endroit : le
// serveur qui valide et les tests lisent les mêmes textes.
// Fichier pur, sans dépendance : utilisable et testable partout.
export const ERROR_MESSAGES = {
  E1: "Saisissez votre adresse e-mail.",
  E2: "Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.",
  E3: "Un compte existe déjà avec cette adresse e-mail.",
  E4: "Saisissez votre mot de passe.",
  E5: "Le mot de passe doit contenir au moins 12 caractères.",
  E6: "Le mot de passe ne peut pas dépasser 128 caractères.",
  E7: "Adresse e-mail ou mot de passe incorrect.",
  E8: "Le service est momentanément indisponible. Réessayez dans quelques instants.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;
