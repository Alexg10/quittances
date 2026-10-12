// État du formulaire de production d'une quittance (R35 de la spécification
// 04) : ce que la Server Action renvoie au navigateur, et ce que le formulaire
// affiche. Fichier pur, sans dépendance serveur.
import type {
  ReceiptFormErrors,
  ReceiptFormFields,
} from "./receipt-validation";

export type ReceiptFormState = {
  // Les valeurs à afficher, telles que saisies. `attestation` n'est jamais
  // relue par le formulaire : la case revient toujours décochée (R14).
  fields: ReceiptFormFields;
  // Un code d'erreur par champ en erreur (le texte vient de receiptErrorMessage).
  errors: ReceiptFormErrors;
  // Message de formulaire (Q7, Q8, Q9, E8), déjà rédigé.
  formError?: string;
};
