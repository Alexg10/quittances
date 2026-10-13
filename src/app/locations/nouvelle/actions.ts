"use server";

// Server Action de création d'une location (R7, R9, R25, R29 et R31 de la
// spécification 03). C'est un point d'entrée HTTP public : n'importe qui peut
// lui envoyer un POST sans passer par notre formulaire. Elle contrôle donc tout
// elle-même, dans l'ordre de R7 : la session, la validation, puis l'écriture.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentOwner, type Owner } from "@/auth/current-owner";
import { ERROR_MESSAGES } from "@/auth/messages";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "@/auth/return-path";
import type { RentalFormState } from "@/rentals/rental-form-state";
import {
  createRental,
  RentalStoreError,
  type CreateRentalResult,
} from "@/rentals/rental-store";
import {
  readRentalFormFields,
  rentalErrorMessage,
  validateRentalForm,
} from "@/rentals/rental-validation";

// Signature imposée par useActionState : l'état précédent, puis le formulaire.
// L'état précédent revient du navigateur : on ne s'en sert pas (R7).
export async function createRentalAction(
  previousState: RentalFormState,
  formData: FormData,
): Promise<RentalFormState> {
  // Seuls les onze champs du formulaire sont lus. Tout autre champ de la requête
  // (identifiant de propriétaire, identifiant de location, date de fin) n'est
  // jamais regardé (R7).
  const fields = readRentalFormFields(formData);

  // 1. La session. Le propriétaire vient d'elle et de rien d'autre (R4).
  let owner: Owner | null;
  try {
    owner = await getCurrentOwner();
  } catch (error) {
    // Base injoignable : rien n'est écrit, les valeurs saisies reviennent (R31).
    // Seul le type de l'erreur est journalisé, jamais une valeur saisie (R43).
    console.error(
      "Création de location : session non vérifiable",
      error instanceof Error ? error.name : typeof error,
    );
    return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
  }
  if (owner === null) {
    // Session absente ou expirée pendant la saisie : rien n'est écrit, et la
    // connexion s'ouvre sans paramètre `retour` (R7).
    redirect(SIGN_IN_PATH);
  }

  // 2. Les dix champs, validés ensemble : toutes les erreurs à la fois (R10).
  const validation = validateRentalForm(fields);
  if (!validation.ok) {
    return { fields: validation.fields, errors: validation.errors };
  }

  // 3. L'écriture, pour ce propriétaire.
  let result: CreateRentalResult;
  try {
    result = await createRental(owner, validation.values, {
      given: validation.emailConsent,
      // L'horloge du serveur : jamais une date venue du navigateur (R1 de la
      // spécification 05).
      now: new Date(),
    });
  } catch (error) {
    if (error instanceof RentalStoreError) {
      console.error("Création de location : écriture impossible", error.name);
      return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
    }
    // Erreur non prévue : elle remonte à error.tsx.
    throw error;
  }

  if (result.status === "limit-reached") {
    return { fields, errors: {}, formError: rentalErrorMessage("L28") };
  }

  // Le navigateur garde en mémoire les pages déjà affichées. Le tableau de bord
  // qu'il a en mémoire ne contient pas la nouvelle location : on le déclare
  // périmé, pour qu'il soit redemandé au serveur à la prochaine visite (R30).
  revalidatePath(DASHBOARD_PATH);

  // Destination fixe (R29) : seul l'identifiant généré par la base y figure.
  // redirect() fonctionne en levant une erreur : il est appelé hors de tout try,
  // qui l'intercepterait.
  redirect(`/locations/${result.rental.id}`);
}
