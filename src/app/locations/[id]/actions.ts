"use server";

// Server Actions qui visent une location existante : modification, date de fin,
// réouverture, suppression (R5, R7, R21 à R24, R29 à R31 de la spécification 03).
//
// Ce sont des points d'entrée HTTP publics : n'importe qui peut leur envoyer un
// POST sans passer par nos formulaires, avec les arguments de son choix. Les
// quatre suivent donc le même schéma, écrit une seule fois dans ce fichier :
//
//   1. la session               -> readOwnedRental
//   2. la location, pour ce propriétaire et lui seul  -> readOwnedRental
//   3. la validation des champs -> dans chaque action
//   4. l'écriture, filtrée elle aussi sur le propriétaire -> writeRental
//   5. l'invalidation des pages gardées par le navigateur, puis la redirection
//
// D'où vient l'identifiant de la location. La page le lit dans son adresse,
// relit la location en base, puis lie l'identifiant à l'action :
// `action.bind(null, rental.id)`. Il voyage ensuite avec le formulaire, hors des
// champs visibles. Mesuré sur cette version de Next : un argument lié par
// `bind` est envoyé au navigateur EN CLAIR, ni chiffré ni signé (seules les
// variables capturées par une action écrite dans un composant sont chiffrées).
// Le navigateur peut donc le remplacer par n'importe quoi : `rentalId` est une
// valeur inconnue, de n'importe quel type. Ce n'est PAS lui qui protège une
// location. Ce qui la protège, ce sont les étapes 2 et 4 : getRental et les
// écritures de rental-store filtrent sur le propriétaire de la session. Avec
// l'identifiant de la location d'un autre compte, elles répondent « introuvable »
// exactement comme pour un identifiant inconnu (R5).
//
// « Introuvable » se répond par notFound() : code 404 et écran « Location
// introuvable » quand JavaScript est actif. Sans JavaScript, Next répond à un
// notFound() levé par une action par la page 404 générale (app/not-found.tsx),
// avec le même code 404.
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { getCurrentOwner, type Owner } from "@/auth/current-owner";
import { readTextField } from "@/auth/form-state";
import { ERROR_MESSAGES } from "@/auth/messages";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "@/auth/return-path";
import type { RentalFormState } from "@/rentals/rental-form-state";
import type {
  ConfirmFormState,
  EndDateFormState,
} from "@/rentals/rental-operation-state";
import {
  deleteRental,
  getRental,
  reopenRental,
  RentalStoreError,
  setRentalEndDate,
  updateRental,
  type DeleteRentalResult,
  type Rental,
  type UpdateRentalResult,
} from "@/rentals/rental-store";
import {
  readRentalFormFields,
  validateEndDate,
  validateRentalForm,
} from "@/rentals/rental-validation";

// --- Modification (R22) ------------------------------------------------------

// Signature : l'identifiant lié par la page, puis les deux arguments de
// useActionState (l'état précédent, jamais utilisé : R7 ; le formulaire).
export async function updateRentalAction(
  rentalId: unknown,
  previousState: RentalFormState,
  formData: FormData,
): Promise<RentalFormState> {
  // Seuls les dix champs du formulaire sont lus. Un champ `id`, `rentalId`,
  // `ownerId` ou `endDate` ajouté à la requête n'est jamais regardé (R7).
  const fields = readRentalFormFields(formData);

  // 1 et 2. La session, puis la location de ce propriétaire.
  const access = await readOwnedRental("Modification de location", rentalId);
  if (access.kind === "unavailable") {
    // Panne : rien n'est écrit, les valeurs saisies reviennent (R31).
    return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
  }
  const { owner, rental } = access;

  // 3. Les dix champs. La date de fin qui sert au contrôle L22 est celle qui
  // vient d'être relue en base, jamais une valeur du formulaire.
  const validation = validateRentalForm(fields, {
    existingEndDate: rental.endDate,
  });
  if (!validation.ok) {
    return { fields: validation.fields, errors: validation.errors };
  }

  // 4. L'écriture. Le dernier enregistrement l'emporte (R26).
  const written = await writeRental("Modification de location", () =>
    updateRental(owner, rental.id, validation.values),
  );
  if (written === "unavailable") {
    return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
  }

  // 5. Arrivée sur le détail (R29).
  revalidateRentalPages();
  redirect(`/locations/${rental.id}`);
}

// --- Date de fin (R21) -------------------------------------------------------

export async function setRentalEndDateAction(
  rentalId: unknown,
  previousState: EndDateFormState,
  formData: FormData,
): Promise<EndDateFormState> {
  // Le seul champ lu.
  const endDate = readTextField(formData, "endDate");

  const access = await readOwnedRental("Fin de location", rentalId);
  if (access.kind === "unavailable") {
    return { endDate, formError: ERROR_MESSAGES.E8 };
  }
  const { owner, rental } = access;

  // La date de début qui sert au contrôle L24 est celle de la base.
  const validation = validateEndDate(endDate, rental.startDate);
  if (!validation.ok) {
    return { endDate: validation.field, error: validation.error };
  }

  const written = await writeRental("Fin de location", () =>
    setRentalEndDate(owner, rental.id, validation.endDate),
  );
  if (written === "unavailable") {
    return { endDate, formError: ERROR_MESSAGES.E8 };
  }

  revalidateRentalPages();
  redirect(`/locations/${rental.id}`);
}

// --- Réouverture (R21) -------------------------------------------------------

// Aucun champ : le formulaire envoyé n'est pas même reçu en paramètre.
// Rouvrir une location qui n'a pas de date de fin réussit aussi (R29).
export async function reopenRentalAction(
  rentalId: unknown,
): Promise<ConfirmFormState> {
  const access = await readOwnedRental("Réouverture de location", rentalId);
  if (access.kind === "unavailable") {
    return { formError: ERROR_MESSAGES.E8 };
  }
  const { owner, rental } = access;

  const written = await writeRental("Réouverture de location", () =>
    reopenRental(owner, rental.id),
  );
  if (written === "unavailable") {
    return { formError: ERROR_MESSAGES.E8 };
  }

  revalidateRentalPages();
  redirect(`/locations/${rental.id}`);
}

// --- Suppression (R23, R24) --------------------------------------------------

// Aucun champ. Une Server Action ne répond qu'à un POST : afficher, recharger
// ou précharger la page de confirmation ne supprime jamais rien (R24).
export async function deleteRentalAction(
  rentalId: unknown,
): Promise<ConfirmFormState> {
  const access = await readOwnedRental("Suppression de location", rentalId);
  if (access.kind === "unavailable") {
    return { formError: ERROR_MESSAGES.E8 };
  }
  const { owner, rental } = access;

  // Second envoi, ou location déjà supprimée dans un autre onglet : l'écriture
  // répond « introuvable », comme la lecture ci-dessus (R29).
  const written = await writeRental("Suppression de location", () =>
    deleteRental(owner, rental.id),
  );
  if (written === "unavailable") {
    return { formError: ERROR_MESSAGES.E8 };
  }

  revalidateRentalPages();
  redirect(DASHBOARD_PATH);
}

// --- Le schéma commun --------------------------------------------------------
// Ces fonctions ne sont pas exportées : dans un fichier "use server", seul ce
// qui est exporté devient une Server Action appelable par le navigateur.

type OwnedRentalAccess =
  // La base n'a pas répondu : l'action réaffiche son formulaire avec E8.
  | { kind: "unavailable" }
  | { kind: "ready"; owner: Owner; rental: Rental };

// Étapes 1 et 2 de R7. `operation` ne sert qu'au journal.
// redirect() et notFound() fonctionnent en levant une erreur : ils sont appelés
// hors de tout try, qui les intercepterait.
async function readOwnedRental(
  operation: string,
  rentalId: unknown,
): Promise<OwnedRentalAccess> {
  // 1. La session. Le propriétaire vient d'elle et de rien d'autre (R4).
  let owner: Owner | null;
  try {
    owner = await getCurrentOwner();
  } catch (error) {
    // Seul le type de l'erreur est journalisé, jamais une valeur saisie (R43).
    console.error(
      `${operation} : session non vérifiable`,
      error instanceof Error ? error.name : typeof error,
    );
    return { kind: "unavailable" };
  }
  if (owner === null) {
    // Session absente ou expirée : rien n'est lu ni écrit, et la connexion
    // s'ouvre sans paramètre `retour` (R7).
    redirect(SIGN_IN_PATH);
  }

  // 2. La location de ce propriétaire. L'identifiant vient du navigateur : il
  // peut être de n'importe quel type. getRental refuse ensuite toute chaîne qui
  // n'a pas la forme canonique, sans lecture en base (R6), et filtre sur le
  // propriétaire dans la requête.
  if (typeof rentalId !== "string") {
    notFound();
  }
  let rental: Rental | null;
  try {
    rental = await getRental(owner, rentalId);
  } catch (error) {
    if (error instanceof RentalStoreError) {
      console.error(`${operation} : location illisible`, error.name);
      return { kind: "unavailable" };
    }
    // Erreur non prévue : elle remonte à error.tsx.
    throw error;
  }
  if (rental === null) {
    // Location d'un autre compte, supprimée, inconnue, identifiant mal formé :
    // la même réponse, l'écran « Location introuvable » (R5). Elle est donnée
    // avant toute validation : jamais de message de champ dans ce cas (R7).
    notFound();
  }
  return { kind: "ready", owner, rental };
}

// Étape 4 de R7 : exécute une écriture de rental-store. Entre la lecture et
// l'écriture, la location a pu être supprimée dans un autre onglet : l'écriture,
// filtrée sur le propriétaire, répond alors "not-found", et la réponse est la
// même qu'à l'étape 2.
async function writeRental(
  operation: string,
  write: () => Promise<UpdateRentalResult | DeleteRentalResult>,
): Promise<"written" | "unavailable"> {
  let result: UpdateRentalResult | DeleteRentalResult;
  try {
    result = await write();
  } catch (error) {
    if (error instanceof RentalStoreError) {
      console.error(`${operation} : écriture impossible`, error.name);
      return "unavailable";
    }
    throw error;
  }
  if (result === "not-found") {
    notFound();
  }
  return "written";
}

// Étape 5. Le navigateur garde en mémoire les pages déjà affichées (tableau de
// bord, détail, formulaires préremplis) : on les déclare périmées, pour qu'elles
// soient redemandées au serveur à la prochaine visite (R30).
function revalidateRentalPages(): void {
  revalidatePath(DASHBOARD_PATH);
  // "layout" : le détail et toutes les pages placées sous /locations/<id>.
  revalidatePath("/locations/[id]", "layout");
}
