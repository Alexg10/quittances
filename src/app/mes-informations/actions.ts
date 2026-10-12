"use server";

// Server Action d'enregistrement des informations du bailleur (R1, R3, R21 et
// R26 de la spécification 04). C'est un point d'entrée HTTP public : n'importe
// qui peut lui envoyer un POST sans passer par notre formulaire. Elle contrôle
// donc tout elle-même, dans cet ordre : la session, la validation, l'écriture.
//
// Aucun identifiant ne lui parvient, ni par l'adresse ni par un champ : les
// informations enregistrées sont toujours celles du propriétaire de la session.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentOwner, type Owner } from "@/auth/current-owner";
import { ERROR_MESSAGES } from "@/auth/messages";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "@/auth/return-path";
import type { LandlordFormState } from "@/receipts/landlord-form-state";
import { LANDLORD_PATH } from "@/receipts/landlord-path";
import { LandlordStoreError, saveLandlord } from "@/receipts/landlord-store";
import {
  readLandlordFormFields,
  validateLandlordForm,
} from "@/receipts/landlord-validation";

// Signature imposée par useActionState : l'état précédent, puis le formulaire.
// L'état précédent revient du navigateur : on ne s'en sert pas.
export async function saveLandlordAction(
  previousState: LandlordFormState,
  formData: FormData,
): Promise<LandlordFormState> {
  // Seuls les cinq champs du formulaire sont lus. Tout autre champ de la
  // requête (un identifiant de compte, par exemple) n'est jamais regardé (R26).
  const fields = readLandlordFormFields(formData);

  // 1. La session. Le propriétaire vient d'elle et de rien d'autre (R21).
  let owner: Owner | null;
  try {
    owner = await getCurrentOwner();
  } catch (error) {
    // Base injoignable : rien n'est écrit, les valeurs saisies reviennent.
    // Seul le type de l'erreur est journalisé, jamais une valeur saisie (R37).
    console.error(
      "Informations du bailleur : session non vérifiable",
      error instanceof Error ? error.name : typeof error,
    );
    return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
  }
  if (owner === null) {
    // Session absente ou expirée pendant la saisie : rien n'est écrit, et la
    // connexion s'ouvre sans paramètre `retour` (R26).
    redirect(SIGN_IN_PATH);
  }

  // 2. Les cinq champs, validés ensemble : toutes les erreurs à la fois.
  const validation = validateLandlordForm(fields);
  if (!validation.ok) {
    return { fields: validation.fields, errors: validation.errors };
  }

  // 3. L'écriture, pour ce propriétaire. Elle crée ou remplace : enregistrer
  // sans rien changer réussit, et le dernier enregistrement l'emporte (R3).
  try {
    await saveLandlord(owner, validation.values);
  } catch (error) {
    if (error instanceof LandlordStoreError) {
      console.error(
        "Informations du bailleur : écriture impossible",
        error.name,
      );
      return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
    }
    // Erreur non prévue : elle remonte à error.tsx.
    throw error;
  }

  // Le navigateur garde en mémoire les pages déjà affichées : ce formulaire
  // prérempli, et la page de production d'une quittance, qui affiche un bloc
  // différent selon que ces informations existent ou non. On les déclare
  // périmées, pour qu'elles soient redemandées au serveur à la prochaine visite.
  revalidatePath(LANDLORD_PATH);
  revalidatePath("/locations/[id]", "layout");

  // Destination fixe (R26). redirect() fonctionne en levant une erreur : il est
  // appelé hors de tout try, qui l'intercepterait.
  redirect(DASHBOARD_PATH);
}
