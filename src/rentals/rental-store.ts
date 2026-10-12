// Accès aux données des locations (R8 de la spécification 03, R42 et R43 de la
// spécification 04).
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
//
// Deux règles concernent les écritures :
//
// 4. Elles passent toutes par runWrite (en bas du fichier), qui garantit qu'une
//    écriture ayant échoué pour cause de délai ne s'exécutera jamais plus tard
//    (R31).
// 5. Une écriture qui dépend de l'état de la location (archivée ou non,
//    terminée ou non, avec ou sans quittance) commence par verrouiller sa ligne
//    (lockRentalForWrite), puis porte elle-même la condition dans son WHERE.
//    Une location est donc écrite par une seule transaction à la fois, et la
//    condition est évaluée sur l'état en base à l'instant de l'écriture, jamais
//    sur ce qu'une page avait lu avant (R40).
import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  isNotNull,
  isNull,
  lt,
  notExists,
  sql,
} from "drizzle-orm";

// `import type` : seul le type est importé, il disparaît à la compilation. Ce
// module ne charge donc ni next/headers ni Better Auth.
import type { Owner } from "../auth/current-owner";
import { getDb, runWriteTransaction, type WriteTransaction } from "../db";
import { requireInstant } from "../db/require-instant";
import { requireOwnerId } from "../db/require-owner-id";
import { receipt, rental } from "../db/schema";
import { getTodayInParis } from "./rental-dates";
import { isRentalId } from "./rental-id";

// R9 : un compte a au plus 100 locations, en cours, terminées et archivées
// confondues (R39 de la spécification 04).
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
  // Instant de l'archivage, ou null tant que la location est active (R39 de la
  // spécification 04).
  archivedAt: Date | null;
};

// Une ligne de la page « Archives » (R41 de la spécification 04).
export type ArchivedRental = Rental & {
  archivedAt: Date;
  receiptCount: number;
};

export type CreateRentalResult =
  | { status: "created"; rental: Rental }
  // Le compte a déjà MAX_RENTALS_PER_OWNER locations : rien n'a été créé (R9).
  | { status: "limit-reached" };

// Résultat des écritures qui visent une location existante (R42 de la
// spécification 04). Trois issues :
// - faite ;
// - "not-found" : sans distinction, identifiant mal formé, identifiant inconnu,
//   location supprimée, location d'un autre compte (R5) ;
// - "not-applicable" : la location existe et appartient au propriétaire, mais
//   son état ne permet pas l'opération (R40). Rien n'a été écrit. Un autre
//   compte ne reçoit jamais cette réponse : pour lui, c'est "not-found".
export type UpdateRentalResult = "updated" | "not-found" | "not-applicable";
export type DeleteRentalResult = "deleted" | "not-found" | "not-applicable";
export type ArchiveRentalResult = "archived" | "not-found" | "not-applicable";
export type RestoreRentalResult = "restored" | "not-found" | "not-applicable";

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
  archivedAt: rental.archivedAt,
};

// Crée une location pour `owner`. Le propriétaire de la ligne vient de cet
// argument et de lui seul : `values` n'a pas de champ pour le désigner.
//
// Limite de R9 : on compte, puis on insère. Deux créations simultanées à 99
// peuvent donc toutes deux lire « 99 » et aboutir à 101 locations. La
// spécification l'accepte : la limite sert à garder la liste sur une page, ce
// n'est pas une barrière de sécurité. La rendre exacte demanderait une
// transaction qui verrouille la ligne du compte. La transaction de runWrite
// n'y change rien : au niveau d'isolation par défaut de Postgres, chacune des
// deux créations compte sans voir l'insertion non validée de l'autre.
//
// Le compte porte sur toutes les locations du compte, archivées comprises
// (R39 de la spécification 04) : seule une suppression libère une place.
export async function createRental(
  owner: Owner,
  values: RentalValues,
): Promise<CreateRentalResult> {
  const ownerId = requireOwnerId(owner);

  return runWrite("créer", async (tx) => {
    const [{ total }] = await tx
      .select({ total: count() })
      .from(rental)
      .where(eq(rental.ownerId, ownerId));
    if (total >= MAX_RENTALS_PER_OWNER) {
      return { status: "limit-reached" };
    }

    const [created] = await tx
      .insert(rental)
      // Les champs sont recopiés un par un : un champ en trop dans `values`
      // (un identifiant, une date de fin) ne peut pas atteindre la base.
      .values({ ownerId, ...pickValues(values) })
      .returning(rentalColumns);
    return { status: "created", rental: created };
  });
}

// Les locations ACTIVES de `owner` (celles du tableau de bord), de la plus
// ancienne à la plus récente. Les locations archivées n'y figurent pas (R42 de
// la spécification 04) : voir listArchivedRentals. Le regroupement « en cours »
// et « terminées » dépend de la date du jour : c'est une règle d'affichage,
// appliquée par l'appelant (R35).
//
// Les lectures (listRentals, listArchivedRentals, getRental) ne passent
// volontairement pas par runWrite : une lecture abandonnée par le pilote ne
// laisse aucun effet si Postgres la termine plus tard. Le délai du pilote leur
// suffit.
export async function listRentals(owner: Owner): Promise<Rental[]> {
  const ownerId = requireOwnerId(owner);

  return runQuery("lister", () =>
    getDb()
      .select(rentalColumns)
      .from(rental)
      .where(and(eq(rental.ownerId, ownerId), isNull(rental.archivedAt)))
      // L'identifiant départage deux locations créées au même instant : l'ordre
      // est le même d'un affichage à l'autre.
      .orderBy(asc(rental.createdAt), asc(rental.id)),
  );
}

// Les locations ARCHIVÉES de `owner`, la plus récemment archivée d'abord, avec
// pour chacune le nombre de ses quittances (R41 de la spécification 04).
export async function listArchivedRentals(
  owner: Owner,
): Promise<ArchivedRental[]> {
  const ownerId = requireOwnerId(owner);

  return runQuery("lister les archives", async () => {
    const db = getDb();
    const rows = await db
      .select({
        ...rentalColumns,
        // Sous-requête « select count(*) from receipt where rental_id = … » :
        // une valeur par ligne, sans jointure ni regroupement.
        receiptCount: db.$count(receipt, eq(receipt.rentalId, rental.id)),
      })
      .from(rental)
      .where(and(eq(rental.ownerId, ownerId), isNotNull(rental.archivedAt)))
      .orderBy(desc(rental.archivedAt), asc(rental.id));
    // Le filtre garantit une date d'archivage, mais le type de la colonne
    // l'ignore : on le lui apprend sans assertion, en écartant le cas impossible.
    return rows.flatMap((row) =>
      row.archivedAt === null ? [] : [{ ...row, archivedAt: row.archivedAt }],
    );
  });
}

// La location `rentalId` de `owner`, archivée ou non, ou null. C'est
// l'appelant qui lit `archivedAt` et applique R39 et R40 de la spécification 04.
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
// précédent. Une location archivée ne se modifie pas : "not-applicable".
export async function updateRental(
  owner: Owner,
  rentalId: string,
  values: RentalValues,
): Promise<UpdateRentalResult> {
  return updateActiveRental("modifier", owner, rentalId, pickValues(values));
}

// Fixe ou remplace la date de fin, et ne touche qu'elle (R21).
// `endDate` : « AAAA-MM-JJ », déjà validée, jamais antérieure au début du bail.
export async function setRentalEndDate(
  owner: Owner,
  rentalId: string,
  endDate: string,
): Promise<UpdateRentalResult> {
  return updateActiveRental("fixer la date de fin", owner, rentalId, { endDate });
}

// Retire la date de fin. Rouvrir une location active qui n'en a pas réussit
// aussi (R29).
export async function reopenRental(
  owner: Owner,
  rentalId: string,
): Promise<UpdateRentalResult> {
  return updateActiveRental("rouvrir", owner, rentalId, { endDate: null });
}

// Archive une location (R39, R40 de la spécification 04). Seule une location
// active et TERMINÉE s'archive : sa date de fin existe et précède strictement
// le jour de `now` à Europe/Paris. Sinon "not-applicable" : location en cours,
// ou déjà archivée (sa date d'archivage ne change pas).
//
// `now` est l'instant de la demande, lu sur l'horloge du serveur par
// l'appelant, jamais reçu du navigateur. Il donne à la fois le jour qui sert à
// la condition et la date d'archivage enregistrée : une seule horloge, pour que
// la contrainte de la base (rental_archived_only_if_ended) et la condition
// ci-dessous ne puissent pas se contredire autour de minuit.
export async function archiveRental(
  owner: Owner,
  rentalId: string,
  now: Date,
): Promise<ArchiveRentalResult> {
  const ownerId = requireOwnerId(owner);
  const archivedAt = requireInstant(now);
  const today = getTodayInParis(archivedAt);
  if (!isRentalId(rentalId)) {
    return "not-found";
  }

  return runWrite("archiver", async (tx) => {
    if ((await lockRentalForWrite(tx, ownerId, rentalId)) === null) {
      return "not-found";
    }
    const archivedRows = await tx
      .update(rental)
      // updated_at n'est pas touché : archiver n'est pas modifier.
      .set({ archivedAt })
      .where(
        and(
          ownedRental(ownerId, rentalId),
          isNull(rental.archivedAt),
          // Une date de fin absente (NULL) ne satisfait pas la comparaison :
          // une location sans date de fin n'est jamais archivée.
          lt(rental.endDate, today),
        ),
      )
      .returning({ id: rental.id });
    return archivedRows.length === 1 ? "archived" : "not-applicable";
  });
}

// Restaure une location archivée : sa date d'archivage est retirée, tout le
// reste est intact, quittances comprises (R40). Sur une location active :
// "not-applicable", rien ne change.
export async function restoreRental(
  owner: Owner,
  rentalId: string,
): Promise<RestoreRentalResult> {
  const ownerId = requireOwnerId(owner);
  if (!isRentalId(rentalId)) {
    return "not-found";
  }

  return runWrite("restaurer", async (tx) => {
    if ((await lockRentalForWrite(tx, ownerId, rentalId)) === null) {
      return "not-found";
    }
    const restoredRows = await tx
      .update(rental)
      .set({ archivedAt: null })
      .where(and(ownedRental(ownerId, rentalId), isNotNull(rental.archivedAt)))
      .returning({ id: rental.id });
    return restoredRows.length === 1 ? "restored" : "not-applicable";
  });
}

// Supprime définitivement une location : ni corbeille ni marqueur (R23 de la
// spécification 03, R19, R42 et R43 de la spécification 04). Deux cas seulement
// aboutissent :
// - une location ARCHIVÉE, effacée avec toutes ses quittances ;
// - une location ACTIVE qui n'a AUCUNE quittance.
// Une location active qui a au moins une quittance n'est pas supprimée :
// "not-applicable", et ses quittances sont intactes.
//
// Trois instructions dans une seule transaction : tout est validé ensemble, ou
// rien ne l'est.
export async function deleteRental(
  owner: Owner,
  rentalId: string,
): Promise<DeleteRentalResult> {
  const ownerId = requireOwnerId(owner);
  if (!isRentalId(rentalId)) {
    return "not-found";
  }

  return runWrite("supprimer", async (tx) => {
    // 1. Le verrou. Tant que cette transaction n'est pas terminée, aucune
    // quittance ne peut être produite pour cette location, et elle ne peut être
    // ni archivée ni restaurée (ces écritures attendent le même verrou).
    if ((await lockRentalForWrite(tx, ownerId, rentalId)) === null) {
      return "not-found";
    }

    // 2. Les quittances, seulement si la location est archivée. La condition
    // est dans la requête : pour une location active, rien n'est effacé ici.
    await tx.delete(receipt).where(
      and(
        eq(receipt.rentalId, rentalId),
        eq(receipt.ownerId, ownerId),
        exists(
          tx
            .select({ id: rental.id })
            .from(rental)
            .where(
              and(
                eq(rental.id, receipt.rentalId),
                eq(rental.ownerId, ownerId),
                isNotNull(rental.archivedAt),
              ),
            ),
        ),
      ),
    );

    // 3. La location, seulement s'il ne lui reste aucune quittance : c'est le
    // cas d'une location archivée après l'étape 2, et d'une location active qui
    // n'en a jamais eu ou n'en a plus. Si un chemin de code oubliait cette
    // condition, la clé étrangère de `receipt` ferait échouer l'effacement.
    const deletedRows = await tx
      .delete(rental)
      .where(
        and(
          ownedRental(ownerId, rentalId),
          notExists(
            tx
              .select({ id: receipt.id })
              .from(receipt)
              .where(eq(receipt.rentalId, rental.id)),
          ),
        ),
      )
      .returning({ id: rental.id });
    return deletedRows.length === 1 ? "deleted" : "not-applicable";
  });
}

// Verrouille la ligne de la location `rentalId` de `ownerId` jusqu'à la fin de
// la transaction `tx`, et rend son état à cet instant, ou null si elle n'existe
// pas pour ce propriétaire.
//
// Toute écriture qui dépend de l'état d'une location commence par cet appel
// (ici, et dans src/receipts/receipt-store.ts pour produire ou supprimer une
// quittance). Pourquoi un verrou explicite, et pas seulement une condition dans
// le WHERE de l'écriture : Postgres, à son niveau d'isolation par défaut (READ
// COMMITTED), donne à chaque instruction une photographie de la base prise à
// son début. Une suppression « s'il n'y a aucune quittance » et une production
// de quittance parties au même instant ne se verraient pas l'une l'autre. Avec
// le verrou, la seconde attend la fin de la première, et l'instruction qu'elle
// exécute ENSUITE voit ce que la première a validé.
//
// L'attente est bornée par le délai de verrou de runWriteTransaction : passé ce
// délai, Postgres annule, et rien n'est écrit.
//
// Ce n'est pas un contrôle d'accès à lui seul pour les pages : la fonction
// exige une transaction d'écriture et un identifiant de propriétaire déjà
// vérifié (requireOwnerId). Les pages lisent par getRental.
export async function lockRentalForWrite(
  tx: WriteTransaction,
  ownerId: string,
  rentalId: string,
): Promise<Rental | null> {
  const rows = await tx
    .select(rentalColumns)
    .from(rental)
    .where(ownedRental(ownerId, rentalId))
    // SELECT … FOR UPDATE : le même verrou de ligne qu'un UPDATE ou un DELETE.
    .for("update");
  return rows[0] ?? null;
}

// Les trois modifications partagent cette fonction. On ne décide rien d'après
// une lecture faite avant : la ligne est verrouillée, puis un seul UPDATE porte
// dans son WHERE l'identifiant, le propriétaire ET l'état « active ». On
// regarde ensuite combien de lignes ont été touchées. Zéro ligne alors que la
// location existe : elle est archivée, rien n'a été écrit.
async function updateActiveRental(
  operation: string,
  owner: Owner,
  rentalId: string,
  changes: Partial<RentalValues> & { endDate?: string | null },
): Promise<UpdateRentalResult> {
  const ownerId = requireOwnerId(owner);
  if (!isRentalId(rentalId)) {
    return "not-found";
  }

  return runWrite(operation, async (tx) => {
    if ((await lockRentalForWrite(tx, ownerId, rentalId)) === null) {
      return "not-found";
    }
    const updatedRows = await tx
      .update(rental)
      // now() : l'horloge de la base, comme pour created_at.
      .set({ ...changes, updatedAt: sql`now()` })
      .where(and(ownedRental(ownerId, rentalId), isNull(rental.archivedAt)))
      .returning({ id: rental.id });
    return updatedRows.length === 1 ? "updated" : "not-applicable";
  });
}

// La condition commune à toute requête qui vise une location : c'est elle qui
// rend indiscernables « pas à moi » et « n'existe pas ».
function ownedRental(ownerId: string, rentalId: string) {
  return and(eq(rental.id, rentalId), eq(rental.ownerId, ownerId));
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

// Exécute une écriture de telle sorte qu'elle ne puisse pas aboutir après avoir
// été déclarée en échec (R31 : « une action qui échoue n'écrit rien »).
//
// Le problème : le délai du pilote n'annule rien dans Postgres. Une écriture
// qui attend un verrou plus de cinq secondes est abandonnée par le pilote,
// l'utilisateur voit le message de panne, puis Postgres l'exécute quand même
// dès que le verrou est levé.
//
// La solution est dans runWriteTransaction (src/db/index.ts) : l'écriture a
// lieu dans une transaction où Postgres annule lui-même ce qui attend trop
// longtemps, et rien n'est définitif avant COMMIT. L'erreur d'annulation
// devient une RentalStoreError comme toute autre erreur de base.
//
// Ne pas remplacer cet appel par `getDb().transaction(…)` : voir pourquoi
// au-dessus de runWriteTransaction.
async function runWrite<Result>(
  operation: string,
  write: (tx: WriteTransaction) => Promise<Result>,
): Promise<Result> {
  return runQuery(operation, () => runWriteTransaction(write));
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
