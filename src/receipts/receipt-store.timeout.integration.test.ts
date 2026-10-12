// Test d'intégration du délai des écritures de la spécification 04 (R31 de la
// spécification 03, R35 de la 04), contre la base de test. Lancé par
// `pnpm test:integration`. Même principe que
// src/rentals/rental-store.timeout.integration.test.ts.
//
// Ce qu'on prouve : une écriture qui dépasse le délai échoue ET ne s'exécute
// jamais plus tard. Une seconde connexion verrouille UNE ligne (la location du
// test, ou le compte du test) ; l'écriture attend, Postgres l'annule au bout de
// 3 s, puis on lève le verrou et on laisse 2 s à une écriture tardive pour se
// montrer. Les cas ne partagent rien et tournent en même temps.

import { afterAll, describe, expect, it } from "vitest";

import { closeDb } from "../db";
import {
  archiveRental,
  deleteRental,
  RentalStoreError,
  restoreRental,
} from "../rentals/rental-store";
import {
  BAILLEUR_TYPE,
  countReceiptsOfOwner,
  createOwner,
  createOwnerWithLandlord,
  type CreatedEmails,
  insertRental,
  LE_12_OCTOBRE,
  produceFor,
  purgeOwners,
  readLandlordRow,
  readReceiptRows,
  readRentalRow,
  receiptInput,
  wait,
  whileRowIsLocked,
} from "../test-support/store-fixtures";
import { LandlordStoreError, saveLandlord } from "./landlord-store";
import { deleteReceipt, produceReceipt, ReceiptStoreError } from "./receipt-store";

// Temps laissé à une écriture en attente pour s'exécuter une fois le verrou
// levé. Sans les délais tenus par Postgres, elle s'exécute en quelques dizaines
// de millisecondes.
const WAIT_AFTER_UNLOCK_IN_MS = 2_000;

const createdEmails: CreatedEmails = [];

afterAll(async () => {
  await purgeOwners(createdEmails);
  await closeDb();
});

// Exécute `attempt` pendant que la ligne est verrouillée, lève le verrou,
// attend, et rend l'erreur que `attempt` a levée (undefined s'il a réussi).
async function attemptWhileRowIsLocked(
  table: Parameters<typeof whileRowIsLocked>[0],
  rowId: string,
  attempt: () => Promise<unknown>,
): Promise<unknown> {
  const error = await whileRowIsLocked(table, rowId, async () => {
    try {
      await attempt();
      return undefined;
    } catch (caught) {
      return caught;
    }
  });
  await wait(WAIT_AFTER_UNLOCK_IN_MS);
  return error;
}

describe.concurrent(
  "Une écriture qui dépasse le délai n'est jamais exécutée plus tard",
  () => {
    it("produceReceipt : ReceiptStoreError sans donnée, et aucune quittance n'apparaît", async () => {
      const owner = await createOwnerWithLandlord("delai-produire", createdEmails);
      const rentalId = await insertRental(owner, { endDate: "2026-03-20" });

      const error = await attemptWhileRowIsLocked("rental", rentalId, () =>
        produceReceipt(owner, rentalId, receiptInput(), LE_12_OCTOBRE),
      );

      expect(error).toBeInstanceOf(ReceiptStoreError);
      const message = error instanceof Error ? error.message : "";
      expect(message).not.toContain("Marie Durand");
      expect(message).not.toContain("Paul Martin");
      expect(message.toLowerCase()).not.toContain("select");
      expect(error).not.toHaveProperty("cause");
      expect(await countReceiptsOfOwner(owner.id)).toBe(0);
    });

    it("deleteRental d'une location archivée : RentalStoreError, la location et ses quittances existent toujours", async () => {
      const owner = await createOwnerWithLandlord("delai-supprimer", createdEmails);
      const rentalId = await insertRental(owner, { endDate: "2026-03-20" });
      await produceFor(owner, rentalId, "2026-01");
      await produceFor(owner, rentalId, "2026-02");
      expect(await archiveRental(owner, rentalId, LE_12_OCTOBRE)).toBe("archived");
      const rowBefore = await readRentalRow(rentalId);
      const receiptRowsBefore = await readReceiptRows(rentalId);

      const error = await attemptWhileRowIsLocked("rental", rentalId, () =>
        deleteRental(owner, rentalId),
      );

      expect(error).toBeInstanceOf(RentalStoreError);
      // Ni la location, ni une partie de ses quittances : rien n'a été effacé.
      expect(await readRentalRow(rentalId)).toEqual(rowBefore);
      expect(await readReceiptRows(rentalId)).toEqual(receiptRowsBefore);
    });

    it("deleteReceipt : ReceiptStoreError, et la quittance existe toujours", async () => {
      const owner = await createOwnerWithLandlord("delai-quittance", createdEmails);
      const rentalId = await insertRental(owner, { endDate: "2026-03-20" });
      const receipt = await produceFor(owner, rentalId, "2026-01");
      const receiptRowsBefore = await readReceiptRows(rentalId);

      const error = await attemptWhileRowIsLocked("rental", rentalId, () =>
        deleteReceipt(owner, receipt.id),
      );

      expect(error).toBeInstanceOf(ReceiptStoreError);
      expect(await readReceiptRows(rentalId)).toEqual(receiptRowsBefore);
    });

    it("archiveRental : RentalStoreError, et la location reste active", async () => {
      const owner = await createOwner("delai-archiver", createdEmails);
      const rentalId = await insertRental(owner, { endDate: "2026-03-20" });

      const error = await attemptWhileRowIsLocked("rental", rentalId, () =>
        archiveRental(owner, rentalId, LE_12_OCTOBRE),
      );

      expect(error).toBeInstanceOf(RentalStoreError);
      expect((await readRentalRow(rentalId)).archivedAt).toBeNull();
    });

    it("restoreRental : RentalStoreError, et la location reste archivée", async () => {
      const owner = await createOwner("delai-restaurer", createdEmails);
      const rentalId = await insertRental(owner, { endDate: "2026-03-20" });
      expect(await archiveRental(owner, rentalId, LE_12_OCTOBRE)).toBe("archived");

      const error = await attemptWhileRowIsLocked("rental", rentalId, () =>
        restoreRental(owner, rentalId),
      );

      expect(error).toBeInstanceOf(RentalStoreError);
      expect((await readRentalRow(rentalId)).archivedAt).toEqual(LE_12_OCTOBRE);
    });

    // Un premier enregistrement n'a pas encore de ligne à verrouiller. Mais
    // l'insertion vérifie la clé étrangère owner_id : Postgres prend pour cela
    // un verrou de partage sur la ligne du compte, et attend si elle est
    // verrouillée.
    it("saveLandlord, premier enregistrement : LandlordStoreError, et aucune information n'apparaît", async () => {
      const owner = await createOwner("delai-bailleur", createdEmails);

      const error = await attemptWhileRowIsLocked("user", owner.id, () =>
        saveLandlord(owner, BAILLEUR_TYPE),
      );

      expect(error).toBeInstanceOf(LandlordStoreError);
      expect(await readLandlordRow(owner.id)).toBeUndefined();
    });

    it("saveLandlord, remplacement : LandlordStoreError sans donnée, et les informations gardent leurs valeurs", async () => {
      const owner = await createOwnerWithLandlord("delai-remplacer", createdEmails);
      const rowBefore = await readLandlordRow(owner.id);

      const error = await attemptWhileRowIsLocked("landlord", owner.id, () =>
        saveLandlord(owner, { ...BAILLEUR_TYPE, name: "Nom Tardif", city: "Marseille" }),
      );

      expect(error).toBeInstanceOf(LandlordStoreError);
      const message = error instanceof Error ? error.message : "";
      expect(message).not.toContain("Nom Tardif");
      expect(message).not.toContain("Marseille");
      expect(error).not.toHaveProperty("cause");
      expect(await readLandlordRow(owner.id)).toEqual(rowBefore);
    });
  },
);
