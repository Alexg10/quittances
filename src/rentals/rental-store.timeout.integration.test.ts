// Test d'intégration du délai des écritures (R31 et CA41 de la spécification
// 03, R24 de la spécification 02), contre la base de test. Lancé par
// `pnpm test:integration`.
//
// Ce qu'on prouve : une écriture qui dépasse le délai échoue ET ne s'exécute
// jamais plus tard. Le bug d'origine (B1) : le pilote cessait d'attendre et
// levait une erreur, mais la requête restait en attente dans Postgres et
// s'exécutait dès qu'elle le pouvait, après que l'utilisateur avait lu
// « service indisponible ».
//
// Pour faire attendre une écriture, une seconde connexion verrouille UNE ligne
// (`SELECT … FOR UPDATE` dans une transaction laissée ouverte) : la location
// du test, ou le compte du test pour la création. Jamais de verrou de table :
// les autres fichiers d'intégration, qui tournent en parallèle sur les mêmes
// tables, ne sont pas ralentis.
//
// Chaque cas attend le délai de la base (3 s) puis laisse 2 s à une écriture
// tardive pour se montrer. Les cas ne partagent rien (un compte, une location
// et une connexion de verrouillage chacun) : ils tournent en même temps
// (`describe.concurrent`), et le fichier dure le temps d'un seul cas.

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import type { Owner } from "../auth/current-owner";
import { closeDb, getDb } from "../db";
import { rental, user } from "../db/schema";
import { requireEnv } from "../env";
import {
  createRental,
  deleteRental,
  type Rental,
  type RentalValues,
  RentalStoreError,
  reopenRental,
  setRentalEndDate,
  updateRental,
} from "./rental-store";

// Temps laissé à une écriture en attente pour s'exécuter une fois le verrou
// levé. Sans le correctif, elle s'exécute en quelques dizaines de millisecondes.
const WAIT_AFTER_UNLOCK_IN_MS = 2_000;

// Les deux requêtes de verrouillage, écrites en entier : le nom de la table
// n'est jamais assemblé à partir d'une variable.
const LOCK_ROW_QUERY = {
  rental: "SELECT id FROM rental WHERE id = $1 FOR UPDATE",
  user: 'SELECT id FROM "user" WHERE id = $1 FOR UPDATE',
};

const createdEmails: string[] = [];

async function createOwner(prefix: string): Promise<Owner> {
  const owner = {
    id: randomUUID(),
    email: `${prefix}-${randomUUID()}@quittances.test`,
  };
  createdEmails.push(owner.email);
  await getDb().insert(user).values({ id: owner.id, name: "", email: owner.email });
  return owner;
}

function validValues(overrides: Partial<RentalValues> = {}): RentalValues {
  return {
    address: "12 rue des Lilas",
    addressComplement: null,
    postalCode: "69003",
    city: "Lyon",
    tenantName: `Paul Martin ${randomUUID()}`,
    tenantEmail: `paul.martin-${randomUUID()}@quittances.test`,
    rentInCents: 125050,
    chargesInCents: 0,
    dueDay: 5,
    startDate: "2026-01-05",
    ...overrides,
  };
}

async function createRentalFor(owner: Owner, values: RentalValues): Promise<Rental> {
  const result = await createRental(owner, values);
  if (result.status !== "created") {
    throw new Error("La location de préparation n'a pas été créée.");
  }
  return result.rental;
}

// Exécute `attempt` pendant qu'une seconde connexion tient un verrou sur la
// ligne `rowId` de `table`, puis lève le verrou et attend. Rend l'erreur que
// `attempt` a levée (ou undefined s'il a réussi).
// Le verrou est levé et la connexion fermée quoi qu'il arrive.
async function attemptWhileRowIsLocked(
  table: keyof typeof LOCK_ROW_QUERY,
  rowId: string,
  attempt: () => Promise<unknown>,
): Promise<unknown> {
  // vitest.integration.setup.ts a remplacé DATABASE_URL par la base de test.
  const locker = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await locker.connect();
  let error: unknown;
  try {
    await locker.query("BEGIN");
    await locker.query(LOCK_ROW_QUERY[table], [rowId]);
    try {
      await attempt();
    } catch (caught) {
      error = caught;
    }
  } finally {
    try {
      // ROLLBACK lève le verrou : cette transaction n'a rien écrit.
      await locker.query("ROLLBACK");
    } finally {
      await locker.end();
    }
  }
  await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_UNLOCK_IN_MS));
  return error;
}

// Lecture directe de la ligne, sans passer par les fonctions d'accès.
async function readRentalInDatabase(rentalId: string) {
  const rows = await getDb()
    .select({ city: rental.city, endDate: rental.endDate })
    .from(rental)
    .where(eq(rental.id, rentalId));
  return rows[0];
}

afterAll(async () => {
  // Les comptes de cette exécution, et eux seuls. Leurs locations partent avec
  // eux (suppression en cascade).
  if (createdEmails.length > 0) {
    await getDb().delete(user).where(inArray(user.email, createdEmails));
  }
  await closeDb();
});

describe.concurrent(
  "CA41 — une écriture qui dépasse le délai n'est jamais exécutée plus tard",
  () => {
    it("updateRental : RentalStoreError sans donnée, et la ligne garde ses valeurs", async () => {
      const owner = await createOwner("delai-modifier");
      const values = validValues();
      const created = await createRentalFor(owner, values);

      const error = await attemptWhileRowIsLocked("rental", created.id, () =>
        updateRental(owner, created.id, { ...values, city: "Marseille" }),
      );

      expect(error).toBeInstanceOf(RentalStoreError);
      // L'erreur d'origine cite la requête et ses valeurs : rien n'en passe (R43).
      const message = error instanceof Error ? error.message : "";
      expect(message).not.toContain(values.tenantName);
      expect(message).not.toContain(values.tenantEmail);
      expect(message).not.toContain("Marseille");
      expect(message.toLowerCase()).not.toContain("update");
      expect(error).not.toHaveProperty("cause");
      expect(await readRentalInDatabase(created.id)).toEqual({
        city: "Lyon",
        endDate: null,
      });
    });

    it("setRentalEndDate : RentalStoreError, et la location reste sans date de fin", async () => {
      const owner = await createOwner("delai-fin");
      const created = await createRentalFor(owner, validValues());

      const error = await attemptWhileRowIsLocked("rental", created.id, () =>
        setRentalEndDate(owner, created.id, "2026-06-30"),
      );

      expect(error).toBeInstanceOf(RentalStoreError);
      expect(await readRentalInDatabase(created.id)).toEqual({
        city: "Lyon",
        endDate: null,
      });
    });

    it("reopenRental : RentalStoreError, et la location garde sa date de fin", async () => {
      const owner = await createOwner("delai-rouvrir");
      const created = await createRentalFor(owner, validValues());
      expect(await setRentalEndDate(owner, created.id, "2026-06-30")).toBe("updated");

      const error = await attemptWhileRowIsLocked("rental", created.id, () =>
        reopenRental(owner, created.id),
      );

      expect(error).toBeInstanceOf(RentalStoreError);
      expect(await readRentalInDatabase(created.id)).toEqual({
        city: "Lyon",
        endDate: "2026-06-30",
      });
    });

    it("deleteRental : RentalStoreError, et la ligne existe toujours", async () => {
      const owner = await createOwner("delai-supprimer");
      const created = await createRentalFor(owner, validValues());

      const error = await attemptWhileRowIsLocked("rental", created.id, () =>
        deleteRental(owner, created.id),
      );

      expect(error).toBeInstanceOf(RentalStoreError);
      expect(await readRentalInDatabase(created.id)).toEqual({
        city: "Lyon",
        endDate: null,
      });
    });

    // Une création n'a pas encore de ligne à verrouiller. Mais l'insertion
    // vérifie la clé étrangère owner_id : Postgres prend pour cela un verrou
    // de partage sur la ligne du compte, et attend si elle est verrouillée.
    it("createRental : RentalStoreError, et aucune location n'apparaît", async () => {
      const owner = await createOwner("delai-creer");
      const values = validValues();

      const error = await attemptWhileRowIsLocked("user", owner.id, () =>
        createRental(owner, values),
      );

      expect(error).toBeInstanceOf(RentalStoreError);
      const rows = await getDb()
        .select({ id: rental.id })
        .from(rental)
        .where(eq(rental.ownerId, owner.id));
      expect(rows).toEqual([]);
    });
  },
);
