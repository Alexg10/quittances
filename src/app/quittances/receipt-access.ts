// Contrôle d'accès commun aux pages sous /quittances (R21, R22 et R24 de la
// spécification 04). Même schéma que pour les locations (../locations/rental-access) :
// la session d'abord, la quittance ensuite. Un visiteur sans session n'obtient
// jamais "not-found" ni "found" : aucune quittance n'est lue pour lui.
import "server-only";

import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import type { Owner } from "@/auth/current-owner";
import {
  getReceipt,
  ReceiptStoreError,
  type Receipt,
} from "@/receipts/receipt-store";

import { readOwnerAccess } from "../locations/rental-access";

export type ReceiptAccess =
  // Pas de session : la page redirige vers la connexion.
  | { kind: "signed-out" }
  // La base n'a pas répondu : la page affiche l'écran de panne.
  | { kind: "unavailable" }
  // Sans distinction : quittance d'un autre compte, supprimée, inconnue, ou
  // identifiant mal formé (R22). Aucune raison n'est transmise à la page.
  | { kind: "not-found" }
  | { kind: "found"; owner: Owner; receipt: Receipt };

// La quittance `receiptId` du propriétaire courant. `receiptId` vient de
// l'adresse, donc du visiteur : getReceipt refuse lui-même toute forme non
// canonique, sans lecture en base, et filtre sur le propriétaire dans sa seule
// requête (R22).
// `cache` de React garde le résultat le temps d'une requête : generateMetadata
// (le titre) et la page partagent une seule lecture.
export const readReceiptAccess = cache(
  async (receiptId: string): Promise<ReceiptAccess> => {
    // 1. La session, avant tout le reste.
    const access = await readOwnerAccess();
    if (access.kind !== "signed-in") {
      return access;
    }

    // 2. La quittance, pour ce propriétaire et lui seul.
    try {
      const receipt = await getReceipt(access.owner, receiptId);
      return receipt === null
        ? { kind: "not-found" }
        : { kind: "found", owner: access.owner, receipt };
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof ReceiptStoreError) {
        // Une quittance illisible n'est jamais rendue comme « introuvable ».
        // Seul le type est journalisé (R37).
        console.error("Quittances : quittance illisible", error.name);
        return { kind: "unavailable" };
      }
      throw error;
    }
  },
);

// Chemin d'une page sous /quittances, reconstruit à partir des segments que Next
// a lus dans l'adresse. Il sert au paramètre `retour` de la connexion. Chaque
// segment est réencodé : un identifiant hostile (« ../ », un saut de ligne) ne
// peut pas changer la forme du chemin.
export function buildReceiptPath(...segments: string[]): string {
  return ["/quittances", ...segments.map(encodeURIComponent)].join("/");
}
