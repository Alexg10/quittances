// Accès aux informations du bailleur (R1, R3, R21 et R23 de la spécification 04).
//
// Ce module est le SEUL endroit où elles sont lues ou écrites. Mêmes règles que
// pour les locations (src/rentals/rental-store.ts) :
//
// 1. Chaque fonction reçoit le propriétaire en premier argument et filtre sur
//    lui dans la requête. Aucune fonction ne reçoit d'identifiant de compte :
//    on ne peut lire ou écrire que les informations du propriétaire courant.
// 2. Toute écriture passe par runWriteTransaction (voir src/db/index.ts).
// 3. Une erreur de base ne transporte jamais le nom ni l'adresse du bailleur.
import "server-only";

import { eq, sql } from "drizzle-orm";

// `import type` : seuls les types sont importés, ils disparaissent à la
// compilation.
import type { Owner } from "../auth/current-owner";
import { getDb, runWriteTransaction, type WriteTransaction } from "../db";
import { requireOwnerId } from "../db/require-owner-id";
import { landlord } from "../db/schema";
import type { LandlordValues } from "./landlord-validation";

// Erreur levée quand une requête échoue (base injoignable, délai dépassé,
// contrainte refusée). L'erreur d'origine de Drizzle contient le texte de la
// requête ET ses paramètres, donc le nom et l'adresse du bailleur : on ne garde
// que le nom de l'opération et le type de l'erreur, sans `cause` (R37).
export class LandlordStoreError extends Error {
  constructor(operation: string, originalError: unknown) {
    const kind =
      originalError instanceof Error ? originalError.name : typeof originalError;
    super(
      `Informations du bailleur : échec de l'opération « ${operation} » (${kind})`,
    );
    this.name = "LandlordStoreError";
  }
}

// Colonnes rendues à l'appelant : les cinq informations de R1, rien d'autre.
const landlordColumns = {
  name: landlord.name,
  address: landlord.address,
  addressComplement: landlord.addressComplement,
  postalCode: landlord.postalCode,
  city: landlord.city,
};

// Les informations du bailleur de `owner`, ou null s'il ne les a pas encore
// renseignées (R1 : complètes ou absentes, jamais partielles).
export async function getLandlord(owner: Owner): Promise<LandlordValues | null> {
  const ownerId = requireOwnerId(owner);

  try {
    return await readLandlordWith(getDb(), ownerId);
  } catch (error) {
    throw new LandlordStoreError("lire", error);
  }
}

// Crée ou remplace les informations du bailleur de `owner` (R3). `values` est
// déjà validé et normalisé par l'appelant (validateLandlordForm) ; la base
// refuse ce qui sort des bornes. Entre deux onglets, le dernier enregistrement
// l'emporte.
export async function saveLandlord(
  owner: Owner,
  values: LandlordValues,
): Promise<void> {
  const ownerId = requireOwnerId(owner);
  // Les champs sont recopiés un par un : un champ en trop dans `values` (un
  // identifiant de compte, par exemple) ne peut pas atteindre la base.
  const picked: LandlordValues = {
    name: values.name,
    address: values.address,
    addressComplement: values.addressComplement,
    postalCode: values.postalCode,
    city: values.city,
  };

  try {
    await runWriteTransaction(async (tx) => {
      await tx
        .insert(landlord)
        .values({ ownerId, ...picked })
        // owner_id est la clé primaire : s'il existe déjà une ligne pour ce
        // compte, cette même instruction la remplace. Une seule instruction,
        // donc pas de fenêtre entre « lire » et « écrire ».
        .onConflictDoUpdate({
          target: landlord.ownerId,
          set: { ...picked, updatedAt: sql`now()` },
        });
    });
  } catch (error) {
    throw new LandlordStoreError("enregistrer", error);
  }
}

// La lecture elle-même, sur la connexion fournie : celle du pool (getLandlord)
// ou celle d'une transaction d'écriture. La production d'une quittance
// (receipt-store.ts) l'appelle dans sa transaction, pour figer des valeurs lues
// au même moment que la location (R6). `ownerId` a déjà passé requireOwnerId.
export async function readLandlordWith(
  db: WriteTransaction,
  ownerId: string,
): Promise<LandlordValues | null> {
  const rows = await db
    .select(landlordColumns)
    .from(landlord)
    .where(eq(landlord.ownerId, ownerId));
  return rows[0] ?? null;
}
