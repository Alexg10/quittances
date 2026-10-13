// Accès aux données des quittances (R6, R15, R18, R21 à R23 de la
// spécification 04).
//
// Ce module est le SEUL endroit où une quittance est lue ou écrite (à une
// exception près : la suppression définitive d'une location efface ses
// quittances, dans src/rentals/rental-store.ts). Mêmes règles que pour les
// locations :
//
// 1. Chaque fonction reçoit le propriétaire en premier argument et place
//    `owner_id = …` dans le WHERE de sa requête. Une quittance porte elle-même
//    l'identifiant de son propriétaire, et la base garantit qu'il est celui de
//    sa location (clé étrangère sur le couple location et propriétaire, voir
//    src/db/schema.ts) : filtrer sur receipt.owner_id, c'est filtrer sur le
//    propriétaire de la location, dans la même requête.
// 2. « Pas à moi », « n'existe pas », « supprimée » et « identifiant mal formé »
//    donnent le même résultat (R22). Un identifiant qui n'a pas la forme
//    canonique ne part jamais en requête.
// 3. Une erreur de base ne transporte ni SQL ni donnée personnelle (R37).
// 4. Toute écriture passe par runWriteTransaction, et commence par verrouiller
//    la ligne de la location concernée (lockRentalForWrite) : produire une
//    quittance, supprimer une quittance, archiver, restaurer et supprimer une
//    location s'exécutent donc l'un après l'autre pour une même location.
import "server-only";

import { and, count, desc, eq, exists, isNull, lte, ne, or } from "drizzle-orm";

// `import type` : seuls les types sont importés, ils disparaissent à la
// compilation.
import type { Owner } from "../auth/current-owner";
import { getDb, runWriteTransaction, type WriteTransaction } from "../db";
import { requireInstant } from "../db/require-instant";
import { requireOwnerId } from "../db/require-owner-id";
import { receipt, rental, user } from "../db/schema";
import { isValidRecipient } from "../email/email-header";
// La forme d'un identifiant est la même pour une location et pour une
// quittance (R6 de la spécification 03, R22 de la 04) : UUID canonique.
import { isRentalId as isCanonicalId } from "../rentals/rental-id";
import { lockRentalForWrite } from "../rentals/rental-store";
import { readLandlordWith } from "./landlord-store";
import { isDisplayableText } from "./receipt-displayable";
import { getReceiptIssueDate } from "./receipt-issue-date";
import { getReceiptPeriod, isMonth, isMonthAccepted } from "./receipt-months";
import {
  isSendingInProgress,
  SENDING_STALE_AFTER_IN_MS,
  type ReceiptSendingColumns,
} from "./receipt-sending-state";
import type { ReceiptSnapshot } from "./receipt-snapshot";

// Une quittance telle que le reste de l'application la voit : ses valeurs
// figées (exactement ce que renderReceiptPdf attend), plus sa location et
// l'instant de sa production. L'identifiant du propriétaire n'en fait pas
// partie.
//
// Elle porte aussi la trace d'envoi par e-mail (R15 de la spécification 05) : la
// seule partie qui change après la production. getReceiptSendingStatus en tire
// ce que le propriétaire voit.
export type Receipt = ReceiptSnapshot &
  ReceiptSendingColumns & {
    rentalId: string;
    // Sert de date de création du PDF (R30) : `renderReceiptPdf(receipt, receipt.producedAt)`.
    producedAt: Date;
  };

// Ce que le propriétaire saisit pour produire une quittance (R12, R13), déjà
// validé par l'appelant (validateReceiptForm). Tout le reste (noms, adresses,
// période, date d'émission) est lu en base ou calculé ici : aucun champ de la
// requête ne peut le fournir (R6).
export type ReceiptInput = {
  // « AAAA-MM ».
  month: string;
  // Centimes entiers.
  rentInCents: number;
  chargesInCents: number;
  // « AAAA-MM-JJ », jamais postérieure au jour de la production à Paris.
  paymentDate: string;
};

// Les cinq résultats de R23, et trois refus de plus que seule la relecture en
// base peut constater : la location ou les informations du bailleur ont pu
// changer entre l'affichage du formulaire et son envoi. Dans tous les cas sauf
// "produced", rien n'a été écrit.
export type ProduceReceiptResult =
  | { status: "produced"; receipt: Receipt }
  // Sans distinction : location d'un autre compte, inexistante, supprimée,
  // identifiant mal formé (R5 de la spécification 03).
  | { status: "rental-not-found" }
  // État inapplicable de R40 : seulement pour le propriétaire de la location.
  | { status: "rental-archived" }
  // Message Q7.
  | { status: "landlord-missing" }
  // Le mois n'est pas accepté par R8 pour les dates du bail lues en base
  // (message Q2), ou n'a pas la forme « AAAA-MM » (message Q1).
  | { status: "month-not-accepted" }
  // R17 : message Q8, puis message Q9.
  | { status: "rental-not-displayable" }
  | { status: "landlord-not-displayable" }
  // R15 : ce mois a déjà sa quittance (message Q3). Elle est intacte.
  | { status: "already-exists" };

// "not-applicable" : la quittance existe et appartient au propriétaire, mais sa
// location est archivée (R18, R39). "sending-in-progress" : un envoi par e-mail
// est en cours depuis moins de deux minutes, la quittance n'est pas supprimée
// (R13 de la spécification 05). "not-found" : tout le reste (R22).
export type DeleteReceiptResult =
  | "deleted"
  | "not-found"
  | "not-applicable"
  | "sending-in-progress";

// Résultat de la réservation d'un envoi (R6, temps 1, de la spécification 05).
// Les refus sont ceux de R3, dans l'ordre des contrôles ; dans tous les cas
// sauf "reserved", rien n'a été écrit.
export type ReserveSendingResult =
  | {
      status: "reserved";
      // La quittance relue sous le verrou : ses valeurs figées servent au
      // temps 2, qui ne relit rien sous verrou.
      receipt: Receipt;
      // L'adresse du locataire, relue en base (R4) : le temps 2 n'en connaît pas
      // d'autre.
      recipient: string;
      // L'adresse du compte, relue en base (R21) : adresse de réponse.
      ownerEmail: string;
    }
  | { status: "receipt-not-found" }
  | { status: "rental-archived" }
  | { status: "consent-missing" }
  | { status: "recipient-refused" }
  | { status: "not-configured" }
  | { status: "sending-in-progress" };

// Erreur levée quand une requête échoue. Comme RentalStoreError : ni le texte
// de la requête, ni ses paramètres (nom et adresse du bailleur, nom du
// locataire), ni `cause`. Seuls le nom de l'opération et le type de l'erreur.
export class ReceiptStoreError extends Error {
  constructor(operation: string, originalError: unknown) {
    const kind =
      originalError instanceof Error ? originalError.name : typeof originalError;
    super(`Quittances : échec de l'opération « ${operation} » (${kind})`);
    this.name = "ReceiptStoreError";
  }
}

// Colonnes rendues à l'appelant : toutes, sauf owner_id.
const receiptColumns = {
  id: receipt.id,
  rentalId: receipt.rentalId,
  month: receipt.month,
  periodStart: receipt.periodStart,
  periodEnd: receipt.periodEnd,
  landlordName: receipt.landlordName,
  landlordAddress: receipt.landlordAddress,
  landlordAddressComplement: receipt.landlordAddressComplement,
  landlordPostalCode: receipt.landlordPostalCode,
  landlordCity: receipt.landlordCity,
  tenantName: receipt.tenantName,
  rentalAddress: receipt.rentalAddress,
  rentalAddressComplement: receipt.rentalAddressComplement,
  rentalPostalCode: receipt.rentalPostalCode,
  rentalCity: receipt.rentalCity,
  rentInCents: receipt.rentInCents,
  chargesInCents: receipt.chargesInCents,
  paymentDate: receipt.paymentDate,
  issueDate: receipt.issueDate,
  producedAt: receipt.producedAt,
  emailSendState: receipt.emailSendState,
  emailSendStartedAt: receipt.emailSendStartedAt,
  emailSentAt: receipt.emailSentAt,
  emailSentTo: receipt.emailSentTo,
};

// Produit la quittance du mois `input.month` pour la location `rentalId` de
// `owner` (R6). `now` est l'instant de la production, lu sur l'horloge du
// serveur par l'appelant : il donne la date d'émission (le jour à Paris) et
// l'instant de production enregistré.
//
// Une seule transaction, dans cet ordre (celui de R26) :
// 1. verrouiller et relire la location de ce propriétaire ;
// 2. refuser si elle est archivée ;
// 3. relire les informations du bailleur ;
// 4. recontrôler le mois avec les dates du bail qui viennent d'être relues ;
// 5. recontrôler que les textes à figer sont affichables (R17) ;
// 6. insérer la quittance avec les valeurs relues.
//
// Le verrou de l'étape 1 est ce qui rend l'ensemble atomique : jusqu'au COMMIT,
// la location ne peut être ni modifiée, ni archivée, ni supprimée. Les
// contrôles des étapes 2 à 5 portent donc sur l'état qui sera encore vrai à
// l'instant de l'insertion, et non sur ce que la page avait affiché.
export async function produceReceipt(
  owner: Owner,
  rentalId: string,
  input: ReceiptInput,
  now: Date,
): Promise<ProduceReceiptResult> {
  const ownerId = requireOwnerId(owner);
  const producedAt = requireInstant(now);
  if (!isCanonicalId(rentalId)) {
    return { status: "rental-not-found" };
  }

  return runWrite("produire", async (tx) => {
    const lockedRental = await lockRentalForWrite(tx, ownerId, rentalId);
    if (lockedRental === null) {
      return { status: "rental-not-found" };
    }
    if (lockedRental.archivedAt !== null) {
      return { status: "rental-archived" };
    }

    const landlord = await readLandlordWith(tx, ownerId);
    if (landlord === null) {
      return { status: "landlord-missing" };
    }

    const { startDate, endDate } = lockedRental;
    if (
      !isMonth(input.month) ||
      !isMonthAccepted(input.month, startDate, endDate, producedAt)
    ) {
      return { status: "month-not-accepted" };
    }

    // Le code postal n'est fait que de chiffres : il est toujours affichable.
    const rentalTexts = [
      lockedRental.tenantName,
      lockedRental.address,
      lockedRental.addressComplement ?? "",
      lockedRental.city,
    ];
    if (!rentalTexts.every(isDisplayableText)) {
      return { status: "rental-not-displayable" };
    }
    const landlordTexts = [
      landlord.name,
      landlord.address,
      landlord.addressComplement ?? "",
      landlord.city,
    ];
    if (!landlordTexts.every(isDisplayableText)) {
      return { status: "landlord-not-displayable" };
    }

    const period = getReceiptPeriod(input.month, startDate, endDate);
    const producedRows = await tx
      .insert(receipt)
      .values({
        // Le propriétaire vient de la session, la location de la ligne relue.
        ownerId,
        rentalId: lockedRental.id,
        month: input.month,
        periodStart: period.start,
        periodEnd: period.end,
        landlordName: landlord.name,
        landlordAddress: landlord.address,
        landlordAddressComplement: landlord.addressComplement,
        landlordPostalCode: landlord.postalCode,
        landlordCity: landlord.city,
        tenantName: lockedRental.tenantName,
        rentalAddress: lockedRental.address,
        rentalAddressComplement: lockedRental.addressComplement,
        rentalPostalCode: lockedRental.postalCode,
        rentalCity: lockedRental.city,
        // Les montants saisis, pas ceux de la location (R12).
        rentInCents: input.rentInCents,
        chargesInCents: input.chargesInCents,
        paymentDate: input.paymentDate,
        issueDate: getReceiptIssueDate(producedAt),
        producedAt,
      })
      // R15 : c'est la contrainte d'unicité de la base qui tranche, pas une
      // lecture faite avant. Si le mois a déjà sa quittance, l'insertion
      // n'écrit rien et ne rend aucune ligne, sans lever d'erreur.
      .onConflictDoNothing({ target: [receipt.rentalId, receipt.month] })
      .returning(receiptColumns);
    return producedRows.length === 1
      ? { status: "produced", receipt: producedRows[0] }
      : { status: "already-exists" };
  });
}

// Les quittances de la location `rentalId` de `owner`, mois le plus récent
// d'abord (R23). Au plus une par mois : pas de pagination. Pour la location
// d'un autre compte, inexistante ou mal formée : une liste vide. C'est
// l'appelant qui répond « Location introuvable », d'après getRental.
//
// Les lectures ne passent pas par une transaction d'écriture : une lecture
// abandonnée par le pilote ne laisse aucun effet.
export async function listReceipts(
  owner: Owner,
  rentalId: string,
): Promise<Receipt[]> {
  const ownerId = requireOwnerId(owner);
  if (!isCanonicalId(rentalId)) {
    return [];
  }

  return runQuery("lister", () =>
    getDb()
      .select(receiptColumns)
      .from(receipt)
      .where(ownedReceiptsOfRental(ownerId, rentalId))
      // « AAAA-MM » se trie comme du texte.
      .orderBy(desc(receipt.month)),
  );
}

// Le nombre de quittances de la location `rentalId` de `owner` : 0 pour la
// location d'un autre compte, inexistante ou mal formée.
export async function countReceipts(
  owner: Owner,
  rentalId: string,
): Promise<number> {
  const ownerId = requireOwnerId(owner);
  if (!isCanonicalId(rentalId)) {
    return 0;
  }

  return runQuery("compter", async () => {
    const [{ total }] = await getDb()
      .select({ total: count() })
      .from(receipt)
      .where(ownedReceiptsOfRental(ownerId, rentalId));
    return total;
  });
}

// La quittance `receiptId` de `owner`, que sa location soit archivée ou non, ou
// null (R22) : une seule lecture, filtrée sur l'identifiant ET le propriétaire.
export async function getReceipt(
  owner: Owner,
  receiptId: string,
): Promise<Receipt | null> {
  const ownerId = requireOwnerId(owner);
  if (!isCanonicalId(receiptId)) {
    return null;
  }

  return runQuery("lire", async () => {
    const rows = await getDb()
      .select(receiptColumns)
      .from(receipt)
      .where(ownedReceipt(ownerId, receiptId));
    return rows[0] ?? null;
  });
}

// Supprime réellement la quittance `receiptId` de `owner` : ni marqueur ni
// trace (R18). Refusé si sa location est archivée ("not-applicable", R39), ou si
// un envoi par e-mail est en cours depuis moins de deux minutes
// ("sending-in-progress", R13 de la spécification 05) : supprimer pendant
// l'envoi laisserait partir un message dont plus rien ne garde la trace.
// `now` est l'instant présent, lu sur l'horloge par l'appelant ; il sert à
// savoir si l'envoi est vivant ou périmé.
export async function deleteReceipt(
  owner: Owner,
  receiptId: string,
  now: Date = new Date(),
): Promise<DeleteReceiptResult> {
  const ownerId = requireOwnerId(owner);
  const instant = requireInstant(now);
  if (!isCanonicalId(receiptId)) {
    return "not-found";
  }
  // Un envoi commencé avant cet instant est périmé (R9).
  const staleBefore = new Date(instant.getTime() - SENDING_STALE_AFTER_IN_MS);

  return runWrite("supprimer", async (tx) => {
    // 1. De quelle location s'agit-il ? Cette lecture ne décide de rien d'autre :
    // la location d'une quittance ne change jamais.
    const found = await tx
      .select({ rentalId: receipt.rentalId })
      .from(receipt)
      .where(ownedReceipt(ownerId, receiptId));
    if (found.length === 0) {
      return "not-found";
    }

    // 2. Le verrou sur la location : ni archivage ni suppression définitive ne
    // peuvent se glisser avant la fin de cette transaction. Un envoi ne peut
    // pas non plus être réservé (R6, temps 1) : l'état « en cours » lu plus bas
    // ne peut que se périmer ou se terminer.
    const lockedRental = await lockRentalForWrite(tx, ownerId, found[0].rentalId);
    if (lockedRental === null) {
      // Supprimée avec ses quittances pendant qu'on attendait le verrou.
      return "not-found";
    }

    // 3. L'effacement porte lui-même les conditions « location active » et
    // « pas d'envoi vivant ».
    const deletedRows = await tx
      .delete(receipt)
      .where(
        and(
          ownedReceipt(ownerId, receiptId),
          or(
            isNull(receipt.emailSendState),
            ne(receipt.emailSendState, "sending"),
            // Envoi périmé (R9) : commencé il y a deux minutes ou plus. L'état
            // « en cours » a toujours un début (contrainte de la base).
            lte(receipt.emailSendStartedAt, staleBefore),
          ),
          exists(
            tx
              .select({ id: rental.id })
              .from(rental)
              .where(
                and(
                  eq(rental.id, receipt.rentalId),
                  eq(rental.ownerId, ownerId),
                  isNull(rental.archivedAt),
                ),
              ),
          ),
        ),
      )
      .returning({ id: receipt.id });
    if (deletedRows.length === 1) {
      return "deleted";
    }
    // 4. Rien n'a été effacé. Trois causes possibles : location archivée,
    // envoi vivant, ou quittance déjà supprimée par une autre requête.
    if (lockedRental.archivedAt !== null) {
      return "not-applicable";
    }
    const remaining = await tx
      .select({ id: receipt.id })
      .from(receipt)
      .where(ownedReceipt(ownerId, receiptId));
    return remaining.length === 1 ? "sending-in-progress" : "not-found";
  });
}

// Temps 1 de l'envoi d'une quittance (R3 et R6 de la spécification 05) : sous le
// verrou de la location, relire l'état, vérifier les conditions DANS L'ORDRE de
// R3, puis marquer la quittance « envoi en cours » avec l'instant `now`.
// `isConfigured` dit si un transport est configuré (R20) : il vient de
// l'environnement, pas de la base, mais son contrôle a sa place dans l'ordre.
//
// La transaction se termine ici : le verrou est relâché avant le moindre rendu
// de PDF ou appel au transport (R6).
export async function reserveReceiptSending(
  owner: Owner,
  receiptId: string,
  now: Date,
  isConfigured: boolean,
): Promise<ReserveSendingResult> {
  const ownerId = requireOwnerId(owner);
  const startedAt = requireInstant(now);
  if (!isCanonicalId(receiptId)) {
    return { status: "receipt-not-found" };
  }

  return runWrite("réserver l'envoi", async (tx) => {
    // 1. De quelle location s'agit-il ? (Comme deleteReceipt.)
    const found = await tx
      .select({ rentalId: receipt.rentalId })
      .from(receipt)
      .where(ownedReceipt(ownerId, receiptId));
    if (found.length === 0) {
      return { status: "receipt-not-found" };
    }

    // 2. Le verrou de la location, puis la relecture de la quittance : l'état
    // d'envoi lu AVANT le verrou pourrait être celui d'un envoi qui vient de se
    // réserver. Deux envois simultanés se suivent ici : le second voit « en
    // cours » et s'arrête (R8).
    const lockedRental = await lockRentalForWrite(tx, ownerId, found[0].rentalId);
    const rows = await tx
      .select(receiptColumns)
      .from(receipt)
      .where(ownedReceipt(ownerId, receiptId));
    const current = rows[0];
    if (lockedRental === null || current === undefined) {
      return { status: "receipt-not-found" };
    }
    // L'adresse du compte, relue en base (R21). Un compte supprimé n'a plus de
    // quittance : cette ligne existe donc.
    const ownerRows = await tx
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, ownerId));
    if (ownerRows.length === 0) {
      return { status: "receipt-not-found" };
    }

    // 3. Les contrôles de R3, dans l'ordre. L'appartenance est déjà acquise
    // (R25) : tout ce qui suit ne concerne que le propriétaire.
    if (lockedRental.archivedAt !== null) {
      return { status: "rental-archived" };
    }
    if (lockedRental.emailConsentAt === null) {
      return { status: "consent-missing" };
    }
    if (!isValidRecipient(lockedRental.tenantEmail)) {
      return { status: "recipient-refused" };
    }
    if (!isConfigured) {
      return { status: "not-configured" };
    }
    if (isSendingInProgress(current, startedAt)) {
      return { status: "sending-in-progress" };
    }

    // 4. La réservation. Un envoi « en cours » périmé, ou « échoué », est écrasé.
    // Date et adresse du dernier envoi réussi ne sont pas touchées (R11).
    await tx
      .update(receipt)
      .set({ emailSendState: "sending", emailSendStartedAt: startedAt })
      .where(ownedReceipt(ownerId, receiptId));
    return {
      status: "reserved",
      receipt: {
        ...current,
        emailSendState: "sending",
        emailSendStartedAt: startedAt,
      },
      recipient: lockedRental.tenantEmail,
      ownerEmail: ownerRows[0].email,
    };
  });
}

// Temps 3 de l'envoi, cas du succès (R6 et R15 de la spécification 05) : le
// message est parti. Une seule instruction, qui ne vise que la quittance encore
// « en cours » pour CE début d'envoi : si elle a été supprimée, ou si un autre
// envoi l'a reprise depuis, rien n'est écrit. Pas de verrou de location : une
// location archivée pendant l'envoi n'empêche pas de dire que le message est
// parti (R14).
//
// Rend vrai si la trace est enregistrée.
export async function recordReceiptSent(
  owner: Owner,
  receiptId: string,
  startedAt: Date,
  recipient: string,
  sentAt: Date,
): Promise<boolean> {
  const ownerId = requireOwnerId(owner);
  requireInstant(startedAt);
  requireInstant(sentAt);
  if (!isCanonicalId(receiptId)) {
    return false;
  }

  return runWrite("enregistrer l'envoi", async (tx) => {
    const rows = await tx
      .update(receipt)
      .set({
        emailSendState: null,
        emailSendStartedAt: null,
        emailSentAt: sentAt,
        emailSentTo: recipient,
      })
      .where(stillSending(ownerId, receiptId, startedAt))
      .returning({ id: receipt.id });
    return rows.length === 1;
  });
}

// Temps 3 de l'envoi, cas de l'échec : l'état passe à « échec », l'instant de
// début est gardé (c'est la date de l'échec affichée). Mêmes conditions que
// recordReceiptSent. La trace du dernier envoi réussi n'est pas touchée (R11).
export async function recordReceiptSendFailed(
  owner: Owner,
  receiptId: string,
  startedAt: Date,
): Promise<boolean> {
  const ownerId = requireOwnerId(owner);
  requireInstant(startedAt);
  if (!isCanonicalId(receiptId)) {
    return false;
  }

  return runWrite("enregistrer l'échec de l'envoi", async (tx) => {
    const rows = await tx
      .update(receipt)
      .set({ emailSendState: "failed" })
      .where(stillSending(ownerId, receiptId, startedAt))
      .returning({ id: receipt.id });
    return rows.length === 1;
  });
}

// La quittance, encore « en cours » pour ce même début d'envoi (R6, temps 3).
function stillSending(ownerId: string, receiptId: string, startedAt: Date) {
  return and(
    ownedReceipt(ownerId, receiptId),
    eq(receipt.emailSendState, "sending"),
    eq(receipt.emailSendStartedAt, startedAt),
  );
}

// Les deux conditions communes : elles rendent indiscernables « pas à moi » et
// « n'existe pas ».
function ownedReceipt(ownerId: string, receiptId: string) {
  return and(eq(receipt.id, receiptId), eq(receipt.ownerId, ownerId));
}

function ownedReceiptsOfRental(ownerId: string, rentalId: string) {
  return and(eq(receipt.rentalId, rentalId), eq(receipt.ownerId, ownerId));
}

// Exécute une écriture dans une transaction dont Postgres tient lui-même les
// délais : une écriture déclarée en échec ne s'exécute jamais plus tard (voir
// runWriteTransaction dans src/db/index.ts).
async function runWrite<Result>(
  operation: string,
  write: (tx: WriteTransaction) => Promise<Result>,
): Promise<Result> {
  return runQuery(operation, () => runWriteTransaction(write));
}

// Exécute une requête et remplace toute erreur par une ReceiptStoreError, qui
// ne contient aucune donnée.
async function runQuery<Result>(
  operation: string,
  query: () => Promise<Result>,
): Promise<Result> {
  try {
    return await query();
  } catch (error) {
    throw new ReceiptStoreError(operation, error);
  }
}
