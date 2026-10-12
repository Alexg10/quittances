// Tests d'intégration des écritures simultanées sur une même location (R15,
// R40 et R43 de la spécification 04, CA56), contre la base de test. Lancés par
// `pnpm test:integration`.
//
// Ce qui tranche chaque course : le verrou de ligne que toute écriture prend
// sur la location avant d'agir (lockRentalForWrite). Les deux écritures
// s'exécutent l'une après l'autre, et la seconde décide d'après ce que la
// première a validé.
//
// Pour que les deux écritures soient réellement en attente au même moment, une
// troisième connexion tient d'abord le verrou de la ligne : les deux partent,
// attendent, puis sont libérées ensemble. Chaque course est jouée dans les deux
// ordres de départ. On n'affirme pas laquelle gagne (Postgres en décide) : on
// affirme que le résultat est l'un des deux états cohérents, jamais un mélange.

import { afterAll, describe, expect, it } from "vitest";

import type { Owner } from "../auth/current-owner";
import { closeDb } from "../db";
import {
  archiveRental,
  deleteRental,
  restoreRental,
  setRentalEndDate,
} from "../rentals/rental-store";
import {
  createOwnerWithLandlord,
  type CreatedEmails,
  insertRental,
  LE_12_OCTOBRE,
  produceFor,
  purgeOwners,
  readReceiptRows,
  readRentalRow,
  receiptInput,
  wait,
  whileRowIsLocked,
} from "../test-support/store-fixtures";
import { deleteReceipt, produceReceipt } from "./receipt-store";

// Temps laissé à une écriture pour atteindre Postgres et se mettre en attente
// du verrou. Deux attentes : bien moins que le délai de verrou (3 s).
const TIME_TO_QUEUE_IN_MS = 400;

const createdEmails: CreatedEmails = [];

afterAll(async () => {
  await purgeOwners(createdEmails);
  await closeDb();
});

// Lance `first` puis `second` pendant que la ligne de la location est
// verrouillée par une autre connexion, lève le verrou, et rend leurs résultats.
async function race<First, Second>(
  rentalId: string,
  first: () => Promise<First>,
  second: () => Promise<Second>,
): Promise<[First, Second]> {
  // Enveloppé dans un objet : une fonction async qui rendrait la promesse
  // elle-même l'attendrait, verrou tenu, et rien ne se terminerait.
  const pending = await whileRowIsLocked("rental", rentalId, async () => {
    const firstResult = first();
    await wait(TIME_TO_QUEUE_IN_MS);
    const secondResult = second();
    await wait(TIME_TO_QUEUE_IN_MS);
    return { both: Promise.all([firstResult, secondResult]) };
  });
  return pending.both;
}

const produce = (owner: Owner, rentalId: string, month: string) =>
  produceReceipt(
    owner,
    rentalId,
    receiptInput({ month, paymentDate: `${month}-20` }),
    LE_12_OCTOBRE,
  );

// Les cas se suivent, sans `describe.concurrent` : chacun occupe deux connexions
// du pool pendant qu'il attend, et les lancer tous à la fois ferait attendre
// une connexion plutôt que le verrou.
describe("Courses entre deux écritures sur la même location", () => {
  // --- Production et suppression directe (R43, CA56) --------------------------

  // L'état final est l'un des deux seuls états cohérents : jamais une quittance
  // perdue, jamais une suppression « réussie » d'une location qui a une quittance.
  async function expectProductionOrDeletion(
    rentalId: string,
    produced: Awaited<ReturnType<typeof produce>>,
    deleted: Awaited<ReturnType<typeof deleteRental>>,
  ) {
    const rentalRow = await readRentalRow(rentalId);
    const receiptRows = await readReceiptRows(rentalId);
    if (deleted === "deleted") {
      // La location n'existe plus, et la production a répondu « introuvable ».
      expect(produced).toEqual({ status: "rental-not-found" });
      expect(rentalRow).toBeUndefined();
      expect(receiptRows).toEqual([]);
    } else {
      // La quittance est produite, et la suppression est sans effet.
      expect(deleted).toBe("not-applicable");
      expect(produced.status).toBe("produced");
      expect(rentalRow).toBeDefined();
      expect(receiptRows).toHaveLength(1);
    }
  }

  it("production puis suppression directe : exactement l'une des deux aboutit", async () => {
    const owner = await createOwnerWithLandlord("course-prod-suppr", createdEmails);
    const rentalId = await insertRental(owner, { endDate: "2026-03-20" });

    const [produced, deleted] = await race(
      rentalId,
      () => produce(owner, rentalId, "2026-01"),
      () => deleteRental(owner, rentalId),
    );

    await expectProductionOrDeletion(rentalId, produced, deleted);
  });

  it("suppression directe puis production : exactement l'une des deux aboutit", async () => {
    const owner = await createOwnerWithLandlord("course-suppr-prod", createdEmails);
    const rentalId = await insertRental(owner, { endDate: "2026-03-20" });

    const [deleted, produced] = await race(
      rentalId,
      () => deleteRental(owner, rentalId),
      () => produce(owner, rentalId, "2026-01"),
    );

    await expectProductionOrDeletion(rentalId, produced, deleted);
  });

  it("production et suppression directe parties au même instant, sans verrou préalable, dix fois de suite", async () => {
    const owner = await createOwnerWithLandlord("course-instant", createdEmails);

    for (let round = 0; round < 10; round += 1) {
      const rentalId = await insertRental(owner, { endDate: "2026-03-20" });

      const [produced, deleted] = await Promise.all([
        produce(owner, rentalId, "2026-01"),
        deleteRental(owner, rentalId),
      ]);

      await expectProductionOrDeletion(rentalId, produced, deleted);
    }
  });

  // --- Production et archivage (R39, R40) ------------------------------------

  // L'archivage aboutit toujours (la location est terminée). La production ne
  // peut qu'avoir eu lieu avant lui, ou être refusée : jamais une quittance
  // ajoutée à une location déjà archivée.
  async function expectProductionBeforeArchiveOrRefused(
    rentalId: string,
    produced: Awaited<ReturnType<typeof produce>>,
    archived: Awaited<ReturnType<typeof archiveRental>>,
  ) {
    expect(archived).toBe("archived");
    expect((await readRentalRow(rentalId)).archivedAt).toEqual(LE_12_OCTOBRE);
    const receiptRows = await readReceiptRows(rentalId);
    if (produced.status === "produced") {
      expect(receiptRows).toHaveLength(1);
    } else {
      expect(produced).toEqual({ status: "rental-archived" });
      expect(receiptRows).toEqual([]);
    }
  }

  it("production puis archivage : la quittance est produite avant l'archivage, ou refusée", async () => {
    const owner = await createOwnerWithLandlord("course-prod-arch", createdEmails);
    const rentalId = await insertRental(owner, { endDate: "2026-03-20" });

    const [produced, archived] = await race(
      rentalId,
      () => produce(owner, rentalId, "2026-01"),
      () => archiveRental(owner, rentalId, LE_12_OCTOBRE),
    );

    await expectProductionBeforeArchiveOrRefused(rentalId, produced, archived);
  });

  it("archivage puis production : la quittance est produite avant l'archivage, ou refusée", async () => {
    const owner = await createOwnerWithLandlord("course-arch-prod", createdEmails);
    const rentalId = await insertRental(owner, { endDate: "2026-03-20" });

    const [archived, produced] = await race(
      rentalId,
      () => archiveRental(owner, rentalId, LE_12_OCTOBRE),
      () => produce(owner, rentalId, "2026-01"),
    );

    await expectProductionBeforeArchiveOrRefused(rentalId, produced, archived);
  });

  // --- Deux archivages -------------------------------------------------------

  it("deux archivages : un seul archive, et la date d'archivage est la sienne", async () => {
    const owner = await createOwnerWithLandlord("course-deux-arch", createdEmails);
    const rentalId = await insertRental(owner, { endDate: "2026-03-20" });
    const firstInstant = new Date("2026-10-12T10:00:00Z");
    const secondInstant = new Date("2026-10-12T10:00:05Z");

    const [first, second] = await race(
      rentalId,
      () => archiveRental(owner, rentalId, firstInstant),
      () => archiveRental(owner, rentalId, secondInstant),
    );

    expect([first, second].sort()).toEqual(["archived", "not-applicable"]);
    // Le second envoi n'a pas déplacé la date d'archivage (R40).
    expect((await readRentalRow(rentalId)).archivedAt).toEqual(
      first === "archived" ? firstInstant : secondInstant,
    );
  });

  // --- Restauration et suppression définitive (R40) ---------------------------

  // Jamais une location restaurée qui aurait perdu ses quittances.
  async function expectRestoredOrDeleted(
    rentalId: string,
    restored: Awaited<ReturnType<typeof restoreRental>>,
    deleted: Awaited<ReturnType<typeof deleteRental>>,
  ) {
    const rentalRow = await readRentalRow(rentalId);
    const receiptRows = await readReceiptRows(rentalId);
    if (deleted === "deleted") {
      // Supprimée avec ses quittances : la restauration ne trouve plus rien.
      expect(restored).toBe("not-found");
      expect(rentalRow).toBeUndefined();
      expect(receiptRows).toEqual([]);
    } else {
      // Restaurée d'abord : active, avec ses deux quittances, elle ne se
      // supprime plus directement.
      expect(deleted).toBe("not-applicable");
      expect(restored).toBe("restored");
      expect(rentalRow.archivedAt).toBeNull();
      expect(receiptRows).toHaveLength(2);
    }
  }

  async function prepareArchivedWithTwoReceipts(prefix: string) {
    const owner = await createOwnerWithLandlord(prefix, createdEmails);
    const rentalId = await insertRental(owner, { endDate: "2026-03-20" });
    await produceFor(owner, rentalId, "2026-01");
    await produceFor(owner, rentalId, "2026-02");
    expect(await archiveRental(owner, rentalId, LE_12_OCTOBRE)).toBe("archived");
    return { owner, rentalId };
  }

  it("restauration puis suppression définitive : tout est restauré, ou tout est supprimé", async () => {
    const { owner, rentalId } = await prepareArchivedWithTwoReceipts("course-rest-suppr");

    const [restored, deleted] = await race(
      rentalId,
      () => restoreRental(owner, rentalId),
      () => deleteRental(owner, rentalId),
    );

    await expectRestoredOrDeleted(rentalId, restored, deleted);
  });

  it("suppression définitive puis restauration : tout est restauré, ou tout est supprimé", async () => {
    const { owner, rentalId } = await prepareArchivedWithTwoReceipts("course-suppr-rest");

    const [deleted, restored] = await race(
      rentalId,
      () => deleteRental(owner, rentalId),
      () => restoreRental(owner, rentalId),
    );

    await expectRestoredOrDeleted(rentalId, restored, deleted);
  });

  // --- Suppression d'une quittance et archivage (R18, R39) --------------------

  it("suppression d'une quittance et archivage : supprimée avant l'archivage, ou refusée", async () => {
    const owner = await createOwnerWithLandlord("course-quitt-arch", createdEmails);
    const rentalId = await insertRental(owner, { endDate: "2026-03-20" });
    const receipt = await produceFor(owner, rentalId, "2026-01");

    const [archived, deleted] = await race(
      rentalId,
      () => archiveRental(owner, rentalId, LE_12_OCTOBRE),
      () => deleteReceipt(owner, receipt.id),
    );

    expect(archived).toBe("archived");
    const receiptRows = await readReceiptRows(rentalId);
    if (deleted === "deleted") {
      expect(receiptRows).toEqual([]);
    } else {
      expect(deleted).toBe("not-applicable");
      expect(receiptRows).toHaveLength(1);
    }
  });

  it("deux suppressions de la même quittance : une seule supprime, l'autre répond « introuvable »", async () => {
    const owner = await createOwnerWithLandlord("course-deux-quitt", createdEmails);
    const rentalId = await insertRental(owner, { endDate: "2026-03-20" });
    const receipt = await produceFor(owner, rentalId, "2026-01");
    const kept = await produceFor(owner, rentalId, "2026-02");

    const results = await race(
      rentalId,
      () => deleteReceipt(owner, receipt.id),
      () => deleteReceipt(owner, receipt.id),
    );

    expect([...results].sort()).toEqual(["deleted", "not-found"]);
    expect((await readReceiptRows(rentalId)).map((row) => row.id)).toEqual([kept.id]);
  });

  // --- Production et modification de la location (R6, R8) ---------------------

  it("production de mars et fin de bail fixée en février : produite avec la période entière, ou refusée pour ce mois", async () => {
    const owner = await createOwnerWithLandlord("course-prod-fin", createdEmails);
    const rentalId = await insertRental(owner, { endDate: null });

    const [produced, ended] = await race(
      rentalId,
      () => produce(owner, rentalId, "2026-03"),
      () => setRentalEndDate(owner, rentalId, "2026-02-10"),
    );

    expect(ended).toBe("updated");
    const receiptRows = await readReceiptRows(rentalId);
    if (produced.status === "produced") {
      // La location n'avait pas encore de date de fin : mars entier.
      expect(receiptRows).toMatchObject([
        { month: "2026-03", periodStart: "2026-03-01", periodEnd: "2026-03-31" },
      ]);
    } else {
      // La fin du bail était déjà en février : mars n'est plus accepté (R8).
      expect(produced).toEqual({ status: "month-not-accepted" });
      expect(receiptRows).toEqual([]);
    }
  });
});
