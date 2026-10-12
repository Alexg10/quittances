// Lecture des informations du bailleur pour une page : la page « Mes
// informations » et la page de production d'une quittance. `owner` vient de la
// session, contrôlée par la page avant cet appel.
import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { Owner } from "@/auth/current-owner";
import { getLandlord, LandlordStoreError } from "@/receipts/landlord-store";
import type { LandlordValues } from "@/receipts/landlord-validation";

// Les informations du bailleur de `owner`, null s'il ne les a pas encore
// renseignées, ou "unavailable" si la base ne répond pas : une panne attendue
// est un état de la page, pas une exception. Les trois cas restent distincts :
// des informations illisibles ne sont jamais lues comme « absentes ».
export async function readLandlord(
  owner: Owner,
): Promise<LandlordValues | null | "unavailable"> {
  try {
    return await getLandlord(owner);
  } catch (error) {
    // Next signale certaines situations par des erreurs internes : on les lui
    // rend.
    unstable_rethrow(error);
    if (error instanceof LandlordStoreError) {
      // Seul le type est journalisé : jamais de valeur saisie (R37).
      console.error("Informations du bailleur : lecture impossible", error.name);
      return "unavailable";
    }
    throw error;
  }
}
