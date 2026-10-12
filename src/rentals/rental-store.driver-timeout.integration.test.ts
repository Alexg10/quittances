// Test d'intégration : le délai du PILOTE tombe au milieu d'une transaction
// d'écriture, puis la base reprend. Contre la base de test, lancé par
// `pnpm test:integration`.
//
// Ce qu'on prouve (voir runWriteTransaction dans src/db/index.ts) : la
// connexion sur laquelle le pilote a abandonné n'est pas rendue au pool avec sa
// transaction ouverte. Sinon, l'écriture qui a échoué resterait en suspens sur
// cette connexion, et la transaction suivante, en validant, la validerait avec
// elle : une modification refusée à l'écran s'appliquerait plus tard.
//
// Dans l'application, Postgres annule une écriture bloquée (3 s) avant que le
// pilote n'abandonne (5 s) : le pilote n'abandonne le premier que si la base ne
// répond plus du tout. Pour provoquer ce cas sans couper le réseau, ce fichier
// donne à l'application un pool dont le pilote abandonne au bout d'une seconde,
// donc avant Postgres. src/db/index.ts garde son pool sur `globalThis.pgPool`
// et ne le crée que s'il n'existe pas : il suffit de l'y placer avant la
// première requête. Vitest exécute chaque fichier de test dans son propre
// processus : ce pool ne concerne que ce fichier.
//
// Une seule connexion dans ce pool : la requête qui suit l'échec réutilise
// forcément la connexion fautive, si elle a été rendue au pool.

import { randomUUID } from "node:crypto";

import { inArray, sql } from "drizzle-orm";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { Owner } from "../auth/current-owner";
import { closeDb, getDb } from "../db";
import { user } from "../db/schema";
import { requireEnv } from "../env";
import {
  createRental,
  type Rental,
  type RentalValues,
  RentalStoreError,
  updateRental,
} from "./rental-store";

// Une seconde : le pilote abandonne l'écriture, puis (dans la version fautive)
// le ROLLBACK, bien avant les 3 s au bout desquelles Postgres annulerait.
const DRIVER_TIMEOUT_IN_MS = 1_000;
// Temps laissé à l'écriture abandonnée pour s'exécuter une fois le verrou levé.
const WAIT_AFTER_UNLOCK_IN_MS = 1_000;

const createdEmails: string[] = [];

beforeAll(() => {
  // vitest.integration.setup.ts a remplacé DATABASE_URL par la base de test.
  const pool = new Pool({
    connectionString: requireEnv("DATABASE_URL"),
    max: 1,
    query_timeout: DRIVER_TIMEOUT_IN_MS,
  });
  // Même raison que dans src/db/index.ts : sans écouteur, une connexion
  // inactive perdue arrêterait le processus.
  pool.on("error", () => {});
  globalThis.pgPool = pool;
});

afterAll(async () => {
  if (createdEmails.length > 0) {
    await getDb().delete(user).where(inArray(user.email, createdEmails));
  }
  // Ferme le pool du test, puisque c'est lui qui est sur globalThis.
  await closeDb();
});

async function createOwner(): Promise<Owner> {
  const owner = {
    id: randomUUID(),
    email: `delai-pilote-${randomUUID()}@quittances.test`,
  };
  createdEmails.push(owner.email);
  await getDb().insert(user).values({ id: owner.id, name: "", email: owner.email });
  return owner;
}

function validValues(): RentalValues {
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
  };
}

async function createRentalFor(owner: Owner, values: RentalValues): Promise<Rental> {
  const result = await createRental(owner, values);
  if (result.status !== "created") {
    throw new Error("La location de préparation n'a pas été créée.");
  }
  return result.rental;
}

// Une connexion à part, ouverte hors du pool de l'application, puis fermée
// quoi qu'il arrive.
async function withSeparateConnection<Result>(
  run: (client: Client) => Promise<Result>,
): Promise<Result> {
  const client = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

// Ce qu'une AUTRE connexion voit de la ville : donc ce qui est réellement validé.
async function readCommittedCity(rentalId: string): Promise<unknown> {
  return withSeparateConnection(async (client) => {
    const result = await client.query("SELECT city FROM rental WHERE id = $1", [rentalId]);
    return result.rows[0]?.city;
  });
}

it("le pilote abandonne en pleine transaction : l'écriture abandonnée n'est jamais validée, la suivante l'est", async () => {
  const owner = await createOwner();
  const valuesA = validValues();
  const valuesB = validValues();
  const rentalA = await createRentalFor(owner, valuesA);
  const rentalB = await createRentalFor(owner, valuesB);

  // 1. Une écriture sur A attend un verrou de ligne plus longtemps que le
  //    pilote ne patiente : c'est lui qui abandonne, pas Postgres.
  let error: unknown;
  await withSeparateConnection(async (locker) => {
    await locker.query("BEGIN");
    try {
      await locker.query("SELECT id FROM rental WHERE id = $1 FOR UPDATE", [rentalA.id]);
      try {
        await updateRental(owner, rentalA.id, { ...valuesA, city: "Marseille" });
      } catch (caught) {
        error = caught;
      }
    } finally {
      // 2. Le verrou est levé : « la base reprend ».
      await locker.query("ROLLBACK");
    }
  });
  expect(error).toBeInstanceOf(RentalStoreError);
  await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_UNLOCK_IN_MS));

  // 3. La connexion que le pool fournit maintenant n'est pas dans une
  //    transaction restée ouverte. Postgres n'attribue un numéro de transaction
  //    qu'à une transaction qui a écrit : hors transaction, on lit null.
  const leftover = await getDb().execute<{ xid: string | null }>(
    sql`select pg_current_xact_id_if_assigned()::text as xid`,
  );
  expect.soft(leftover.rows[0].xid).toBeNull();

  // 4. L'écriture suivante de l'application, sur une autre location, réussit…
  expect(await updateRental(owner, rentalB.id, { ...valuesB, city: "Nantes" })).toBe(
    "updated",
  );

  // 5. … elle est réellement validée, et elle n'a pas validé avec elle
  //    l'écriture abandonnée.
  expect.soft(await readCommittedCity(rentalB.id)).toBe("Nantes");
  expect.soft(await readCommittedCity(rentalA.id)).toBe("Lyon");
});
