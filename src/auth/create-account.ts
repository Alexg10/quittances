// Création d'un compte propriétaire. Ce module regroupe les trois points où la
// spécification s'écarte du comportement par défaut de Better Auth :
// pas de nom (Q2), adresse normalisée (R4), unicité sous concurrence (R6).
import "server-only";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { user } from "../db/schema";
import { getAuth } from "./auth";
import { normalizeEmail } from "./email";

// Better Auth exige un nom à l'inscription ; la spécification n'en demande pas.
// Valeur technique, jamais affichée.
const UNUSED_NAME = "";

export type CreateAccountResult =
  // Compte créé, session ouverte (cookie posé si l'appel vient d'une Server Action).
  | "created"
  // Un compte existe déjà avec cette adresse normalisée (R12).
  | "email-already-used"
  // Adresse refusée par Better Auth, dont le contrôle de format est plus strict que R5.
  | "email-rejected";

// La validation de R5 et R7 est à faire avant d'appeler cette fonction.
// Toute autre erreur (base injoignable, erreur inattendue) est relancée :
// l'appelant la traite comme une panne.
export async function createAccount(
  emailInput: string,
  password: string,
): Promise<CreateAccountResult> {
  const email = normalizeEmail(emailInput);

  try {
    await getAuth().api.signUpEmail({
      body: { name: UNUSED_NAME, email, password },
    });
    return "created";
  } catch (error) {
    if (!(error instanceof APIError)) {
      throw error;
    }
    const code = error.body?.code;

    if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      return "email-already-used";
    }
    if (code === "INVALID_EMAIL" || code === "VALIDATION_ERROR") {
      return "email-rejected";
    }
    // Deux inscriptions simultanées avec la même adresse : toutes deux passent
    // le contrôle « l'adresse est-elle libre ? », mais la contrainte d'unicité
    // de la base n'en laisse aboutir qu'une. Better Auth signale alors à
    // l'autre un échec générique : on vérifie si l'adresse vient d'être prise.
    if (code === "FAILED_TO_CREATE_USER" && (await isEmailUsed(email))) {
      return "email-already-used";
    }
    throw error;
  }
}

async function isEmailUsed(email: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  return rows.length > 0;
}
