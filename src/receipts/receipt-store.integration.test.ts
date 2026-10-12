// Tests d'intégration des fonctions d'accès aux quittances (CA3 à CA7 de la
// spécification 04), contre la base de test. Lancés par
// `pnpm test:integration`.
//
// Chaque test crée ses comptes (domaine quittances.test), ses locations et ses
// quittances. Chaque critère d'isolation met en jeu deux propriétaires, A et B :
// on vérifie ce que B obtient (la même chose que pour un identifiant inconnu)
// et que les données de A sont intactes.

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { Owner } from "../auth/current-owner";
import { closeDb, getDb } from "../db";
import { receipt, rental, user } from "../db/schema";
import {
  archiveRental,
  deleteRental,
  getRental,
  listArchivedRentals,
  listRentals,
  reopenRental,
  restoreRental,
  updateRental,
} from "../rentals/rental-store";
import { normalizeSpaces, readPdf } from "../test-support/read-pdf";
import {
  BAILLEUR_TYPE,
  countReceiptsOfOwner,
  countRentalsOfOwner,
  countRowsContaining,
  createOwner,
  createOwnerWithLandlord,
  type CreatedEmails,
  insertRental,
  insertTypeRental,
  LE_12_OCTOBRE,
  produceFor,
  purgeOwners,
  readLandlordRow,
  readReceiptRows,
  receiptInput,
} from "../test-support/store-fixtures";
import { getLandlord, saveLandlord } from "./landlord-store";
import { getReceiptReference } from "./receipt-reference";
import {
  countReceipts,
  deleteReceipt,
  getReceipt,
  listReceipts,
  produceReceipt,
  ReceiptStoreError,
} from "./receipt-store";
import { renderReceiptPdf } from "./render-receipt-pdf";

// Lectures : Pool.query. Transactions d'écriture : Pool.connect. Les espionner
// permet d'affirmer « aucune requête n'est partie ».
const querySpy = vi.spyOn(Pool.prototype, "query");
const connectSpy = vi.spyOn(Pool.prototype, "connect");

const createdEmails: CreatedEmails = [];

afterAll(async () => {
  await purgeOwners(createdEmails);
  await closeDb();
});

// Écriture directe d'une quittance, sans passer par les fonctions d'accès : sert
// à vérifier ce que la base refuse d'elle-même.
function directReceiptValues(ownerId: string, rentalId: string) {
  return {
    ownerId,
    rentalId,
    month: "2026-02",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    landlordName: "Marie Durand",
    landlordAddress: "3 rue de la Paix",
    landlordAddressComplement: null,
    landlordPostalCode: "75002",
    landlordCity: "Paris",
    tenantName: "Paul Martin",
    rentalAddress: "12 rue des Lilas",
    rentalAddressComplement: "Bât. B",
    rentalPostalCode: "69003",
    rentalCity: "Lyon",
    rentInCents: 85000,
    chargesInCents: 5000,
    paymentDate: "2026-02-03",
    issueDate: "2026-02-03",
  };
}

function insertReceiptDirectly(
  ownerId: string,
  rentalId: string,
  overrides: object = {},
) {
  return getDb()
    .insert(receipt)
    .values({ ...directReceiptValues(ownerId, rentalId), ...overrides });
}

describe("CA3 — produire, relire, lister ; les valeurs figées ne changent plus", () => {
  it("fige le mois, la période, le bailleur, le locataire, le logement, les montants et les dates, puis ne relit plus rien", async () => {
    const ownerA = await createOwnerWithLandlord("ca3-a", createdEmails);
    const rentalId = await insertTypeRental(ownerA);

    // Le 31 octobre à 23:30 UTC, c'est déjà le 1er novembre à Paris.
    const result = await produceReceipt(
      ownerA,
      rentalId,
      receiptInput({ month: "2026-01", rentInCents: 42550, chargesInCents: 0, paymentDate: "2026-01-20" }),
      new Date("2026-10-31T23:30:00Z"),
    );

    expect(result.status).toBe("produced");
    if (result.status !== "produced") return;
    const produced = result.receipt;
    // Identifiant généré par le système, forme canonique, version 4 (R6).
    expect(produced.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const expected = {
      id: produced.id,
      rentalId,
      month: "2026-01",
      periodStart: "2026-01-15",
      periodEnd: "2026-01-31",
      landlordName: "Marie Durand",
      landlordAddress: "3 rue de la Paix",
      landlordAddressComplement: null,
      landlordPostalCode: "75002",
      landlordCity: "Paris",
      tenantName: "Paul Martin",
      rentalAddress: "12 rue des Lilas",
      rentalAddressComplement: "Bât. B",
      rentalPostalCode: "69003",
      rentalCity: "Lyon",
      rentInCents: 42550,
      chargesInCents: 0,
      paymentDate: "2026-01-20",
      issueDate: "2026-11-01",
      producedAt: new Date("2026-10-31T23:30:00Z"),
    };
    expect(produced).toEqual(expected);

    const read = await getReceipt(ownerA, produced.id);
    expect(read).toEqual(expected);
    // Ni l'identifiant du propriétaire, ni l'adresse e-mail du locataire, ni le
    // jour d'échéance ne sont dans une quittance (R6).
    expect(read).not.toHaveProperty("ownerId");
    expect(JSON.stringify(read)).not.toContain("quittances.test");
    expect(await listReceipts(ownerA, rentalId)).toEqual([expected]);
    expect(await countReceipts(ownerA, rentalId)).toBe(1);
    // La ligne en base appartient bien à A.
    expect((await readReceiptRows(rentalId))[0].ownerId).toBe(ownerA.id);

    // La location garde ses montants : ceux de la quittance ne l'ont pas modifiée.
    expect(await getRental(ownerA, rentalId)).toMatchObject({
      rentInCents: 85000,
      chargesInCents: 5000,
    });

    // A modifie tous les champs de la location, lui retire sa date de fin et
    // remplace ses informations de bailleur.
    expect(
      await updateRental(ownerA, rentalId, {
        address: "99 boulevard Modifié",
        addressComplement: null,
        postalCode: "13001",
        city: "Marseille",
        tenantName: "Autre Locataire",
        tenantEmail: `autre-${randomUUID()}@quittances.test`,
        rentInCents: 123456,
        chargesInCents: 7890,
        dueDay: 28,
        startDate: "2025-06-01",
      }),
    ).toBe("updated");
    expect(await reopenRental(ownerA, rentalId)).toBe("updated");
    await saveLandlord(ownerA, {
      name: "SCI Remplacée",
      address: "1 place Nouvelle",
      addressComplement: "Étage 4",
      postalCode: "31000",
      city: "Toulouse",
    });

    // La quittance relue est identique champ par champ (R5, R7).
    expect(await getReceipt(ownerA, produced.id)).toEqual(expected);
    expect(await listReceipts(ownerA, rentalId)).toEqual([expected]);
  });

  it("rend un ReceiptSnapshot que renderReceiptPdf accepte tel quel : le PDF se construit avec les valeurs figées", async () => {
    const ownerA = await createOwnerWithLandlord("ca3-pdf", createdEmails);
    const rentalId = await insertTypeRental(ownerA);
    const produced = await produceFor(ownerA, rentalId, "2026-01");

    const read = await getReceipt(ownerA, produced.id);
    expect(read).not.toBeNull();
    if (read === null) return;
    // La quittance lue en base est passée telle quelle, avec son instant de
    // production pour date de création.
    const pdf = await renderReceiptPdf(read, read.producedAt);

    const content = await readPdf(new Uint8Array(pdf));
    expect(content.pageCount).toBe(1);
    const text = normalizeSpaces(content.text);
    // Témoin : le texte extrait n'est pas vide.
    expect(text).toContain("Quittance de loyer");
    for (const expectedText of [
      "Janvier 2026",
      `Référence ${getReceiptReference(read.id, read.month)}`,
      "Marie Durand",
      "3 rue de la Paix",
      "75002 Paris",
      "Paul Martin",
      "12 rue des Lilas",
      "Bât. B",
      "69003 Lyon",
      "Du 15/01/2026 au 31/01/2026",
      "Paiement reçu le 20/01/2026",
      "Fait à Paris, le 12/10/2026",
    ]) {
      expect(text).toContain(expectedText);
    }
    expect(text).not.toContain("quittances.test");
  });

  it("calcule la période d'après les dates du bail lues en base (R9) et refuse un mois hors du bail", async () => {
    const ownerA = await createOwnerWithLandlord("ca3-periode", createdEmails);
    const rentalId = await insertTypeRental(ownerA);

    const february = await produceFor(ownerA, rentalId, "2026-02");
    const march = await produceFor(ownerA, rentalId, "2026-03");
    expect(february).toMatchObject({ periodStart: "2026-02-01", periodEnd: "2026-02-28" });
    expect(march).toMatchObject({ periodStart: "2026-03-01", periodEnd: "2026-03-20" });
    // Mois le plus récent d'abord (R23).
    expect((await listReceipts(ownerA, rentalId)).map((item) => item.month)).toEqual([
      "2026-03",
      "2026-02",
    ]);

    // Les mois proposés à l'écran ne sont jamais une autorisation : la fonction
    // recontrôle R8 avec les dates relues en base.
    for (const month of ["2025-12", "2026-04", "2099-12", "2026-13", "", "2026-1"]) {
      expect(
        await produceReceipt(ownerA, rentalId, receiptInput({ month }), LE_12_OCTOBRE),
      ).toEqual({ status: "month-not-accepted" });
    }
    expect(await countReceipts(ownerA, rentalId)).toBe(2);
  });

  it("refuse de figer un texte que le document ne sait pas afficher (R17), sans rien écrire", async () => {
    const ownerA = await createOwnerWithLandlord("ca3-r17-a", createdEmails);
    const emojiRentalId = await insertTypeRental(ownerA, { tenantName: "Paul 😀" });
    expect(
      await produceReceipt(ownerA, emojiRentalId, receiptInput(), LE_12_OCTOBRE),
    ).toEqual({ status: "rental-not-displayable" });

    const ownerB = await createOwnerWithLandlord("ca3-r17-b", createdEmails, {
      name: "王伟",
    });
    const rentalOfB = await insertTypeRental(ownerB);
    expect(
      await produceReceipt(ownerB, rentalOfB, receiptInput(), LE_12_OCTOBRE),
    ).toEqual({ status: "landlord-not-displayable" });

    expect(await countReceiptsOfOwner(ownerA.id)).toBe(0);
    expect(await countReceiptsOfOwner(ownerB.id)).toBe(0);
  });
});

describe("CA4 — B ne produit, ne lit, ne liste, ne compte et ne supprime rien chez A", () => {
  it("rend à B, pour chaque appel, le résultat d'un identifiant inconnu, et laisse la quittance de A identique", async () => {
    const ownerA = await createOwnerWithLandlord("ca4-a", createdEmails);
    const ownerB = await createOwnerWithLandlord("ca4-b", createdEmails, {
      name: "Bailleur B",
    });
    const rentalOfA = await insertTypeRental(ownerA);
    const receiptOfA = await produceFor(ownerA, rentalOfA, "2026-01");
    const rowsBefore = await readReceiptRows(rentalOfA);
    const rentalBefore = await getRental(ownerA, rentalOfA);
    const unknownId = randomUUID();

    // Produire, avec l'identifiant de la location de A, pour un mois libre puis
    // pour le mois déjà pris : jamais « déjà existante », qui révélerait la
    // quittance de A.
    for (const month of ["2026-02", "2026-01"]) {
      const forRentalOfA = await produceReceipt(
        ownerB,
        rentalOfA,
        receiptInput({ month, paymentDate: `${month}-20` }),
        LE_12_OCTOBRE,
      );
      const forUnknown = await produceReceipt(
        ownerB,
        unknownId,
        receiptInput({ month, paymentDate: `${month}-20` }),
        LE_12_OCTOBRE,
      );
      expect(forRentalOfA).toEqual({ status: "rental-not-found" });
      expect(forRentalOfA).toStrictEqual(forUnknown);
    }
    // Même avec des valeurs que la validation aurait refusées : « introuvable »
    // passe avant tout le reste (R26).
    expect(
      await produceReceipt(ownerB, rentalOfA, receiptInput({ month: "pas-un-mois" }), LE_12_OCTOBRE),
    ).toEqual({ status: "rental-not-found" });

    // Lire, lister, compter.
    expect(await getReceipt(ownerB, receiptOfA.id)).toBeNull();
    expect(await getReceipt(ownerB, receiptOfA.id)).toStrictEqual(
      await getReceipt(ownerB, unknownId),
    );
    expect(await listReceipts(ownerB, rentalOfA)).toEqual([]);
    expect(await listReceipts(ownerB, rentalOfA)).toStrictEqual(
      await listReceipts(ownerB, unknownId),
    );
    expect(await countReceipts(ownerB, rentalOfA)).toBe(0);
    expect(await countReceipts(ownerB, rentalOfA)).toBe(
      await countReceipts(ownerB, unknownId),
    );

    // Supprimer.
    expect(await deleteReceipt(ownerB, receiptOfA.id)).toBe("not-found");
    expect(await deleteReceipt(ownerB, receiptOfA.id)).toBe(
      await deleteReceipt(ownerB, unknownId),
    );

    // Aucune quittance créée chez A ni chez B ; celle de A est identique, ligne
    // de base comprise ; sa location aussi.
    expect(await countReceiptsOfOwner(ownerB.id)).toBe(0);
    expect(await readReceiptRows(rentalOfA)).toEqual(rowsBefore);
    expect(await getReceipt(ownerA, receiptOfA.id)).toEqual(receiptOfA);
    expect(await listReceipts(ownerA, rentalOfA)).toEqual([receiptOfA]);
    expect(await getRental(ownerA, rentalOfA)).toEqual(rentalBefore);
  });

  it("la quittance d'une location archivée de A reste introuvable pour B, et lisible par A", async () => {
    const ownerA = await createOwnerWithLandlord("ca4-archive-a", createdEmails);
    const ownerB = await createOwnerWithLandlord("ca4-archive-b", createdEmails);
    const rentalOfA = await insertTypeRental(ownerA);
    const receiptOfA = await produceFor(ownerA, rentalOfA, "2026-01");
    expect(await archiveRental(ownerA, rentalOfA, LE_12_OCTOBRE)).toBe("archived");

    // Rien ne révèle à B l'état d'archivage : toujours « introuvable ».
    expect(await getReceipt(ownerB, receiptOfA.id)).toBeNull();
    expect(await deleteReceipt(ownerB, receiptOfA.id)).toBe("not-found");
    expect(
      await produceReceipt(ownerB, rentalOfA, receiptInput({ month: "2026-02" }), LE_12_OCTOBRE),
    ).toEqual({ status: "rental-not-found" });

    // A la lit toujours (téléchargement d'une location archivée, R32).
    expect(await getReceipt(ownerA, receiptOfA.id)).toEqual(receiptOfA);
  });

  it("un identifiant mal formé est introuvable, sans requête, même pour le propriétaire", async () => {
    const ownerA = await createOwnerWithLandlord("ca4-forme", createdEmails);
    const rentalOfA = await insertTypeRental(ownerA);
    const receiptOfA = await produceFor(ownerA, rentalOfA, "2026-01");
    const malformed = (id: string) => [
      id.toUpperCase(),
      `{${id}}`,
      id.replaceAll("-", ""),
      ` ${id}`,
      `${id}\n`,
      "1",
      "",
      "a".repeat(10_000),
      "../",
      "' or 1=1 --",
      `${id}' or '1'='1`,
    ];

    querySpy.mockClear();
    connectSpy.mockClear();
    for (const malformedId of malformed(receiptOfA.id)) {
      expect(await getReceipt(ownerA, malformedId)).toBeNull();
      expect(await deleteReceipt(ownerA, malformedId)).toBe("not-found");
    }
    for (const malformedId of malformed(rentalOfA)) {
      expect(await listReceipts(ownerA, malformedId)).toEqual([]);
      expect(await countReceipts(ownerA, malformedId)).toBe(0);
      expect(
        await produceReceipt(ownerA, malformedId, receiptInput({ month: "2026-02" }), LE_12_OCTOBRE),
      ).toEqual({ status: "rental-not-found" });
      expect(await archiveRental(ownerA, malformedId, LE_12_OCTOBRE)).toBe("not-found");
      expect(await restoreRental(ownerA, malformedId)).toBe("not-found");
      expect(await deleteRental(ownerA, malformedId)).toBe("not-found");
    }
    expect(querySpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();

    // Témoin : les espions voient bien les requêtes, et tout est intact.
    expect(await getReceipt(ownerA, receiptOfA.id)).toEqual(receiptOfA);
    expect(querySpy).toHaveBeenCalled();
    expect(await deleteReceipt(ownerA, receiptOfA.id)).toBe("deleted");
    expect(connectSpy).toHaveBeenCalled();
  });
});

describe("CA2 — sans propriétaire, aucune fonction de R23 ni de R42 n'envoie de requête", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["un identifiant vide", { id: "", email: "personne@quittances.test" }],
    ["un objet sans identifiant", {}],
    ["un simple identifiant en texte", "un-identifiant-venu-du-navigateur"],
  ])("chaque fonction échoue avec %s", async (_description, notAnOwner) => {
    // Ce que TypeScript refuse à la compilation doit aussi échouer à
    // l'exécution : on contourne volontairement le type.
    const owner = notAnOwner as unknown as Owner;
    const someId = randomUUID();
    querySpy.mockClear();
    connectSpy.mockClear();

    const missing = "propriétaire manquant";
    await expect(
      produceReceipt(owner, someId, receiptInput(), LE_12_OCTOBRE),
    ).rejects.toThrow(missing);
    await expect(listReceipts(owner, someId)).rejects.toThrow(missing);
    await expect(countReceipts(owner, someId)).rejects.toThrow(missing);
    await expect(getReceipt(owner, someId)).rejects.toThrow(missing);
    await expect(deleteReceipt(owner, someId)).rejects.toThrow(missing);
    await expect(getLandlord(owner)).rejects.toThrow(missing);
    await expect(saveLandlord(owner, BAILLEUR_TYPE)).rejects.toThrow(missing);
    await expect(archiveRental(owner, someId, LE_12_OCTOBRE)).rejects.toThrow(missing);
    await expect(restoreRental(owner, someId)).rejects.toThrow(missing);
    await expect(deleteRental(owner, someId)).rejects.toThrow(missing);
    await expect(listArchivedRentals(owner)).rejects.toThrow(missing);
    await expect(listRentals(owner)).rejects.toThrow(missing);
    // Le propriétaire est contrôlé avant l'identifiant : même mal formé.
    await expect(getReceipt(owner, "1")).rejects.toThrow(missing);

    expect(querySpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("sans instant valide, produire et archiver échouent avant toute requête", async () => {
    const ownerA = await createOwner("ca2-instant", createdEmails);
    const someId = randomUUID();
    querySpy.mockClear();
    connectSpy.mockClear();

    for (const notAnInstant of [undefined, null, "2026-10-12", new Date("pas une date")]) {
      const now = notAnInstant as unknown as Date;
      await expect(produceReceipt(ownerA, someId, receiptInput(), now)).rejects.toThrow(
        "instant manquant",
      );
      await expect(archiveRental(ownerA, someId, now)).rejects.toThrow(
        "instant manquant",
      );
    }

    expect(querySpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });
});

describe("CA5 — une quittance par location et par mois", () => {
  it("répond « déjà existante » sans toucher la première, accepte une autre location et le même mois après suppression", async () => {
    const ownerA = await createOwnerWithLandlord("ca5-a", createdEmails);
    const rentalId = await insertTypeRental(ownerA);
    const otherRentalId = await insertTypeRental(ownerA, { address: "7 place Neuve" });
    const first = await produceFor(ownerA, rentalId, "2026-01");
    const rowsBefore = await readReceiptRows(rentalId);

    // Seconde production pour le même mois, avec d'autres montants : rien n'est
    // remplacé ni fusionné.
    const second = await produceReceipt(
      ownerA,
      rentalId,
      receiptInput({ month: "2026-01", rentInCents: 1, chargesInCents: 1, paymentDate: "2026-02-01" }),
      new Date("2026-10-13T10:00:00Z"),
    );
    expect(second).toEqual({ status: "already-exists" });
    expect(await readReceiptRows(rentalId)).toEqual(rowsBefore);
    expect(await getReceipt(ownerA, first.id)).toEqual(first);

    // Une autre location du même compte, même mois : acceptée.
    const onOtherRental = await produceFor(ownerA, otherRentalId, "2026-01");
    expect(onOtherRental.rentalAddress).toBe("7 place Neuve");
    expect(await countReceipts(ownerA, rentalId)).toBe(1);
    expect(await countReceipts(ownerA, otherRentalId)).toBe(1);

    // Après suppression de la première, le mois peut de nouveau en recevoir une.
    expect(await deleteReceipt(ownerA, first.id)).toBe("deleted");
    expect(await getReceipt(ownerA, first.id)).toBeNull();
    // Supprimer une quittance déjà supprimée : introuvable.
    expect(await deleteReceipt(ownerA, first.id)).toBe("not-found");
    const reproduced = await produceFor(ownerA, rentalId, "2026-01");
    expect(reproduced.id).not.toBe(first.id);
    expect(await listReceipts(ownerA, rentalId)).toEqual([reproduced]);
    // La quittance de l'autre location n'a pas bougé.
    expect(await getReceipt(ownerA, onOtherRental.id)).toEqual(onOtherRental);
  });

  it("deux productions simultanées du même mois en créent exactement une, et la perdante reçoit « déjà existante »", async () => {
    const ownerA = await createOwnerWithLandlord("ca5-simultane", createdEmails);
    const rentalId = await insertTypeRental(ownerA);
    const attempt = (rentInCents: number) =>
      produceReceipt(
        ownerA,
        rentalId,
        receiptInput({ month: "2026-02", rentInCents, paymentDate: "2026-02-03" }),
        LE_12_OCTOBRE,
      );

    // Quatre à la fois : une double activation, deux onglets, une requête rejouée.
    const results = await Promise.all([attempt(1), attempt(2), attempt(3), attempt(4)]);

    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([
      "already-exists",
      "already-exists",
      "already-exists",
      "produced",
    ]);
    const rows = await readReceiptRows(rentalId);
    expect(rows).toHaveLength(1);
    // La quittance en base est celle de la gagnante, entière.
    const winner = results.find((result) => result.status === "produced");
    expect(winner?.status === "produced" && winner.receipt.rentInCents).toBe(
      rows[0].rentInCents,
    );
  });

  it("la base refuse elle-même un doublon inséré directement", async () => {
    const ownerA = await createOwnerWithLandlord("ca5-doublon", createdEmails);
    const rentalId = await insertTypeRental(ownerA);
    await insertReceiptDirectly(ownerA.id, rentalId);

    await expect(insertReceiptDirectly(ownerA.id, rentalId)).rejects.toMatchObject({
      cause: { constraint: "receipt_rental_id_month_unique" },
    });

    expect(await readReceiptRows(rentalId)).toHaveLength(1);
  });
});

describe("CA6 — informations absentes, et ce que la base refuse d'elle-même", () => {
  it("répond « informations absentes » et ne crée rien tant que le bailleur n'est pas renseigné", async () => {
    const ownerA = await createOwner("ca6-sans-bailleur", createdEmails);
    const rentalId = await insertTypeRental(ownerA);

    expect(
      await produceReceipt(ownerA, rentalId, receiptInput(), LE_12_OCTOBRE),
    ).toEqual({ status: "landlord-missing" });
    expect(await countReceiptsOfOwner(ownerA.id)).toBe(0);

    // Les informations d'un autre compte ne servent jamais à A.
    await createOwnerWithLandlord("ca6-autre", createdEmails);
    expect(
      await produceReceipt(ownerA, rentalId, receiptInput(), LE_12_OCTOBRE),
    ).toEqual({ status: "landlord-missing" });

    // Une fois renseignées, la production réussit.
    await saveLandlord(ownerA, BAILLEUR_TYPE);
    expect(
      (await produceReceipt(ownerA, rentalId, receiptInput(), LE_12_OCTOBRE)).status,
    ).toBe("produced");
  });

  it("témoin : la même écriture directe, avec des valeurs valides, est acceptée", async () => {
    const ownerA = await createOwner("ca6-temoin", createdEmails);
    const rentalId = await insertTypeRental(ownerA);

    await insertReceiptDirectly(ownerA.id, rentalId);

    expect(await readReceiptRows(rentalId)).toHaveLength(1);
  });

  it.each([
    ["un loyer de 0", { rentInCents: 0 }, "receipt_rent_in_cents_range"],
    ["un loyer négatif", { rentInCents: -1 }, "receipt_rent_in_cents_range"],
    ["un loyer au-dessus de 9 999 999", { rentInCents: 10_000_000 }, "receipt_rent_in_cents_range"],
    ["des charges négatives", { chargesInCents: -1 }, "receipt_charges_in_cents_range"],
    ["des charges au-dessus de 9 999 999", { chargesInCents: 10_000_000 }, "receipt_charges_in_cents_range"],
    [
      "une période dont la fin précède le début",
      { periodStart: "2026-02-20", periodEnd: "2026-02-10" },
      "receipt_period_end_not_before_start",
    ],
    [
      "une période qui commence avant son mois",
      { periodStart: "2026-01-31" },
      "receipt_period_within_month",
    ],
    [
      "une période qui finit après son mois",
      { periodEnd: "2026-03-01" },
      "receipt_period_within_month",
    ],
    [
      "une date de paiement postérieure à la date d'émission",
      { paymentDate: "2026-02-04", issueDate: "2026-02-03" },
      "receipt_payment_date_not_after_issue_date",
    ],
    ["un mois mal formé", { month: "2026-13" }, "receipt_month_format"],
    ["un nom de bailleur vide", { landlordName: "" }, "receipt_landlord_name_length"],
    ["une adresse de bailleur de 201 caractères", { landlordAddress: "a".repeat(201) }, "receipt_landlord_address_length"],
    ["un complément de bailleur vide", { landlordAddressComplement: "" }, "receipt_landlord_address_complement_length"],
    ["un code postal de bailleur de 4 chiffres", { landlordPostalCode: "7501" }, "receipt_landlord_postal_code_format"],
    ["une ville de bailleur vide", { landlordCity: "" }, "receipt_landlord_city_length"],
    ["un nom de locataire de 101 caractères", { tenantName: "a".repeat(101) }, "receipt_tenant_name_length"],
    ["une adresse de logement vide", { rentalAddress: "" }, "receipt_rental_address_length"],
    ["un complément de logement vide", { rentalAddressComplement: "" }, "receipt_rental_address_complement_length"],
    ["un code postal de logement mal formé", { rentalPostalCode: "abcde" }, "receipt_rental_postal_code_format"],
    ["une ville de logement de 101 caractères", { rentalCity: "a".repeat(101) }, "receipt_rental_city_length"],
    [
      "un propriétaire qui n'existe pas",
      { ownerId: "compte-inexistant" },
      // Le couple (location, propriétaire) n'existe pas non plus : l'une ou
      // l'autre des deux clés étrangères refuse.
      expect.stringMatching(/^receipt_(owner_id_user_id|rental_id_owner_id_rental)_fk$/),
    ],
    [
      "une location qui n'existe pas",
      { rentalId: randomUUID() },
      "receipt_rental_id_owner_id_rental_fk",
    ],
  ])("refuse %s", async (_description, overrides, constraint) => {
    const ownerA = await createOwner("ca6-base", createdEmails);
    const rentalId = await insertTypeRental(ownerA);

    await expect(
      insertReceiptDirectly(ownerA.id, rentalId, overrides),
    ).rejects.toMatchObject({ cause: { constraint } });

    expect(await countReceiptsOfOwner(ownerA.id)).toBe(0);
  });

  it("refuse une quittance sans propriétaire, et une quittance sans location", async () => {
    const ownerA = await createOwner("ca6-null", createdEmails);
    const rentalId = await insertTypeRental(ownerA);

    // 23502 : violation de NOT NULL.
    await expect(
      insertReceiptDirectly(ownerA.id, rentalId, { ownerId: sql`null` }),
    ).rejects.toMatchObject({ cause: { code: "23502", column: "owner_id" } });
    await expect(
      insertReceiptDirectly(ownerA.id, rentalId, { rentalId: sql`null` }),
    ).rejects.toMatchObject({ cause: { code: "23502", column: "rental_id" } });

    expect(await countReceiptsOfOwner(ownerA.id)).toBe(0);
  });

  it("refuse une quittance dont le propriétaire n'est pas celui de sa location", async () => {
    const ownerA = await createOwner("ca6-couple-a", createdEmails);
    const ownerB = await createOwner("ca6-couple-b", createdEmails);
    const rentalOfA = await insertTypeRental(ownerA);

    // Les deux existent, mais pas ensemble : la base garantit qu'une quittance
    // a le propriétaire de sa location.
    await expect(
      insertReceiptDirectly(ownerB.id, rentalOfA),
    ).rejects.toMatchObject({
      cause: { constraint: "receipt_rental_id_owner_id_rental_fk" },
    });

    expect(await readReceiptRows(rentalOfA)).toEqual([]);
  });
});

describe("R37 — une erreur de base ne transporte aucune donnée personnelle", () => {
  it("lève une ReceiptStoreError sans SQL, sans nom ni adresse, sans cause, et n'écrit rien", async () => {
    const landlordName = `Bailleur ${randomUUID()}`;
    const tenantName = `Locataire ${randomUUID()}`;
    const address = `Adresse ${randomUUID()}`;
    const ownerA = await createOwnerWithLandlord("r37-a", createdEmails, {
      name: landlordName,
    });
    const rentalId = await insertTypeRental(ownerA, { tenantName, address });

    // Un loyer nul, que la validation aurait refusé : c'est la base qui refuse.
    const error: unknown = await produceReceipt(
      ownerA,
      rentalId,
      receiptInput({ rentInCents: 0 }),
      LE_12_OCTOBRE,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ReceiptStoreError);
    if (!(error instanceof ReceiptStoreError)) return;
    expect(error.name).toBe("ReceiptStoreError");
    expect(error.cause).toBeUndefined();
    const everythingLoggable = `${error.message}\n${error.stack}`;
    expect(everythingLoggable).not.toContain(landlordName);
    expect(everythingLoggable).not.toContain(tenantName);
    expect(everythingLoggable).not.toContain(address);
    expect(everythingLoggable).not.toContain("3 rue de la Paix");
    expect(everythingLoggable.toLowerCase()).not.toContain("insert");
    expect(await countReceiptsOfOwner(ownerA.id)).toBe(0);
  });

  it("une date de paiement postérieure au jour de la production est refusée par la base, sans rien écrire", async () => {
    const ownerA = await createOwnerWithLandlord("r37-date", createdEmails);
    const rentalId = await insertTypeRental(ownerA);

    // Le 12/10/2026, un paiement daté du 25/10/2026 (exemple de R13).
    await expect(
      produceReceipt(
        ownerA,
        rentalId,
        receiptInput({ month: "2026-03", paymentDate: "2026-10-25" }),
        LE_12_OCTOBRE,
      ),
    ).rejects.toBeInstanceOf(ReceiptStoreError);
    expect(await countReceiptsOfOwner(ownerA.id)).toBe(0);

    // Le même jour, un paiement daté du 12/10/2026 est accepté.
    const accepted = await produceReceipt(
      ownerA,
      rentalId,
      receiptInput({ month: "2026-03", paymentDate: "2026-10-12" }),
      LE_12_OCTOBRE,
    );
    expect(accepted.status).toBe("produced");
  });
});

describe("CA7 — suppression définitive réelle, et disparition avec le compte", () => {
  it("efface la location archivée, ses deux quittances et toute trace du locataire, sans toucher l'autre location", async () => {
    const landlordName = `Bailleur ${randomUUID()}`;
    const tenantName = `Locataire ${randomUUID()}`;
    const tenantEmail = `locataire-${randomUUID()}@quittances.test`;
    const otherTenantName = `Locataire ${randomUUID()}`;
    const ownerA = await createOwnerWithLandlord("ca7-a", createdEmails, {
      name: landlordName,
    });
    const firstRentalId = await insertTypeRental(ownerA, { tenantName, tenantEmail });
    const secondRentalId = await insertTypeRental(ownerA, {
      tenantName: otherTenantName,
    });
    await produceFor(ownerA, firstRentalId, "2026-01");
    await produceFor(ownerA, firstRentalId, "2026-02");
    const keptReceipts = [
      await produceFor(ownerA, secondRentalId, "2026-02"),
      await produceFor(ownerA, secondRentalId, "2026-01"),
    ];

    // Témoin : la recherche trouve bien ce qui est enregistré (la location et
    // ses deux quittances pour le nom ; la location seule pour l'adresse e-mail,
    // qui n'est jamais copiée dans une quittance).
    expect(await countRowsContaining(tenantName)).toBe(3);
    expect(await countRowsContaining(tenantEmail)).toBe(1);
    // Le nom du bailleur : ses informations et les quatre quittances.
    expect(await countRowsContaining(landlordName)).toBe(5);

    expect(await archiveRental(ownerA, firstRentalId, LE_12_OCTOBRE)).toBe("archived");
    expect(await deleteRental(ownerA, firstRentalId)).toBe("deleted");

    expect(await getRental(ownerA, firstRentalId)).toBeNull();
    expect(await readReceiptRows(firstRentalId)).toEqual([]);
    expect(await countRowsContaining(tenantName)).toBe(0);
    expect(await countRowsContaining(tenantEmail)).toBe(0);
    // Restent les informations du bailleur et les deux quittances de l'autre location.
    expect(await countRowsContaining(landlordName)).toBe(3);
    expect(await listReceipts(ownerA, secondRentalId)).toEqual(keptReceipts);
    expect(await countRowsContaining(otherTenantName)).toBe(3);
    // Supprimer définitivement une location déjà supprimée : introuvable.
    expect(await deleteRental(ownerA, firstRentalId)).toBe("not-found");
  });

  it("la disparition du compte emporte ses informations, ses locations archivées ou non et ses quittances, et rien de B", async () => {
    const landlordNameOfA = `Bailleur ${randomUUID()}`;
    const tenantNameOfA = `Locataire ${randomUUID()}`;
    const ownerA = await createOwnerWithLandlord("ca7-compte-a", createdEmails, {
      name: landlordNameOfA,
    });
    const ownerB = await createOwnerWithLandlord("ca7-compte-b", createdEmails, {
      name: "Bailleur B",
    });
    // A : une location active avec deux quittances, une location archivée avec
    // une quittance, une location sans quittance.
    const activeOfA = await insertTypeRental(ownerA, { tenantName: tenantNameOfA });
    const archivedOfA = await insertTypeRental(ownerA, { tenantName: tenantNameOfA });
    await insertRental(ownerA, { tenantName: tenantNameOfA });
    await produceFor(ownerA, activeOfA, "2026-01");
    await produceFor(ownerA, activeOfA, "2026-02");
    await produceFor(ownerA, archivedOfA, "2026-03");
    expect(await archiveRental(ownerA, archivedOfA, LE_12_OCTOBRE)).toBe("archived");
    // B : une location active et une archivée, chacune avec une quittance.
    const activeOfB = await insertTypeRental(ownerB);
    const archivedOfB = await insertTypeRental(ownerB);
    const receiptsOfB = [
      await produceFor(ownerB, activeOfB, "2026-01"),
      await produceFor(ownerB, archivedOfB, "2026-01"),
    ];
    expect(await archiveRental(ownerB, archivedOfB, LE_12_OCTOBRE)).toBe("archived");
    const rentalsOfB = [
      await getRental(ownerB, activeOfB),
      await getRental(ownerB, archivedOfB),
    ];
    expect(await countRentalsOfOwner(ownerA.id)).toBe(3);
    expect(await countReceiptsOfOwner(ownerA.id)).toBe(3);

    // La ligne du compte est supprimée directement en base de test. La base
    // refuse d'effacer une location qui a une quittance (R43), mais laisse le
    // compte tout emporter (R20) : les deux cascades partent dans la même
    // instruction, et le contrôle n'a lieu qu'à la fin.
    await getDb().delete(user).where(eq(user.id, ownerA.id));

    expect(await readLandlordRow(ownerA.id)).toBeUndefined();
    expect(await countRentalsOfOwner(ownerA.id)).toBe(0);
    expect(await countReceiptsOfOwner(ownerA.id)).toBe(0);
    expect(await countRowsContaining(landlordNameOfA)).toBe(0);
    expect(await countRowsContaining(tenantNameOfA)).toBe(0);
    expect(await countRowsContaining(ownerA.id)).toBe(0);

    // Tout ce qui est à B est intact.
    expect(await getLandlord(ownerB)).toEqual({ ...BAILLEUR_TYPE, name: "Bailleur B" });
    expect(await getRental(ownerB, activeOfB)).toEqual(rentalsOfB[0]);
    expect(await getRental(ownerB, archivedOfB)).toEqual(rentalsOfB[1]);
    expect(await getReceipt(ownerB, receiptsOfB[0].id)).toEqual(receiptsOfB[0]);
    expect(await getReceipt(ownerB, receiptsOfB[1].id)).toEqual(receiptsOfB[1]);
  });

  it("la base refuse d'effacer directement une location qui a une quittance, archivée ou non (R43)", async () => {
    const ownerA = await createOwnerWithLandlord("ca7-refus", createdEmails);
    const activeId = await insertTypeRental(ownerA);
    const archivedId = await insertTypeRental(ownerA);
    const receiptOfActive = await produceFor(ownerA, activeId, "2026-01");
    const receiptOfArchived = await produceFor(ownerA, archivedId, "2026-01");
    expect(await archiveRental(ownerA, archivedId, LE_12_OCTOBRE)).toBe("archived");

    // Une écriture directe, hors des fonctions d'accès : le chemin de code qui
    // aurait oublié la règle. 23503 : violation de clé étrangère.
    for (const rentalId of [activeId, archivedId]) {
      await expect(
        getDb().delete(rental).where(eq(rental.id, rentalId)),
      ).rejects.toMatchObject({
        cause: { code: "23503", constraint: "receipt_rental_id_owner_id_rental_fk" },
      });
    }

    // Rien n'a disparu : ni les locations, ni leurs quittances.
    expect(await getRental(ownerA, activeId)).not.toBeNull();
    expect(await getRental(ownerA, archivedId)).not.toBeNull();
    expect(await getReceipt(ownerA, receiptOfActive.id)).toEqual(receiptOfActive);
    expect(await getReceipt(ownerA, receiptOfArchived.id)).toEqual(receiptOfArchived);

    // Témoin : sans quittance, la même écriture directe est acceptée.
    const emptyId = await insertRental(ownerA);
    await getDb().delete(rental).where(eq(rental.id, emptyId));
    expect(await getRental(ownerA, emptyId)).toBeNull();
  });
});
