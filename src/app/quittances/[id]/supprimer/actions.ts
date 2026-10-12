"use server";

// Server Action de suppression d'une quittance (R18, R21, R22 et R26 de la
// spécification 04). C'est un point d'entrée HTTP public : n'importe qui peut
// lui envoyer un POST avec l'argument de son choix. Elle contrôle donc tout
// elle-même, dans cet ordre :
//
//   1. la session ;
//   2. la quittance, lue pour ce propriétaire et lui seul ;
//   3. l'écriture, filtrée elle aussi sur le propriétaire ;
//   4. l'invalidation des pages gardées par le navigateur, puis la redirection.
//
// `receiptId` est lié à l'action par la page (`action.bind(null, receipt.id)`).
// Un argument lié par `bind` voyage par le navigateur EN CLAIR, ni chiffré ni
// signé : il peut être remplacé par n'importe quoi. Ce n'est pas lui qui
// protège une quittance : ce sont les étapes 2 et 3, qui filtrent sur le
// propriétaire de la session. Avec l'identifiant de la quittance d'un autre
// compte, elles répondent « introuvable » exactement comme pour un identifiant
// inconnu (R22).
//
// Une Server Action ne répond qu'à un POST : afficher, recharger ou précharger
// la page de confirmation ne supprime jamais rien.
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { getCurrentOwner, type Owner } from "@/auth/current-owner";
import { ERROR_MESSAGES } from "@/auth/messages";
import { SIGN_IN_PATH } from "@/auth/return-path";
import {
  deleteReceipt,
  getReceipt,
  ReceiptStoreError,
  type DeleteReceiptResult,
  type Receipt,
} from "@/receipts/receipt-store";
import type { ConfirmFormState } from "@/rentals/rental-operation-state";

// Aucun champ : le formulaire envoyé n'est pas même reçu en paramètre.
export async function deleteReceiptAction(
  receiptId: unknown,
): Promise<ConfirmFormState> {
  // 1. La session. Le propriétaire vient d'elle et de rien d'autre (R21).
  let owner: Owner | null;
  try {
    owner = await getCurrentOwner();
  } catch (error) {
    // Seul le type de l'erreur est journalisé (R37).
    console.error(
      "Suppression de quittance : session non vérifiable",
      error instanceof Error ? error.name : typeof error,
    );
    return { formError: ERROR_MESSAGES.E8 };
  }
  if (owner === null) {
    // Session absente ou expirée : rien n'est lu ni écrit, et la connexion
    // s'ouvre sans paramètre `retour` (R26).
    // redirect() et notFound() fonctionnent en levant une erreur : ils sont
    // appelés hors de tout try, qui les intercepterait.
    redirect(SIGN_IN_PATH);
  }

  // 2. La quittance de ce propriétaire. L'identifiant vient du navigateur : il
  // peut être de n'importe quel type. getReceipt refuse ensuite toute chaîne
  // qui n'a pas la forme canonique, sans lecture en base. Cette lecture donne
  // aussi la location de la quittance, où l'on arrive après la suppression.
  if (typeof receiptId !== "string") {
    notFound();
  }
  let receipt: Receipt | null;
  try {
    receipt = await getReceipt(owner, receiptId);
  } catch (error) {
    if (error instanceof ReceiptStoreError) {
      console.error("Suppression de quittance : lecture impossible", error.name);
      return { formError: ERROR_MESSAGES.E8 };
    }
    // Erreur non prévue : elle remonte à error.tsx.
    throw error;
  }
  if (receipt === null) {
    // Quittance d'un autre compte, déjà supprimée, inconnue, identifiant mal
    // formé : la même réponse, l'écran « Quittance introuvable » (R22).
    notFound();
  }

  // 3. L'écriture. Entre la lecture et l'écriture, la quittance a pu être
  // supprimée dans un autre onglet : l'écriture répond alors "not-found".
  let result: DeleteReceiptResult;
  try {
    result = await deleteReceipt(owner, receipt.id);
  } catch (error) {
    if (error instanceof ReceiptStoreError) {
      console.error("Suppression de quittance : écriture impossible", error.name);
      return { formError: ERROR_MESSAGES.E8 };
    }
    throw error;
  }
  if (result === "not-found") {
    notFound();
  }

  // 4. Le navigateur garde en mémoire les pages déjà affichées : le détail de
  // la location (qui liste encore la quittance), la page de production (qui ne
  // propose pas encore son mois) et cette page de confirmation. On les déclare
  // périmées.
  revalidatePath("/locations/[id]", "layout");
  revalidatePath("/quittances/[id]/supprimer", "page");

  // Arrivée sur le détail de la location (R26). C'est aussi la réponse à
  // "not-applicable" (location archivée, R40) : même destination, rien n'a été
  // supprimé, et le détail montre l'état réel.
  redirect(`/locations/${receipt.rentalId}`);
}
