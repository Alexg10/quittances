// État du formulaire « Mes informations » (R35 de la spécification 04) : ce que
// la Server Action renvoie au navigateur, et ce que le formulaire affiche.
// Fichier pur, sans dépendance serveur.
import {
  EMPTY_LANDLORD_FORM_FIELDS,
  type LandlordFormErrors,
  type LandlordFormFields,
  type LandlordValues,
} from "./landlord-validation";

export type LandlordFormState = {
  // Les cinq valeurs à afficher, telles que saisies (ou enregistrées, à
  // l'ouverture de la page). Jamais d'identifiant de compte.
  fields: LandlordFormFields;
  // Un code d'erreur par champ en erreur (le texte vient de receiptErrorMessage).
  errors: LandlordFormErrors;
  // Message de formulaire (E8), déjà rédigé.
  formError?: string;
};

// État de départ du formulaire : vide tant que le compte n'a pas d'informations
// de bailleur, prérempli avec les valeurs enregistrées sinon (R26).
export function toLandlordFormState(
  landlord: LandlordValues | null,
): LandlordFormState {
  if (landlord === null) {
    return { fields: EMPTY_LANDLORD_FORM_FIELDS, errors: {} };
  }
  return {
    fields: {
      name: landlord.name,
      address: landlord.address,
      // Pas de complément : le champ est vide.
      addressComplement: landlord.addressComplement ?? "",
      postalCode: landlord.postalCode,
      city: landlord.city,
    },
    errors: {},
  };
}
