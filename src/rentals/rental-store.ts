// Accès aux données des locations (R8 de la spécification 03).
//
// Ce module est le SEUL endroit où une location est lue ou écrite. Trois règles
// y sont appliquées une fois pour toutes, pour que les pages et les actions
// n'aient pas à s'en souvenir :
//
// 1. Chaque fonction reçoit le propriétaire en premier argument et place
//    `owner_id = …` dans la clause WHERE de sa requête. Le filtre est fait par
//    la base, jamais après lecture : la location d'un autre compte ne quitte
//    même pas Postgres.
// 2. « Pas à moi » et « n'existe pas » donnent le même résultat (R5) : une
//    seule requête, filtrée à la fois sur l'identifiant et sur le propriétaire.
//    Il n'existe aucune lecture par identifiant seul.
// 3. Une erreur de base ne transporte jamais de donnée de locataire (R43).
import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

// `import type` : seul le type est importé, il disparaît à la compilation. Ce
// module ne charge donc ni next/headers ni Better Auth.
import type { Owner } from "../auth/current-owner";
import { getDb } from "../db";
import { rental } from "../db/schema";
import { isRentalId } from "./rental-id";

// R9 : un compte a au plus 100 locations, en cours et terminées confondues.
export const MAX_RENTALS_PER_OWNER = 100;

// Les dix informations saisies par le propriétaire (R1), déjà validées et
// normalisées par l'appelant : ce module ne revalide pas les formats, la base
// refuse ce qui sort des bornes.
export type RentalValues = {
  address: string;
  // null quand il n'y a pas de complément, jamais une chaîne vide.
  addressComplement: string | null;
  postalCode: string;
  city: string;
  tenantName: string;
  tenantEmail: string;
  // Montants en centimes entiers (R14).
  rentInCents: number;
  chargesInCents: number;
  // Entier de 1 à 31 (R17).
  dueDay: number;
  // Date de calendrier, sous la forme « AAAA-MM-JJ » (R19).
  startDate: string;
};

// Une location telle que le reste de l'application la voit. L'identifiant du
// propriétaire n'en fait pas partie : l'appelant le connaît déjà, et il n'a
// aucune raison d'atteindre une page.
export type Rental = RentalValues & {
  id: string;
  // « AAAA-MM-JJ », ou null tant que la location n'a pas de date de fin.
  endDate: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateRentalResult =
  | { status: "created"; rental: Rental }
  // Le compte a déjà MAX_RENTALS_PER_OWNER locations : rien n'a été créé (R9).
  | { status: "limit-reached" };

// Résultat des écritures qui visent une location existante. "not-found" couvre
// sans distinction : identifiant mal formé, identifiant inconnu, location
// supprimée, location d'un autre compte (R5).
export type UpdateRentalResult = "updated" | "not-found";
export type DeleteRentalResult = "deleted" | "not-found";

// Erreur levée quand une requête échoue (base injoignable, délai dépassé,
// contrainte refusée). L'erreur d'origine de Drizzle contient le texte de la
// requête ET ses paramètres, donc le nom et l'adresse e-mail du locataire : si
// elle remontait telle quelle, le premier journal venu les écrirait (R43,
// point 4). On ne garde que le nom de l'opération et le type de l'erreur, et on
// ne la joint pas en `cause`, que Node affiche en entier.
export class RentalStoreError extends Error {
  constructor(operation: string, originalError: unknown) {
    const kind =
      originalError instanceof Error ? originalError.name : typeof originalError;
    super(`Locations : échec de l'opération « ${operation} » (${kind})`);
    this.name = "RentalStoreError";
  }
}

// Colonnes rendues à l'appelant : toutes, sauf owner_id.
const rentalColumns = {
  id: rental.id,
  address: rental.address,
  addressComplement: rental.addressComplement,
  postalCode: rental.postalCode,
  city: rental.city,
  tenantName: rental.tenantName,
  tenantEmail: rental.tenantEmail,
  rentInCents: rental.rentInCents,
  chargesInCents: rental.chargesInCents,
  dueDay: rental.dueDay,
  startDate: rental.startDate,
  endDate: rental.endDate,
  createdAt: rental.createdAt,
  updatedAt: rental.updatedAt,
};

// Crée une location pour `owner`. Le propriétaire de la ligne vient de cet
// argument et de lui seul : `values` n'a pas de champ pour le désigner.
//
// Limite de R9 : on compte, puis on insère. Deux créations simultanées à 99
// peuvent donc toutes deux lire « 99 » et aboutir à 101 locations. La
// spécification l'accepte : la limite sert à garder la liste sur une page, ce
// n'est pas une barrière de sécurité. La rendre exacte demanderait une
// transaction qui verrouille la ligne du compte.
export async function createRental(
  owner: Owner,
  values: RentalValues,
): Promise<CreateRentalResult> {
  const ownerId = requireOwnerId(owner);

  return runQuery("créer", async () => {
    const db = getDb();

    const [{ total }] = await db
      .select({ total: count() })
      .from(rental)
      .where(eq(rental.ownerId, ownerId));
    if (total >= MAX_RENTALS_PER_OWNER) {
      return { status: "limit-reached" };
    }

    const [created] = await db
      .insert(rental)
      // Les champs sont recopiés un par un : un champ en trop dans `values`
      // (un identifiant, une date de fin) ne peut pas atteindre la base.
      .values({ ownerId, ...pickValues(values) })
      .returning(rentalColumns);
    return { status: "created", rental: created };
  });
}

// Toutes les locations de `owner`, de la plus ancienne à la plus récente. Le
// regroupement « en cours » et « terminées » dépend de la date du jour : c'est
// une règle d'affichage, appliquée par l'appelant (R35).
export async function listRentals(owner: Owner): Promise<Rental[]> {
  const ownerId = requireOwnerId(owner);

  return runQuery("lister", () =>
    getDb()
      .select(rentalColumns)
      .from(rental)
      .where(eq(rental.ownerId, ownerId))
      // L'identifiant départage deux locations créées au même instant : l'ordre
      // est le même d'un affichage à l'autre.
      .orderBy(asc(rental.createdAt), asc(rental.id)),
  );
}

// La location `rentalId` de `owner`, ou null.
export async function getRental(
  owner: Owner,
  rentalId: string,
): Promise<Rental | null> {
  const ownerId = requireOwnerId(owner);
  if (!isRentalId(rentalId)) {
    return null;
  }

  return runQuery("lire", async () => {
    const rows = await getDb()
      .select(rentalColumns)
      .from(rental)
      .where(ownedRental(ownerId, rentalId));
    return rows[0] ?? null;
  });
}

// Remplace les dix informations saisies. Ne touche jamais la date de fin (R22).
// Le dernier enregistrement l'emporte (R26) : aucune comparaison avec l'état
// précédent.
export async function updateRental(
  owner: Owner,
  rentalId: string,
  values: RentalValues,
): Promise<UpdateRentalResult> {
  return updateOwnedRental("modifier", owner, rentalId, pickValues(values));
}

// Fixe ou remplace la date de fin, et ne touche qu'elle (R21).
// `endDate` : « AAAA-MM-JJ », déjà validée, jamais antérieure au début du bail.
export async function setRentalEndDate(
  owner: Owner,
  rentalId: string,
  endDate: string,
): Promise<UpdateRentalResult> {
  return updateOwnedRental("fixer la date de fin", owner, rentalId, { endDate });
}

// Retire la date de fin. Rouvrir une location qui n'en a pas réussit aussi (R29).
export async function reopenRental(
  owner: Owner,
  rentalId: string,
): Promise<UpdateRentalResult> {
  return updateOwnedRental("rouvrir", owner, rentalId, { endDate: null });
}

// Efface réellement la ligne : ni corbeille ni marqueur « supprimée » (R23).
export async function deleteRental(
  owner: Owner,
  rentalId: string,
): Promise<DeleteRentalResult> {
  const ownerId = requireOwnerId(owner);
  if (!isRentalId(rentalId)) {
    return "not-found";
  }

  return runQuery("supprimer", async () => {
    const deletedRows = await getDb()
      .delete(rental)
      .where(ownedRental(ownerId, rentalId))
      .returning({ id: rental.id });
    return deletedRows.length === 1 ? "deleted" : "not-found";
  });
}

// Les trois modifications partagent cette fonction : un seul UPDATE, dont le
// WHERE porte sur l'identifiant ET sur le propriétaire. On ne lit pas la
// location avant d'écrire (entre les deux, elle pourrait changer de main ou
// disparaître) : on écrit, puis on regarde combien de lignes ont été touchées.
// Zéro ligne : la location n'existe pas pour ce propriétaire, rien n'a été écrit.
async function updateOwnedRental(
  operation: string,
  owner: Owner,
  rentalId: string,
  changes: Partial<RentalValues> & { endDate?: string | null },
): Promise<UpdateRentalResult> {
  const ownerId = requireOwnerId(owner);
  if (!isRentalId(rentalId)) {
    return "not-found";
  }

  return runQuery(operation, async () => {
    const updatedRows = await getDb()
      .update(rental)
      // now() : l'horloge de la base, comme pour created_at.
      .set({ ...changes, updatedAt: sql`now()` })
      .where(ownedRental(ownerId, rentalId))
      .returning({ id: rental.id });
    return updatedRows.length === 1 ? "updated" : "not-found";
  });
}

// La condition commune à toute requête qui vise une location : c'est elle qui
// rend indiscernables « pas à moi » et « n'existe pas ».
function ownedRental(ownerId: string, rentalId: string) {
  return and(eq(rental.id, rentalId), eq(rental.ownerId, ownerId));
}

// Garde-fou à l'exécution (R8) : sans propriétaire, on échoue avant toute
// requête. TypeScript refuse déjà ces appels, mais les types n'existent plus
// une fois le code compilé : un `null` venu d'un getCurrentOwner() dont on
// aurait oublié de tester le résultat arriverait ici.
function requireOwnerId(owner: Owner): string {
  // Le paramètre est relu comme une valeur inconnue : c'est précisément le cas
  // où le type annoncé est faux qu'on veut attraper.
  const candidate: unknown = owner;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("id" in candidate) ||
    typeof candidate.id !== "string" ||
    candidate.id === ""
  ) {
    throw new Error(
      "Locations : propriétaire manquant. Toute lecture ou écriture exige le résultat de getCurrentOwner().",
    );
  }
  return candidate.id;
}

// Recopie les dix champs attendus, et eux seuls.
function pickValues(values: RentalValues): RentalValues {
  return {
    address: values.address,
    addressComplement: values.addressComplement,
    postalCode: values.postalCode,
    city: values.city,
    tenantName: values.tenantName,
    tenantEmail: values.tenantEmail,
    rentInCents: values.rentInCents,
    chargesInCents: values.chargesInCents,
    dueDay: values.dueDay,
    startDate: values.startDate,
  };
}

// Exécute une requête et remplace toute erreur par une RentalStoreError, qui ne
// contient aucune donnée (voir la classe).
async function runQuery<Result>(
  operation: string,
  query: () => Promise<Result>,
): Promise<Result> {
  try {
    return await query();
  } catch (error) {
    throw new RentalStoreError(operation, error);
  }
}
