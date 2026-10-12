// Tests d'intégration de l'archivage, de la restauration et de la suppression
// définitive des locations (CA46 à CA48 et CA56 de la spécification 04, R39 à
// R43), contre la base de test. Lancés par `pnpm test:integration`.
//
// Chaque critère d'isolation met en jeu deux propriétaires, A et B : B obtient
// « introuvable », comme pour un identifiant inconnu, et jamais « état
// inapplicable », qui lui apprendrait que la location existe.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "../db";
import { rental } from "../db/schema";
import {
  deleteReceipt,
  getReceipt,
  listReceipts,
  produceReceipt,
} from "../receipts/receipt-store";
import {
  createOwner,
  createOwnerWithLandlord,
  type CreatedEmails,
  insertRental,
  LE_12_OCTOBRE,
  produceFor,
  purgeOwners,
  readReceiptRows,
  readRentalRow,
  receiptInput,
  rentalValues,
} from "../test-support/store-fixtures";
import {
  archiveRental,
  createRental,
  deleteRental,
  getRental,
  listArchivedRentals,
  listRentals,
  MAX_RENTALS_PER_OWNER,
  reopenRental,
  restoreRental,
  setRentalEndDate,
  updateRental,
} from "./rental-store";

const createdEmails: CreatedEmails = [];

afterAll(async () => {
  await purgeOwners(createdEmails);
  await closeDb();
});

// Écriture directe d'une date d'archivage, hors des fonctions d'accès.
function archiveDirectly(rentalId: string, archivedAt: Date) {
  return getDb().update(rental).set({ archivedAt }).where(eq(rental.id, rentalId));
}

describe("CA46 — seule une location terminée s'archive", () => {
  it("répond « état inapplicable » pour une location sans date de fin, qui finit aujourd'hui ou qui finit demain", async () => {
    const ownerA = await createOwner("ca46-en-cours", createdEmails);
    const rentalIds = [
      await insertRental(ownerA, { endDate: null }),
      await insertRental(ownerA, { endDate: "2026-10-12" }),
      await insertRental(ownerA, { endDate: "2026-10-13" }),
    ];
    const rowsBefore = await Promise.all(rentalIds.map(readRentalRow));

    for (const rentalId of rentalIds) {
      // La date du jour est le 12/10/2026 à Paris.
      expect(await archiveRental(ownerA, rentalId, LE_12_OCTOBRE)).toBe(
        "not-applicable",
      );
    }

    expect(await Promise.all(rentalIds.map(readRentalRow))).toEqual(rowsBefore);
    expect(await listArchivedRentals(ownerA)).toEqual([]);
    expect(await listRentals(ownerA)).toHaveLength(3);
  });

  it("le jour qui compte est celui de Paris, pas celui d'UTC (table de R39)", async () => {
    const ownerA = await createOwner("ca46-paris", createdEmails);
    const rentalId = await insertRental(ownerA, { endDate: "2026-10-31" });

    // 31/10 à 23:59:59 à Paris : le dernier jour du bail n'est pas fini.
    expect(
      await archiveRental(ownerA, rentalId, new Date("2026-10-31T22:59:59Z")),
    ).toBe("not-applicable");
    // 01/11 à 00:00:00 à Paris, alors que c'est encore le 31 octobre en UTC.
    const instant = new Date("2026-10-31T23:00:00Z");
    expect(await archiveRental(ownerA, rentalId, instant)).toBe("archived");
    expect((await getRental(ownerA, rentalId))?.archivedAt).toEqual(instant);
  });

  it("la base refuse elle-même une location archivée qui n'est pas terminée (R42)", async () => {
    const ownerA = await createOwner("ca46-base", createdEmails);
    const withoutEnd = await insertRental(ownerA, { endDate: null });
    const endsOnThe31st = await insertRental(ownerA, { endDate: "2026-10-31" });
    const refused = { cause: { constraint: "rental_archived_only_if_ended" } };

    // Sans date de fin.
    await expect(archiveDirectly(withoutEnd, LE_12_OCTOBRE)).rejects.toMatchObject(refused);
    // Date de fin égale au jour de l'archivage, à Paris.
    await expect(
      archiveDirectly(endsOnThe31st, new Date("2026-10-31T22:59:59Z")),
    ).rejects.toMatchObject(refused);
    // Date de fin postérieure au jour de l'archivage.
    await expect(archiveDirectly(endsOnThe31st, LE_12_OCTOBRE)).rejects.toMatchObject(refused);
    expect((await readRentalRow(withoutEnd)).archivedAt).toBeNull();
    expect((await readRentalRow(endsOnThe31st)).archivedAt).toBeNull();

    // Témoin : la même écriture, le lendemain à Paris, est acceptée.
    await archiveDirectly(endsOnThe31st, new Date("2026-10-31T23:00:00Z"));
    expect((await readRentalRow(endsOnThe31st)).archivedAt).not.toBeNull();

    // Et une fois archivée, la base refuse qu'on lui retire sa date de fin ou
    // qu'on la reporte : une location archivée reste terminée.
    await expect(
      getDb().update(rental).set({ endDate: null }).where(eq(rental.id, endsOnThe31st)),
    ).rejects.toMatchObject(refused);
    await expect(
      getDb().update(rental).set({ endDate: "2026-11-01" }).where(eq(rental.id, endsOnThe31st)),
    ).rejects.toMatchObject(refused);
  });

  it("archive une location terminée avec ses quittances, la met en consultation seule, puis la restaure intacte", async () => {
    const ownerA = await createOwnerWithLandlord("ca46-a", createdEmails);
    const rentalId = await insertRental(ownerA, { endDate: "2026-10-11" });
    const otherRentalId = await insertRental(ownerA, { address: "7 place Neuve" });
    const receipts = [
      await produceFor(ownerA, rentalId, "2026-02"),
      await produceFor(ownerA, rentalId, "2026-01"),
    ];
    const rowBeforeArchive = await readRentalRow(rentalId);
    const rentalBeforeArchive = await getRental(ownerA, rentalId);
    expect(rentalBeforeArchive?.archivedAt).toBeNull();

    // --- Archiver -----------------------------------------------------------
    expect(await archiveRental(ownerA, rentalId, LE_12_OCTOBRE)).toBe("archived");

    // Le tableau de bord ne la contient plus ; l'autre location y reste.
    expect((await listRentals(ownerA)).map((item) => item.id)).toEqual([otherRentalId]);
    // Les archives la contiennent, avec sa date d'archivage et le nombre 2.
    expect(await listArchivedRentals(ownerA)).toEqual([
      { ...rentalBeforeArchive, archivedAt: LE_12_OCTOBRE, receiptCount: 2 },
    ]);
    // Sa lecture la renvoie, avec sa date d'archivage. Rien d'autre n'a changé,
    // date de dernière modification comprise.
    const archived = await getRental(ownerA, rentalId);
    expect(archived).toEqual({ ...rentalBeforeArchive, archivedAt: LE_12_OCTOBRE });
    // Ses quittances se lisent toujours.
    expect(await listReceipts(ownerA, rentalId)).toEqual(receipts);
    expect(await getReceipt(ownerA, receipts[0].id)).toEqual(receipts[0]);

    // --- Consultation seule -------------------------------------------------
    const archivedRow = await readRentalRow(rentalId);
    const receiptRows = await readReceiptRows(rentalId);
    expect(
      await updateRental(ownerA, rentalId, rentalValues({ address: "99 rue Modifiée" })),
    ).toBe("not-applicable");
    expect(await setRentalEndDate(ownerA, rentalId, "2026-09-30")).toBe("not-applicable");
    expect(await reopenRental(ownerA, rentalId)).toBe("not-applicable");
    expect(
      await produceReceipt(ownerA, rentalId, receiptInput({ month: "2026-03", paymentDate: "2026-03-05" }), LE_12_OCTOBRE),
    ).toEqual({ status: "rental-archived" });
    expect(await deleteReceipt(ownerA, receipts[0].id)).toBe("not-applicable");
    // Rien n'a été écrit : ni sur la location, ni sur ses quittances.
    expect(await readRentalRow(rentalId)).toEqual(archivedRow);
    expect(await readReceiptRows(rentalId)).toEqual(receiptRows);

    // Archiver de nouveau, plus tard : sa date d'archivage ne change pas.
    expect(
      await archiveRental(ownerA, rentalId, new Date("2026-10-20T10:00:00Z")),
    ).toBe("not-applicable");
    expect((await getRental(ownerA, rentalId))?.archivedAt).toEqual(LE_12_OCTOBRE);

    // --- Restaurer ----------------------------------------------------------
    expect(await restoreRental(ownerA, rentalId)).toBe("restored");

    expect((await listRentals(ownerA)).map((item) => item.id).sort()).toEqual(
      [rentalId, otherRentalId].sort(),
    );
    expect(await listArchivedRentals(ownerA)).toEqual([]);
    // Sans date d'archivage, identique par ailleurs champ par champ : la ligne
    // en base est redevenue exactement celle d'avant l'archivage.
    expect(await readRentalRow(rentalId)).toEqual(rowBeforeArchive);
    expect(await getRental(ownerA, rentalId)).toEqual(rentalBeforeArchive);
    expect(await listReceipts(ownerA, rentalId)).toEqual(receipts);
    expect(await readReceiptRows(rentalId)).toEqual(receiptRows);

    // --- États inapplicables d'une location active ---------------------------
    // Restaurer une location active ne change rien.
    expect(await restoreRental(ownerA, rentalId)).toBe("not-applicable");
    // La supprimer définitivement alors qu'elle a ses deux quittances : non.
    expect(await deleteRental(ownerA, rentalId)).toBe("not-applicable");
    expect(await readRentalRow(rentalId)).toEqual(rowBeforeArchive);
    expect(await readReceiptRows(rentalId)).toEqual(receiptRows);

    // Restaurée, elle redevient modifiable, et de nouveau archivable.
    expect(await setRentalEndDate(ownerA, rentalId, "2026-09-30")).toBe("updated");
    expect(await archiveRental(ownerA, rentalId, LE_12_OCTOBRE)).toBe("archived");
  });

  it("liste les archives de la plus récemment archivée à la plus ancienne, avec le nombre de quittances de chacune (R41)", async () => {
    const ownerA = await createOwnerWithLandlord("ca46-liste", createdEmails);
    const prepare = async (archivedOn: string, months: string[]) => {
      const rentalId = await insertRental(ownerA, { endDate: "2026-06-30" });
      for (const month of months) {
        await produceFor(ownerA, rentalId, month);
      }
      await archiveDirectly(rentalId, new Date(`${archivedOn}T10:00:00Z`));
      return rentalId;
    };
    const archivedOnSept1 = await prepare("2026-09-01", []);
    const archivedOnSept15 = await prepare("2026-09-15", ["2026-01"]);
    const archivedOnSept10 = await prepare("2026-09-10", ["2026-01", "2026-02"]);
    await insertRental(ownerA);

    const archives = await listArchivedRentals(ownerA);

    expect(
      archives.map((item) => [item.id, item.receiptCount, item.archivedAt]),
    ).toEqual([
      [archivedOnSept15, 1, new Date("2026-09-15T10:00:00Z")],
      [archivedOnSept10, 2, new Date("2026-09-10T10:00:00Z")],
      [archivedOnSept1, 0, new Date("2026-09-01T10:00:00Z")],
    ]);
    // L'identifiant du propriétaire ne sort pas du module.
    expect(archives[0]).not.toHaveProperty("ownerId");
  });
});

describe("CA47 — B n'archive pas, ne restaure pas, ne supprime pas et ne liste pas les locations de A", () => {
  it("rend « introuvable » à B pour les trois locations de A, comme pour un identifiant inconnu, et les laisse identiques", async () => {
    const ownerA = await createOwnerWithLandlord("ca47-a", createdEmails);
    const ownerB = await createOwnerWithLandlord("ca47-b", createdEmails);
    const ongoing = await insertRental(ownerA, { endDate: null });
    const ended = await insertRental(ownerA, { endDate: "2026-03-20" });
    // La troisième est archivée avec une quittance : sa suppression par B se
    // verrait.
    const archived = await insertRental(ownerA, { endDate: "2026-06-30" });
    await produceFor(ownerA, archived, "2026-01");
    await archiveDirectly(archived, new Date("2026-09-15T10:00:00Z"));
    const rentalIdsOfA = [ongoing, ended, archived];
    const rowsBefore = await Promise.all(rentalIdsOfA.map(readRentalRow));
    const receiptRowsBefore = await readReceiptRows(archived);
    const archivesOfABefore = await listArchivedRentals(ownerA);
    // B a ses propres locations, pour vérifier qu'elles ne bougent pas non plus.
    const endedOfB = await insertRental(ownerB, { endDate: "2026-03-20" });
    const rowOfBBefore = await readRentalRow(endedOfB);
    const unknownId = randomUUID();

    for (const rentalId of [...rentalIdsOfA, unknownId]) {
      // Jamais « état inapplicable » : la réponse ne distingue ni les trois
      // locations entre elles, ni une location de A d'un identifiant inconnu.
      expect(await archiveRental(ownerB, rentalId, LE_12_OCTOBRE)).toBe("not-found");
      expect(await restoreRental(ownerB, rentalId)).toBe("not-found");
      expect(await deleteRental(ownerB, rentalId)).toBe("not-found");
      expect(await getRental(ownerB, rentalId)).toBeNull();
    }

    // La liste d'archives de B est vide ; son tableau de bord n'a que la sienne.
    expect(await listArchivedRentals(ownerB)).toEqual([]);
    expect((await listRentals(ownerB)).map((item) => item.id)).toEqual([endedOfB]);
    expect(await readRentalRow(endedOfB)).toEqual(rowOfBBefore);

    // Les trois locations de A sont identiques champ par champ, date
    // d'archivage et date de dernière modification comprises.
    expect(await Promise.all(rentalIdsOfA.map(readRentalRow))).toEqual(rowsBefore);
    expect(await readReceiptRows(archived)).toEqual(receiptRowsBefore);
    expect(await listArchivedRentals(ownerA)).toEqual(archivesOfABefore);
    expect((await listRentals(ownerA)).map((item) => item.id)).toEqual([ongoing, ended]);

    // Témoin : les mêmes appels, faits par A, écrivent bien.
    expect(await archiveRental(ownerA, ended, LE_12_OCTOBRE)).toBe("archived");
    expect(await restoreRental(ownerA, archived)).toBe("restored");
    expect(await deleteRental(ownerA, ongoing)).toBe("deleted");
  });
});

describe("CA48 — une location archivée compte dans la limite de 100", () => {
  it("refuse la création à 99 actives et une archivée, puis l'accepte après la suppression définitive de l'archivée", async () => {
    const ownerA = await createOwner("ca48-a", createdEmails);
    // Préparation directe, en une requête.
    await getDb()
      .insert(rental)
      .values(
        Array.from({ length: MAX_RENTALS_PER_OWNER - 1 }, () => ({
          ownerId: ownerA.id,
          ...rentalValues(),
        })),
      );
    const archivedId = await insertRental(ownerA, {
      endDate: "2026-06-30",
      archivedAt: new Date("2026-09-15T10:00:00Z"),
    });
    expect(await listRentals(ownerA)).toHaveLength(99);
    expect(await listArchivedRentals(ownerA)).toHaveLength(1);

    expect(await createRental(ownerA, rentalValues())).toEqual({
      status: "limit-reached",
    });
    expect(await listRentals(ownerA)).toHaveLength(99);

    // Seule une suppression définitive libère une place.
    expect(await deleteRental(ownerA, archivedId)).toBe("deleted");
    expect((await createRental(ownerA, rentalValues())).status).toBe("created");
    expect(await listRentals(ownerA)).toHaveLength(100);
    expect(await listArchivedRentals(ownerA)).toEqual([]);
  });
});

describe("CA56 — suppression directe d'une location sans quittance (R43)", () => {
  it("supprime une location active sans quittance, quel que soit son statut", async () => {
    const ownerA = await createOwner("ca56-statuts", createdEmails);
    const rentalIds = [
      // Sans date de fin.
      await insertRental(ownerA, { endDate: null }),
      // Fin à venir.
      await insertRental(ownerA, { endDate: "2099-12-31" }),
      // Terminée.
      await insertRental(ownerA, { endDate: "2026-03-20" }),
      // Bail qui commence dans le futur.
      await insertRental(ownerA, { startDate: "2099-01-01", endDate: null }),
    ];

    for (const rentalId of rentalIds) {
      expect(await deleteRental(ownerA, rentalId)).toBe("deleted");
    }

    for (const rentalId of rentalIds) {
      expect(await readRentalRow(rentalId)).toBeUndefined();
    }
    expect(await listRentals(ownerA)).toEqual([]);
  });

  it("ne supprime pas une location active qui a une quittance ; la supprime une fois la quittance supprimée", async () => {
    const ownerA = await createOwnerWithLandlord("ca56-quittance", createdEmails);
    const rentalId = await insertRental(ownerA, { endDate: "2026-03-20" });
    const receiptOfA = await produceFor(ownerA, rentalId, "2026-01");
    const rowBefore = await readRentalRow(rentalId);
    const receiptRowsBefore = await readReceiptRows(rentalId);

    expect(await deleteRental(ownerA, rentalId)).toBe("not-applicable");

    expect(await readRentalRow(rentalId)).toEqual(rowBefore);
    expect(await readReceiptRows(rentalId)).toEqual(receiptRowsBefore);
    expect(await getReceipt(ownerA, receiptOfA.id)).toEqual(receiptOfA);

    // La base refuse elle-même l'effacement direct de cette ligne.
    await expect(
      getDb().delete(rental).where(eq(rental.id, rentalId)),
    ).rejects.toMatchObject({
      cause: { code: "23503", constraint: "receipt_rental_id_owner_id_rental_fk" },
    });
    expect(await readRentalRow(rentalId)).toEqual(rowBefore);
    expect(await readReceiptRows(rentalId)).toEqual(receiptRowsBefore);

    // Sans sa quittance, elle redevient supprimable directement.
    expect(await deleteReceipt(ownerA, receiptOfA.id)).toBe("deleted");
    expect(await deleteRental(ownerA, rentalId)).toBe("deleted");
    expect(await readRentalRow(rentalId)).toBeUndefined();
  });

  it("supprime une location archivée sans quittance, et une location archivée avec ses quittances", async () => {
    const ownerA = await createOwnerWithLandlord("ca56-archivee", createdEmails);
    const withoutReceipt = await insertRental(ownerA, { endDate: "2026-03-20" });
    const withReceipts = await insertRental(ownerA, { endDate: "2026-03-20" });
    const kept = await insertRental(ownerA, { endDate: "2026-03-20" });
    await produceFor(ownerA, withReceipts, "2026-01");
    await produceFor(ownerA, withReceipts, "2026-02");
    const keptReceipt = await produceFor(ownerA, kept, "2026-01");
    for (const rentalId of [withoutReceipt, withReceipts, kept]) {
      expect(await archiveRental(ownerA, rentalId, LE_12_OCTOBRE)).toBe("archived");
    }

    expect(await deleteRental(ownerA, withoutReceipt)).toBe("deleted");
    expect(await deleteRental(ownerA, withReceipts)).toBe("deleted");

    expect(await readRentalRow(withoutReceipt)).toBeUndefined();
    expect(await readRentalRow(withReceipts)).toBeUndefined();
    expect(await readReceiptRows(withReceipts)).toEqual([]);
    // L'autre location archivée et sa quittance sont intactes.
    expect((await listArchivedRentals(ownerA)).map((item) => item.id)).toEqual([kept]);
    expect(await getReceipt(ownerA, keptReceipt.id)).toEqual(keptReceipt);
  });

  it("B ne supprime ni la location sans quittance ni la location avec quittance de A : « introuvable », comme pour un identifiant inconnu", async () => {
    const ownerA = await createOwnerWithLandlord("ca56-a", createdEmails);
    const ownerB = await createOwnerWithLandlord("ca56-b", createdEmails);
    const withoutReceipt = await insertRental(ownerA, { endDate: null });
    const withReceipt = await insertRental(ownerA, { endDate: "2026-03-20" });
    const receiptOfA = await produceFor(ownerA, withReceipt, "2026-01");
    const rowsBefore = [
      await readRentalRow(withoutReceipt),
      await readRentalRow(withReceipt),
    ];

    const forUnknown = await deleteRental(ownerB, randomUUID());
    expect(forUnknown).toBe("not-found");
    // La même réponse pour les deux : rien ne révèle qu'une location existe, ni
    // qu'elle a des quittances.
    expect(await deleteRental(ownerB, withoutReceipt)).toBe(forUnknown);
    expect(await deleteRental(ownerB, withReceipt)).toBe(forUnknown);

    expect([
      await readRentalRow(withoutReceipt),
      await readRentalRow(withReceipt),
    ]).toEqual(rowsBefore);
    expect(await getReceipt(ownerA, receiptOfA.id)).toEqual(receiptOfA);
  });
});
