// États des formulaires qui visent une location existante, hors formulaire de
// modification (qui réutilise RentalFormState) : la date de fin, la réouverture
// et la suppression (R21, R23 et R34 de la spécification 03). C'est ce que la
// Server Action renvoie au navigateur quand elle n'aboutit pas.
// Fichier pur, sans dépendance serveur.
import type { RentalErrorCode } from "./rental-messages";

// Formulaire de date de fin : un seul champ.
export type EndDateFormState = {
  // La valeur à afficher dans le champ : la date enregistrée à l'ouverture de
  // la page ("" s'il n'y en a pas), puis la valeur saisie après un refus.
  endDate: string;
  // Code du message sous le champ (L23, L20, L21 ou L24).
  error?: RentalErrorCode;
  // Message de formulaire (E8), déjà rédigé.
  formError?: string;
};

// Formulaires sans champ (« Rouvrir la location », « Supprimer
// définitivement ») : seule une panne peut les faire échouer.
export type ConfirmFormState = {
  // Message de formulaire (E8), déjà rédigé.
  formError?: string;
};

export const EMPTY_CONFIRM_FORM_STATE: ConfirmFormState = {};
