"use server";

// Server Action d'envoi d'une quittance par e-mail (R5, R25 et R26 de la
// spécification 05). Point d'entrée HTTP public, comme l'action de suppression :
// elle contrôle tout elle-même, et ne lit AUCUN champ du formulaire. Le
// destinataire est relu en base par sendReceipt (R4) : un champ `to` ou `email`
// ajouté à la requête n'a aucun effet.
//
// `receiptId` est lié par la page (`bind`) et voyage en clair : ce n'est pas lui
// qui protège la quittance, mais la lecture filtrée sur le propriétaire de la
// session, ici puis dans sendReceipt.
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { getCurrentOwner, type Owner } from "@/auth/current-owner";
import { ERROR_MESSAGES } from "@/auth/messages";
import { SIGN_IN_PATH } from "@/auth/return-path";
import { SEND_MESSAGES } from "@/receipts/receipt-sending-messages";
import { sendReceipt, type SendReceiptResult } from "@/receipts/receipt-sending";
import {
  getReceipt,
  ReceiptStoreError,
  type Receipt,
} from "@/receipts/receipt-store";
import type { ConfirmFormState } from "@/rentals/rental-operation-state";

export async function sendReceiptAction(
  receiptId: unknown,
): Promise<ConfirmFormState> {
  // 1. La session. redirect() et notFound() lèvent une erreur : ils sont
  // appelés hors de tout try, qui les intercepterait.
  let owner: Owner | null;
  try {
    owner = await getCurrentOwner();
  } catch (error) {
    console.error(
      "Envoi de quittance : session non vérifiable",
      error instanceof Error ? error.name : typeof error,
    );
    return { formError: ERROR_MESSAGES.E8 };
  }
  if (owner === null) {
    redirect(SIGN_IN_PATH);
  }

  // 2. La quittance de ce propriétaire : elle donne la location où l'on arrive
  // ensuite. sendReceipt refait la lecture, sous verrou.
  if (typeof receiptId !== "string") {
    notFound();
  }
  let receipt: Receipt | null;
  try {
    receipt = await getReceipt(owner, receiptId);
  } catch (error) {
    if (error instanceof ReceiptStoreError) {
      console.error("Envoi de quittance : lecture impossible", error.name);
      return { formError: ERROR_MESSAGES.E8 };
    }
    throw error;
  }
  if (receipt === null) {
    notFound();
  }

  // 3. L'envoi. Une erreur de base est inattendue (E8) ; une autre erreur
  // (rendu du message) remonte à error.tsx.
  let result: SendReceiptResult;
  try {
    result = await sendReceipt(owner, receipt.id, new Date());
  } catch (error) {
    if (error instanceof ReceiptStoreError) {
      console.error("Envoi de quittance : écriture impossible", error.name);
      return { formError: ERROR_MESSAGES.E8 };
    }
    throw error;
  }

  // 4. Les pages gardées par le navigateur sont périmées : le détail (état de
  // la ligne) et cette page.
  revalidatePath("/locations/[id]", "layout");
  revalidatePath("/quittances/[id]/envoyer", "page");

  // 5. L'arrivée selon le résultat (R26).
  switch (result) {
    case "quittance-introuvable":
      return notFound();
    case "envoyée":
    case "envoi-en-cours":
    case "location-archivée":
      return redirect(`/locations/${receipt.rentalId}`);
    case "accord-manquant":
      // La page, réaffichée par la revalidation, montre son bloc « Accord
      // manquant » à la place du formulaire.
      return {};
    case "non-configuré":
      return { formError: SEND_MESSAGES.M4 };
    case "destinataire-refusé":
      return { formError: SEND_MESSAGES.M3 };
    case "échec-transport":
      return { formError: SEND_MESSAGES.M2 };
    case "envoyée-non-enregistrée":
      return { formError: SEND_MESSAGES.M5 };
  }
}
