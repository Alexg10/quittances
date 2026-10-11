// État du formulaire de location (R32 à R34 de la spécification 03) : ce que la
// Server Action renvoie au navigateur, et ce que le formulaire affiche.
// Fichier pur, sans dépendance serveur.
import {
  EMPTY_RENTAL_FORM_FIELDS,
  type RentalFormErrors,
  type RentalFormFields,
} from "./rental-validation";

export type RentalFormState = {
  // Les dix valeurs à afficher, telles que saisies (ou enregistrées, à la
  // modification). Jamais d'autre donnée : ni identifiant, ni date de fin.
  fields: RentalFormFields;
  // Un code d'erreur par champ en erreur (le texte vient de rentalErrorMessage).
  errors: RentalFormErrors;
  // Message de formulaire (L28, E8), déjà rédigé.
  formError?: string;
};

// État d'un formulaire de création qui n'a pas encore été envoyé.
export const EMPTY_RENTAL_FORM_STATE: RentalFormState = {
  fields: EMPTY_RENTAL_FORM_FIELDS,
  errors: {},
};
