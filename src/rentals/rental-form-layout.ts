// Les trois groupes et les onze champs du formulaire de location, dans l'ordre de
// R33 de la spécification 03 : libellés, types de clavier et textes d'aide. Des
// données plutôt que du balisage répété onze fois. Fichier pur.
import { DUE_DAY_HELP_TEXT } from "./rental-due-day";
import type { RentalFormField } from "./rental-validation";

export type RentalFormFieldSpec = {
  name: RentalFormField;
  label: string;
  type: "text" | "email" | "date" | "checkbox";
  inputMode?: "numeric" | "decimal";
  hint?: string;
  required: boolean;
};

export type RentalFormGroupSpec = {
  legend: string;
  fields: RentalFormFieldSpec[];
};

export const RENTAL_FORM_GROUPS: RentalFormGroupSpec[] = [
  {
    legend: "Le logement",
    fields: [
      { name: "address", label: "Adresse", type: "text", required: true },
      {
        name: "addressComplement",
        label: "Complément d'adresse (facultatif)",
        type: "text",
        hint: "Bâtiment, étage, numéro d'appartement.",
        required: false,
      },
      {
        name: "postalCode",
        label: "Code postal",
        type: "text",
        inputMode: "numeric",
        required: true,
      },
      { name: "city", label: "Ville", type: "text", required: true },
    ],
  },
  {
    legend: "Le locataire",
    fields: [
      {
        name: "tenantName",
        label: "Nom du locataire",
        type: "text",
        hint: "Prénom et nom. Pour un couple ou une colocation à bail unique, indiquez tous les noms.",
        required: true,
      },
      {
        name: "tenantEmail",
        label: "Adresse e-mail du locataire",
        type: "email",
        hint: "Utilisée pour envoyer les quittances, si le locataire a donné son accord ci-dessous.",
        required: true,
      },
      // Case facultative (R1 de la spécification 05).
      {
        name: "emailConsent",
        label: "Mon locataire a accepté de recevoir ses quittances de loyer par e-mail.",
        type: "checkbox",
        hint: "Vous attestez avoir recueilli cet accord. Sans lui, la quittance ne peut pas être envoyée par e-mail ; elle reste téléchargeable.",
        required: false,
      },
    ],
  },
  {
    legend: "Le loyer et le bail",
    fields: [
      {
        name: "rent",
        label: "Loyer hors charges",
        type: "text",
        inputMode: "decimal",
        hint: "Montant mensuel en euros, par exemple 850 ou 850,50.",
        required: true,
      },
      {
        name: "charges",
        label: "Charges",
        type: "text",
        inputMode: "decimal",
        hint: "Montant mensuel en euros. Saisissez 0 s'il n'y a pas de charges.",
        required: true,
      },
      {
        name: "dueDay",
        label: "Jour d'échéance",
        type: "text",
        inputMode: "numeric",
        hint: DUE_DAY_HELP_TEXT,
        required: true,
      },
      {
        name: "startDate",
        label: "Date de début du bail",
        type: "date",
        required: true,
      },
    ],
  },
];
