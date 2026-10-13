"use server";

// Server Actions qui visent une location existante : modification, date de fin,
// réouverture, suppression (R5, R7, R21 à R24, R29 à R31 de la spécification 03),
// production d'une quittance, archivage et restauration (R26, R39 et R40 de la
// spécification 04).
//
// Ce sont des points d'entrée HTTP publics : n'importe qui peut leur envoyer un
// POST sans passer par nos formulaires, avec les arguments de son choix. Elles
// suivent donc toutes le même schéma, écrit une seule fois dans ce fichier :
//
//   1. la session               -> readOwnedRental
//   2. la location, pour ce propriétaire et lui seul  -> readOwnedRental
//   3. l'état d'archivage, puis la validation des champs -> dans chaque action
//   4. l'écriture, filtrée elle aussi sur le propriétaire -> writeRental
//   5. l'invalidation des pages gardées par le navigateur, puis la redirection
//
// L'ordre de 2 et 3 est une règle de sécurité : l'état d'une location n'est
// regardé qu'une fois établi qu'elle appartient au demandeur. Pour la location
// d'un autre compte, la réponse est « introuvable » à l'étape 2, qu'elle soit
// en cours, terminée ou archivée, avec ou sans quittance : rien ne révèle son
// état (R40).
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
// « État inapplicable » (R40 de la spécification 04). Une écriture peut répondre
// "not-applicable" : la location existe et appartient au demandeur, mais elle
// est archivée (modification, date de fin, réouverture, archivage), elle n'est
// pas terminée (archivage), elle est active (restauration), ou elle a au moins
// une quittance et n'est pas archivée (suppression). Rien n'a été écrit, et la
// réponse est une redirection vers le détail, qui montre l'état réel : ni
// message d'erreur, ni écran « introuvable ». C'est l'écriture qui décide, sur
// l'état en base à cet instant : jamais la page affichée, ni la lecture de
// l'étape 2, qui peuvent dater d'avant un changement fait dans un autre onglet.
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
import { getLandlord, LandlordStoreError } from "@/receipts/landlord-store";
import type { LandlordValues } from "@/receipts/landlord-validation";
import type { ReceiptFormState } from "@/receipts/receipt-form-state";
import { RECEIPT_ERROR_MESSAGES } from "@/receipts/receipt-messages";
import { ARCHIVES_PATH } from "@/rentals/archives-path";
import {
  produceReceipt,
  ReceiptStoreError,
  type ProduceReceiptResult,
} from "@/receipts/receipt-store";
import {
  readReceiptFormFields,
  validateReceiptForm,
} from "@/receipts/receipt-validation";
import type { RentalFormState } from "@/rentals/rental-form-state";
import type {
  ConfirmFormState,
  EndDateFormState,
} from "@/rentals/rental-operation-state";
import {
  archiveRental,
  deleteRental,
  getRental,
  reopenRental,
  RentalStoreError,
  restoreRental,
  setRentalEndDate,
  updateRental,
  type ArchiveRentalResult,
  type DeleteRentalResult,
  type Rental,
  type RestoreRentalResult,
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

  // 3. Une location archivée ne se modifie pas : retour à son détail, sans
  // message et avant toute validation (R26, R40 de la spécification 04). Sans
  // ce contrôle, un formulaire invalide envoyé sur une location archivée
  // recevrait des messages de champ pour une page qui ne s'applique plus.
  if (rental.archivedAt !== null) {
    redirect(`/locations/${rental.id}`);
  }

  // Les dix champs. La date de fin qui sert au contrôle L22 est celle qui
  // vient d'être relue en base, jamais une valeur du formulaire.
  const validation = validateRentalForm(fields, {
    existingEndDate: rental.endDate,
  });
  if (!validation.ok) {
    return { fields: validation.fields, errors: validation.errors };
  }

  // 4. L'écriture. Le dernier enregistrement l'emporte (R26).
  const written = await writeRental("Modification de location", () =>
    updateRental(owner, rental.id, validation.values, {
      given: validation.emailConsent,
      // L'horloge du serveur : jamais une date venue du navigateur (R1 de la
      // spécification 05). La comparaison d'adresse se fait dans le store.
      now: new Date(),
    }),
  );
  if (written === "unavailable") {
    return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
  }

  // 5. Arrivée sur le détail (R29). C'est aussi la réponse à un état
  // inapplicable (location archivée entre l'étape 3 et l'écriture) : même
  // destination, rien n'a été écrit.
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

  // Une location archivée ne reçoit pas de date de fin : retour à son détail,
  // avant toute validation (R26, R40 de la spécification 04).
  if (rental.archivedAt !== null) {
    redirect(`/locations/${rental.id}`);
  }

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
// Une location archivée n'est pas rouverte : l'écriture répond
// "not-applicable", et l'arrivée est la même, le détail (R40).
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

// --- Archivage (R39, R40 de la spécification 04) -----------------------------

// Aucun champ. Une Server Action ne répond qu'à un POST : afficher, recharger
// ou précharger la page d'archivage n'archive jamais rien.
export async function archiveRentalAction(
  rentalId: unknown,
): Promise<ConfirmFormState> {
  const access = await readOwnedRental("Archivage de location", rentalId);
  if (access.kind === "unavailable") {
    return { formError: ERROR_MESSAGES.E8 };
  }
  const { owner, rental } = access;

  // L'instant de la demande, lu sur l'horloge du serveur, jamais reçu du
  // navigateur. Le magasin en tire à la fois la date d'archivage et le jour, à
  // Paris, qui dit si la location est terminée. Cette condition est dans la
  // requête d'écriture : une location rouverte dans un autre onglet depuis
  // l'affichage de la page n'est pas archivée.
  const now = new Date();
  const written = await writeRental("Archivage de location", () =>
    archiveRental(owner, rental.id, now),
  );
  if (written === "unavailable") {
    return { formError: ERROR_MESSAGES.E8 };
  }

  revalidateRentalPages();
  if (written === "not-applicable") {
    // Location en cours, ou déjà archivée (sa date d'archivage n'a pas
    // changé) : rien n'a été écrit. Le détail montre l'état réel (R40).
    redirect(`/locations/${rental.id}`);
  }
  // La location a quitté le tableau de bord (R26).
  redirect(DASHBOARD_PATH);
}

// --- Restauration (R40 de la spécification 04) -------------------------------

// Aucun champ, et pas de page de confirmation : l'opération se défait en
// archivant de nouveau. Elle reste un POST.
export async function restoreRentalAction(
  rentalId: unknown,
): Promise<ConfirmFormState> {
  const access = await readOwnedRental("Restauration de location", rentalId);
  if (access.kind === "unavailable") {
    return { formError: ERROR_MESSAGES.E8 };
  }
  const { owner, rental } = access;

  const written = await writeRental("Restauration de location", () =>
    restoreRental(owner, rental.id),
  );
  if (written === "unavailable") {
    return { formError: ERROR_MESSAGES.E8 };
  }

  // Restaurée, ou déjà active ("not-applicable", rien n'a été écrit) : dans
  // les deux cas l'arrivée est le détail, qui montre l'état réel (R26, R40).
  revalidateRentalPages();
  redirect(`/locations/${rental.id}`);
}

// --- Suppression (R23, R24 ; R19, R40 et R43 de la spécification 04) ---------

// Aucun champ. Une Server Action ne répond qu'à un POST : afficher, recharger
// ou précharger la page de confirmation ne supprime jamais rien (R24).
// Deux situations aboutissent (R43) : une location active sans quittance, et
// une location archivée, effacée avec ses quittances.
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
  if (written === "not-applicable") {
    // La location a une quittance et n'est pas archivée (restaurée dans un
    // autre onglet, par exemple) : elle n'a pas été supprimée (R43 de la
    // spécification 04). Arrivée sur son détail.
    redirect(`/locations/${rental.id}`);
  }
  // Arrivée (R26) : les archives pour une location archivée, le tableau de
  // bord pour une location active. Elle est décidée d'après la location relue
  // en base à l'étape 2, jamais d'après un champ du formulaire ni l'adresse
  // d'où il vient : le navigateur ne choisit pas la destination.
  redirect(rental.archivedAt !== null ? ARCHIVES_PATH : DASHBOARD_PATH);
}

// --- Production d'une quittance (R6, R25 et R26 de la spécification 04) -------

// Ordre des contrôles (R26) : la session ; la location de ce propriétaire ; son
// état d'archivage ; la présence des informations du bailleur ; la validation de
// tous les champs ; puis l'écriture, qui recontrôle tout dans une transaction
// et où la contrainte d'unicité de la base tranche.
export async function produceReceiptAction(
  rentalId: unknown,
  previousState: ReceiptFormState,
  formData: FormData,
): Promise<ReceiptFormState> {
  // Seuls les cinq champs du formulaire sont lus. Un champ `ownerId`,
  // `landlordName`, `tenantName`, `periodStart` ou `issueDate` ajouté à la
  // requête n'est jamais regardé : ces valeurs sont relues en base (R6).
  const submitted = readReceiptFormFields(formData);
  // Ce que l'action renvoie quand elle n'aboutit pas : les valeurs saisies,
  // sauf la case d'attestation, toujours décochée au réaffichage (R14).
  const fields = { ...submitted, attestation: "" };

  // Un seul instant pour toute l'action, lu une fois sur l'horloge du serveur.
  // Il sert à la validation (mois acceptés, date du paiement), puis il est
  // passé tel quel au magasin, qui en tire la date d'émission. Avec deux
  // lectures de l'horloge de part et d'autre de minuit, une date de paiement
  // acceptée par la validation pourrait être refusée par la base.
  const now = new Date();

  // 1 et 2. La session, puis la location de ce propriétaire. Pour la location
  // d'un autre compte, la réponse est « Location introuvable », donnée ici,
  // avant toute validation : jamais un message de champ.
  const access = await readOwnedRental("Production de quittance", rentalId);
  if (access.kind === "unavailable") {
    return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
  }
  const { owner, rental } = access;

  // 3. Une location archivée ne reçoit pas de quittance : retour à son détail,
  // sans message (R40).
  if (rental.archivedAt !== null) {
    redirect(`/locations/${rental.id}`);
  }

  // 4. Les informations du bailleur, avant tout champ (Q7).
  let landlord: LandlordValues | null;
  try {
    landlord = await getLandlord(owner);
  } catch (error) {
    if (error instanceof LandlordStoreError) {
      console.error(
        "Production de quittance : informations du bailleur illisibles",
        error.name,
      );
      return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
    }
    throw error;
  }
  if (landlord === null) {
    return { fields, errors: {}, formError: RECEIPT_ERROR_MESSAGES.Q7 };
  }

  // 5. Tous les champs ensemble. Les dates du bail qui bornent les mois
  // acceptés sont celles qui viennent d'être relues en base.
  const validation = validateReceiptForm(submitted, {
    startDate: rental.startDate,
    endDate: rental.endDate,
    now,
  });
  if (!validation.ok) {
    return { fields: validation.fields, errors: validation.errors };
  }

  // 6. L'écriture. Le magasin reverrouille et relit la location et les
  // informations du bailleur dans sa transaction : ce sont ces valeurs-là qui
  // sont figées, pas celles lues aux étapes 2 et 4.
  let result: ProduceReceiptResult;
  try {
    result = await produceReceipt(
      owner,
      rental.id,
      {
        month: validation.values.month,
        rentInCents: validation.values.rentInCents,
        chargesInCents: validation.values.chargesInCents,
        paymentDate: validation.values.paymentDate,
      },
      now,
    );
  } catch (error) {
    if (error instanceof ReceiptStoreError) {
      console.error("Production de quittance : écriture impossible", error.name);
      return { fields, errors: {}, formError: ERROR_MESSAGES.E8 };
    }
    throw error;
  }

  // 7. Chacun des huit résultats du magasin a sa réponse. Tous sauf "produced"
  // signifient que rien n'a été écrit. La plupart ne peuvent arriver que si
  // quelque chose a changé entre les étapes ci-dessus et la transaction (autre
  // onglet, requête rejouée).
  switch (result.status) {
    case "produced":
      // La quittance figure dans la section « Quittances » du détail.
      revalidateRentalPages();
      redirect(`/locations/${rental.id}`);
    case "rental-not-found":
      // Supprimée entre-temps : même réponse qu'à l'étape 2.
      notFound();
    case "rental-archived":
      revalidateRentalPages();
      redirect(`/locations/${rental.id}`);
    case "landlord-missing":
      return { fields, errors: {}, formError: RECEIPT_ERROR_MESSAGES.Q7 };
    case "month-not-accepted":
      // Les dates du bail ont changé depuis la validation.
      return { fields, errors: { month: "Q2" } };
    case "rental-not-displayable":
      return { fields, errors: {}, formError: RECEIPT_ERROR_MESSAGES.Q8 };
    case "landlord-not-displayable":
      return { fields, errors: {}, formError: RECEIPT_ERROR_MESSAGES.Q9 };
    case "already-exists":
      // R15 : la contrainte d'unicité a tranché. La quittance existante est
      // intacte.
      return { fields, errors: { month: "Q3" } };
  }
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

// Ce que rend une écriture de rental-store : faite (un mot par opération),
// "not-found" ou "not-applicable".
type RentalWriteResult =
  | UpdateRentalResult
  | DeleteRentalResult
  | ArchiveRentalResult
  | RestoreRentalResult;

// Étape 4 de R7 : exécute une écriture de rental-store. Entre la lecture et
// l'écriture, la location a pu être supprimée dans un autre onglet : l'écriture,
// filtrée sur le propriétaire, répond alors "not-found", et la réponse est la
// même qu'à l'étape 2. Elle a pu aussi changer d'état : l'écriture répond
// "not-applicable", que l'action traduit en redirection vers le détail.
async function writeRental(
  operation: string,
  write: () => Promise<RentalWriteResult>,
): Promise<"written" | "not-applicable" | "unavailable"> {
  let result: RentalWriteResult;
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
  return result === "not-applicable" ? "not-applicable" : "written";
}

// Étape 5. Le navigateur garde en mémoire les pages déjà affichées (tableau de
// bord, archives, détail, formulaires préremplis) : on les déclare périmées,
// pour qu'elles soient redemandées au serveur à la prochaine visite (R30).
function revalidateRentalPages(): void {
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(ARCHIVES_PATH);
  // "layout" : le détail et toutes les pages placées sous /locations/<id>, dont
  // la page de production d'une quittance.
  revalidatePath("/locations/[id]", "layout");
}
