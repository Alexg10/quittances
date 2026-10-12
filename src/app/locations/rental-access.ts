// Contrôle d'accès commun aux pages sous /locations (R4, R5, R28 et R31 de la
// spécification 03). Chaque page appelle l'une de ces deux fonctions et rend
// l'écran qui correspond au résultat : il n'y a qu'un seul endroit où l'ordre
// des contrôles est écrit.
//
// L'ordre est la règle de sécurité : la session d'abord, la location ensuite.
// Un visiteur sans session n'obtient jamais "not-found" ni "found" : aucune
// location n'est lue pour lui, il ne peut donc rien apprendre d'un identifiant.
import "server-only";

import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { getCurrentOwner, type Owner } from "@/auth/current-owner";
import {
  getRental,
  RentalStoreError,
  type Rental,
} from "@/rentals/rental-store";

export type OwnerAccess =
  // Pas de session : la page redirige vers la connexion.
  | { kind: "signed-out" }
  // La base n'a pas répondu : la page affiche l'écran de panne.
  | { kind: "unavailable" }
  | { kind: "signed-in"; owner: Owner };

export type RentalAccess =
  | { kind: "signed-out" }
  | { kind: "unavailable" }
  // Sans distinction : location d'un autre compte, inexistante, supprimée, ou
  // identifiant mal formé (R5). Aucune raison n'est transmise à la page.
  | { kind: "not-found" }
  // `owner` accompagne la location : la page en a besoin pour lire ce qui
  // dépend d'elle (ses quittances), toujours filtré sur ce propriétaire.
  | { kind: "found"; owner: Owner; rental: Rental };

// `cache` de React garde le résultat le temps d'une requête : generateMetadata
// (le titre) et la page partagent une seule lecture, et rien n'est conservé
// d'une requête à l'autre ni d'un compte à l'autre (R30).
export const readOwnerAccess = cache(async (): Promise<OwnerAccess> => {
  try {
    const owner = await getCurrentOwner();
    return owner === null
      ? { kind: "signed-out" }
      : { kind: "signed-in", owner };
  } catch (error) {
    // Next signale certaines situations par des erreurs internes (une page
    // rendue hors requête pendant le build, par exemple) : on les lui rend.
    unstable_rethrow(error);
    // Seul le type de l'erreur est journalisé : son message peut contenir des
    // détails de connexion.
    console.error(
      "Locations : session non vérifiable",
      error instanceof Error ? error.name : typeof error,
    );
    return { kind: "unavailable" };
  }
});

// La location `rentalId` du propriétaire courant. `rentalId` vient de l'adresse,
// donc du visiteur : getRental refuse lui-même toute forme non canonique, sans
// lecture en base (R6), et filtre sur le propriétaire dans la requête (R4).
export const readRentalAccess = cache(
  async (rentalId: string): Promise<RentalAccess> => {
    // 1. La session, avant tout le reste.
    const access = await readOwnerAccess();
    if (access.kind !== "signed-in") {
      return access;
    }

    // 2. La location, pour ce propriétaire et lui seul.
    try {
      const rental = await getRental(access.owner, rentalId);
      return rental === null
        ? { kind: "not-found" }
        : { kind: "found", owner: access.owner, rental };
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof RentalStoreError) {
        // Une location illisible n'est jamais rendue comme « introuvable »
        // (R31). Seul le type est journalisé (R43).
        console.error("Locations : location illisible", error.name);
        return { kind: "unavailable" };
      }
      throw error;
    }
  },
);

// Chemin d'une page sous /locations, reconstruit à partir des segments que Next
// a lus dans l'adresse. Il sert au paramètre `retour` de la connexion.
// Chaque segment est réencodé : un identifiant hostile (« ../ », un saut de
// ligne) ne peut pas changer la forme du chemin. La règle de retour
// (auth/return-path) refusera ensuite ce qui n'est pas canonique.
export function buildRentalPath(...segments: string[]): string {
  return ["/locations", ...segments.map(encodeURIComponent)].join("/");
}
