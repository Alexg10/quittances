// Préparation commune aux tests d'intégration des quittances et de l'archivage
// (spécification 04), contre la base de test. Données fictives, comptes du
// domaine quittances.test à adresse unique : un test ne dépend ni d'une base
// vide ni d'un autre test (R38).
import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { Client } from "pg";

import type { Owner } from "../auth/current-owner";
import { getDb } from "../db";
import { landlord, receipt, rental, user } from "../db/schema";
import { requireEnv } from "../env";
import type { LandlordValues } from "../receipts/landlord-validation";
import { saveLandlord } from "../receipts/landlord-store";
import {
  produceReceipt,
  type Receipt,
  type ReceiptInput,
} from "../receipts/receipt-store";
import {
  createRental,
  type Rental,
  type RentalValues,
} from "../rentals/rental-store";

// « Bailleur type » de la spécification 04.
export const BAILLEUR_TYPE: LandlordValues = {
  name: "Marie Durand",
  address: "3 rue de la Paix",
  addressComplement: null,
  postalCode: "75002",
  city: "Paris",
};

// Un instant où la « location type » (bail du 15/01/2026 au 20/03/2026) est
// terminée et où ses trois mois sont acceptés : le 12/10/2026 à midi, à Paris.
export const LE_12_OCTOBRE = new Date("2026-10-12T10:00:00Z");

// Les adresses des comptes créés par un fichier de test : chaque fichier en
// tient la liste et les supprime à la fin (purgeOwners).
export type CreatedEmails = string[];

// Un compte de test, inséré directement : ces tests ne portent pas sur
// l'authentification. En production, un Owner ne vient que de getCurrentOwner().
export async function createOwner(
  prefix: string,
  createdEmails: CreatedEmails,
): Promise<Owner> {
  const owner = {
    id: randomUUID(),
    email: `${prefix}-${randomUUID()}@quittances.test`,
  };
  createdEmails.push(owner.email);
  await getDb().insert(user).values({ id: owner.id, name: "", email: owner.email });
  return owner;
}

// Supprime les comptes de cette exécution, et eux seuls. Leurs locations, leurs
// quittances et leurs informations de bailleur partent avec eux (R20).
export async function purgeOwners(createdEmails: CreatedEmails): Promise<void> {
  if (createdEmails.length > 0) {
    await getDb().delete(user).where(inArray(user.email, createdEmails));
  }
}

// Les valeurs de la « location type » : bail qui commence le 15/01/2026, loyer
// 850,00 €, charges 50,00 €. Sa date de fin (20/03/2026) est posée par
// insertTypeRental.
export function rentalValues(overrides: Partial<RentalValues> = {}): RentalValues {
  return {
    address: "12 rue des Lilas",
    addressComplement: "Bât. B",
    postalCode: "69003",
    city: "Lyon",
    tenantName: "Paul Martin",
    tenantEmail: `paul.martin-${randomUUID()}@quittances.test`,
    rentInCents: 85000,
    chargesInCents: 5000,
    dueDay: 5,
    startDate: "2026-01-15",
    ...overrides,
  };
}

// Insère une location directement, avec la date de fin et la date d'archivage
// voulues : c'est la préparation « sans interface » que R38 autorise.
export async function insertRental(
  owner: Owner,
  overrides: Partial<RentalValues> & {
    endDate?: string | null;
    archivedAt?: Date | null;
  } = {},
): Promise<string> {
  const [row] = await getDb()
    .insert(rental)
    .values({ ownerId: owner.id, ...rentalValues(), ...overrides })
    .returning({ id: rental.id });
  return row.id;
}

// Une location créée par la fonction d'accès, sans date de fin.
export async function createRentalFor(
  owner: Owner,
  overrides: Partial<RentalValues> = {},
): Promise<Rental> {
  const result = await createRental(owner, rentalValues(overrides));
  if (result.status !== "created") {
    throw new Error("La location de préparation n'a pas été créée.");
  }
  return result.rental;
}

// La « location type », terminée le 20/03/2026.
export async function insertTypeRental(
  owner: Owner,
  overrides: Partial<RentalValues> = {},
): Promise<string> {
  return insertRental(owner, { endDate: "2026-03-20", ...overrides });
}

// Un compte avec le bailleur type.
export async function createOwnerWithLandlord(
  prefix: string,
  createdEmails: CreatedEmails,
  overrides: Partial<LandlordValues> = {},
): Promise<Owner> {
  const owner = await createOwner(prefix, createdEmails);
  await saveLandlord(owner, { ...BAILLEUR_TYPE, ...overrides });
  return owner;
}

export function receiptInput(overrides: Partial<ReceiptInput> = {}): ReceiptInput {
  return {
    month: "2026-01",
    rentInCents: 42550,
    chargesInCents: 0,
    paymentDate: "2026-01-20",
    ...overrides,
  };
}

// Produit une quittance de préparation, et échoue clairement si elle ne l'est pas.
export async function produceFor(
  owner: Owner,
  rentalId: string,
  month: string,
): Promise<Receipt> {
  const result = await produceReceipt(
    owner,
    rentalId,
    receiptInput({ month, paymentDate: `${month}-20` }),
    LE_12_OCTOBRE,
  );
  if (result.status !== "produced") {
    throw new Error(
      `La quittance de préparation n'a pas été produite (${result.status}).`,
    );
  }
  return result.receipt;
}

// --- Lectures directes, sans passer par les fonctions d'accès ----------------

// Toutes les colonnes d'une location, date d'archivage et date de dernière
// modification comprises : sert à affirmer « identique champ par champ ».
export async function readRentalRow(rentalId: string) {
  const rows = await getDb().select().from(rental).where(eq(rental.id, rentalId));
  return rows[0];
}

export async function readReceiptRows(rentalId: string) {
  return getDb()
    .select()
    .from(receipt)
    .where(eq(receipt.rentalId, rentalId))
    .orderBy(receipt.month);
}

export async function countReceiptsOfOwner(ownerId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: receipt.id })
    .from(receipt)
    .where(eq(receipt.ownerId, ownerId));
  return rows.length;
}

export async function countRentalsOfOwner(ownerId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: rental.id })
    .from(rental)
    .where(eq(rental.ownerId, ownerId));
  return rows.length;
}

export async function readLandlordRow(ownerId: string) {
  const rows = await getDb()
    .select()
    .from(landlord)
    .where(eq(landlord.ownerId, ownerId));
  return rows[0];
}

// Nombre de lignes, toutes tables confondues, dont une colonne contient `needle`.
export async function countRowsContaining(needle: string): Promise<number> {
  const db = getDb();
  const tables = await db.execute<{ schema: string; name: string }>(sql`
    select table_schema as schema, table_name as name
    from information_schema.tables
    where table_type = 'BASE TABLE'
      and table_schema not in ('pg_catalog', 'information_schema')
  `);
  let total = 0;
  for (const table of tables.rows) {
    const result = await db.execute<{ n: number }>(sql`
      select count(*)::int as n
      from ${sql.identifier(table.schema)}.${sql.identifier(table.name)} as ligne
      where position(${needle} in ligne::text) > 0
    `);
    total += result.rows[0].n;
  }
  return total;
}

// --- Verrou tenu par une seconde connexion -----------------------------------

// Les requêtes de verrouillage, écrites en entier : le nom de la table n'est
// jamais assemblé à partir d'une variable.
const LOCK_ROW_QUERY = {
  rental: "SELECT id FROM rental WHERE id = $1 FOR UPDATE",
  user: 'SELECT id FROM "user" WHERE id = $1 FOR UPDATE',
  landlord: "SELECT owner_id FROM landlord WHERE owner_id = $1 FOR UPDATE",
};

// Exécute `during` pendant qu'une seconde connexion tient le verrou d'UNE ligne
// (jamais un verrou de table : les autres fichiers, qui tournent en parallèle,
// ne sont pas ralentis). Le verrou est levé et la connexion fermée quoi qu'il
// arrive.
export async function whileRowIsLocked<Result>(
  table: keyof typeof LOCK_ROW_QUERY,
  rowId: string,
  during: () => Promise<Result>,
): Promise<Result> {
  // vitest.integration.setup.ts a remplacé DATABASE_URL par la base de test.
  const locker = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await locker.connect();
  try {
    await locker.query("BEGIN");
    await locker.query(LOCK_ROW_QUERY[table], [rowId]);
    return await during();
  } finally {
    try {
      // ROLLBACK lève le verrou : cette transaction n'a rien écrit.
      await locker.query("ROLLBACK");
    } finally {
      await locker.end();
    }
  }
}

export function wait(durationInMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationInMs));
}
