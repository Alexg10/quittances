// Lecture des quittances d'une location pour les pages sous /locations/<id>.
// Elles appellent ces fonctions après readRentalAccess, donc avec un
// propriétaire qui vient de la session et une location qui lui appartient ; le
// magasin filtre de nouveau sur ce propriétaire dans chaque requête (R21 de la
// spécification 04).
//
// Une panne de base est un état attendu de la page ("unavailable"), pas une
// exception : une liste illisible n'est jamais rendue comme « aucune quittance ».
import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { Owner } from "@/auth/current-owner";
import {
  countReceipts,
  listReceipts,
  ReceiptStoreError,
  type Receipt,
} from "@/receipts/receipt-store";

// Les quittances de la location, mois le plus récent d'abord.
export function readRentalReceipts(
  owner: Owner,
  rentalId: string,
): Promise<Receipt[] | "unavailable"> {
  return readOrUnavailable(() => listReceipts(owner, rentalId));
}

// Leur nombre seulement, pour les pages qui n'affichent pas la liste.
export function readRentalReceiptCount(
  owner: Owner,
  rentalId: string,
): Promise<number | "unavailable"> {
  return readOrUnavailable(() => countReceipts(owner, rentalId));
}

async function readOrUnavailable<Result>(
  read: () => Promise<Result>,
): Promise<Result | "unavailable"> {
  try {
    return await read();
  } catch (error) {
    // Next signale certaines situations par des erreurs internes : on les lui
    // rend.
    unstable_rethrow(error);
    if (error instanceof ReceiptStoreError) {
      // Seul le type est journalisé (R37).
      console.error("Locations : quittances illisibles", error.name);
      return "unavailable";
    }
    throw error;
  }
}
