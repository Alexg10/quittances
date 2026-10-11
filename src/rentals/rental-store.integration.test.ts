// Tests d'intégration des fonctions d'accès aux locations (CA2 à CA5, CA8 et
// CA9 de la spécification 03), contre la base de test. Lancés par
// `pnpm test:integration`.
//
// Chaque test crée ses propres comptes (domaine quittances.test, adresse unique
// à chaque exécution) et ses propres locations, avec des données fictives. Il
// ne vérifie que les locations de ses comptes : il ne dépend ni d'une base
// vide, ni d'un autre test (R44). Chaque critère d'isolation met en jeu deux
// propriétaires, A et B, et vérifie à la fois ce que B obtient et que les
// données de A sont intactes.

import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { Owner } from "../auth/current-owner";
import { closeDb, getDb } from "../db";
import { rental, user } from "../db/schema";
import {
  createRental,
  deleteRental,
  getRental,
  listRentals,
  MAX_RENTALS_PER_OWNER,
  type Rental,
  type RentalValues,
  reopenRental,
  RentalStoreError,
  setRentalEndDate,
  updateRental,
} from "./rental-store";

// Toute requête de Drizzle passe par Pool.query : l'espionner permet d'affirmer
// qu'« aucune requête n'est partie ». La méthode réelle reste appelée.
const querySpy = vi.spyOn(Pool.prototype, "query");

const createdEmails: string[] = [];

// Un compte de test, inséré directement : ces tests ne portent pas sur
// l'authentification. En production, un Owner ne vient que de getCurrentOwner().
async function createOwner(prefix: string): Promise<Owner> {
  const owner = {
    id: randomUUID(),
    email: `${prefix}-${randomUUID()}@quittances.test`,
  };
  createdEmails.push(owner.email);
  await getDb().insert(user).values({ id: owner.id, name: "", email: owner.email });
  return owner;
}

// Des valeurs valides et déjà normalisées, comme la validation (T2) les rendra.
function validValues(overrides: Partial<RentalValues> = {}): RentalValues {
  return {
    address: "12 rue des Lilas",
    addressComplement: "Bât. B",
    postalCode: "69003",
    city: "Lyon",
    tenantName: "Paul Martin",
    tenantEmail: `paul.martin-${randomUUID()}@quittances.test`,
    rentInCents: 125050,
    chargesInCents: 0,
    dueDay: 5,
    startDate: "2026-01-05",
    ...overrides,
  };
}

async function createRentalFor(
  owner: Owner,
  overrides: Partial<RentalValues> = {},
): Promise<Rental> {
  const result = await createRental(owner, validValues(overrides));
  if (result.status !== "created") {
    throw new Error("La location de préparation n'a pas été créée.");
  }
  return result.rental;
}

// Écriture directe en base, sans passer par les fonctions d'accès : sert à
// vérifier ce que la base refuse d'elle-même.
function insertDirectly(ownerId: string, overrides: object = {}) {
  return getDb()
    .insert(rental)
    .values({ ownerId, ...validValues(), ...overrides });
}

async function countRentalsInDatabase(ownerId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: rental.id })
    .from(rental)
    .where(eq(rental.ownerId, ownerId));
  return rows.length;
}

// Nombre de lignes, toutes tables confondues, dont une colonne contient `needle`.
async function countRowsContaining(needle: string): Promise<number> {
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

afterAll(async () => {
  // Les comptes de cette exécution, et eux seuls. Leurs locations partent avec
  // eux (suppression en cascade).
  if (createdEmails.length > 0) {
    await getDb().delete(user).where(inArray(user.email, createdEmails));
  }
  await closeDb();
});

describe("CA2 — créer, relire, lister", () => {
  it("rend les valeurs enregistrées, sans date de fin, et la liste ne contient que cette location", async () => {
    const ownerA = await createOwner("ca2-a");
    const values = validValues();

    const result = await createRental(ownerA, values);

    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    // Identifiant généré par le système, sous la forme canonique (R6), version 4.
    expect(result.rental.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const read = await getRental(ownerA, result.rental.id);
    expect(read).toEqual({
      ...values,
      id: result.rental.id,
      endDate: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    // Montants en centimes entiers, date rendue telle quelle, sans fuseau.
    expect(read?.rentInCents).toBe(125050);
    expect(read?.chargesInCents).toBe(0);
    expect(read?.dueDay).toBe(5);
    expect(read?.startDate).toBe("2026-01-05");
    // L'identifiant du propriétaire ne sort pas du module.
    expect(read).not.toHaveProperty("ownerId");
    expect(result.rental).toEqual(read);

    expect(await listRentals(ownerA)).toEqual([read]);
  });

  it("enregistre l'absence de complément d'adresse comme une absence", async () => {
    const ownerA = await createOwner("ca2-complement");

    const created = await createRentalFor(ownerA, { addressComplement: null });

    expect((await getRental(ownerA, created.id))?.addressComplement).toBeNull();
  });

  it("liste les locations de la plus ancienne à la plus récente", async () => {
    const ownerA = await createOwner("ca2-ordre");
    const first = await createRentalFor(ownerA, { address: "1 rue Première" });
    const second = await createRentalFor(ownerA, { address: "2 rue Deuxième" });
    const third = await createRentalFor(ownerA, { address: "3 rue Troisième" });

    // Une modification ne déplace rien (R35).
    await updateRental(ownerA, first.id, validValues({ address: "1 rue Modifiée" }));

    const listed = await listRentals(ownerA);
    expect(listed.map((item) => item.id)).toEqual([first.id, second.id, third.id]);
  });

  it("ignore tout champ inattendu : propriétaire, identifiant, date de fin", async () => {
    const ownerA = await createOwner("ca2-champs-a");
    const ownerB = await createOwner("ca2-champs-b");
    const existingOfA = await createRentalFor(ownerA);
    // Ce qu'un formulaire falsifié pourrait faire arriver jusqu'ici.
    const forgedValues = {
      ...validValues(),
      ownerId: ownerA.id,
      owner_id: ownerA.id,
      id: existingOfA.id,
      endDate: "2026-06-30",
    };

    const result = await createRental(ownerB, forgedValues);

    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    expect(result.rental.id).not.toBe(existingOfA.id);
    expect(result.rental.endDate).toBeNull();
    expect((await listRentals(ownerB)).map((item) => item.id)).toEqual([
      result.rental.id,
    ]);
    // A n'a rien gagné, et sa location est intacte.
    expect(await listRentals(ownerA)).toEqual([existingOfA]);
  });
});

describe("CA3 — B ne lit pas et ne liste pas la location de A", () => {
  it("rend à B la même chose que pour un identifiant inconnu, et A retrouve sa location", async () => {
    const ownerA = await createOwner("ca3-a");
    const ownerB = await createOwner("ca3-b");
    const rentalOfA = await createRentalFor(ownerA);
    const rentalOfB = await createRentalFor(ownerB);

    const readByB = await getRental(ownerB, rentalOfA.id);
    const unknownForB = await getRental(ownerB, randomUUID());

    expect(readByB).toBeNull();
    expect(readByB).toStrictEqual(unknownForB);

    // La liste de B ne contient que la sienne.
    expect(await listRentals(ownerB)).toEqual([rentalOfB]);

    // Témoin : la location existe bien, et A la lit intacte.
    expect(await getRental(ownerA, rentalOfA.id)).toEqual(rentalOfA);
    expect(await listRentals(ownerA)).toEqual([rentalOfA]);
  });
});

describe("CA4 — B ne modifie pas, ne termine pas, ne rouvre pas et ne supprime pas la location de A", () => {
  it("rend « introuvable » à chaque tentative et laisse la location de A identique champ par champ", async () => {
    const ownerA = await createOwner("ca4-a");
    const ownerB = await createOwner("ca4-b");
    const created = await createRentalFor(ownerA);
    // Avec une date de fin : une réouverture par B, si elle passait, se verrait.
    await setRentalEndDate(ownerA, created.id, "2026-06-30");
    const before = await getRental(ownerA, created.id);
    expect(before?.endDate).toBe("2026-06-30");
    const rentalOfB = await createRentalFor(ownerB);
    const unknownId = randomUUID();
    const otherValues = validValues({
      address: "99 avenue de B",
      tenantName: "Locataire de B",
      rentInCents: 1,
    });

    // Chaque tentative de B, puis A relit sa location.
    expect(await updateRental(ownerB, created.id, otherValues)).toBe("not-found");
    expect(await getRental(ownerA, created.id)).toEqual(before);

    expect(await setRentalEndDate(ownerB, created.id, "2027-12-31")).toBe(
      "not-found",
    );
    expect(await getRental(ownerA, created.id)).toEqual(before);

    expect(await reopenRental(ownerB, created.id)).toBe("not-found");
    expect(await getRental(ownerA, created.id)).toEqual(before);

    expect(await deleteRental(ownerB, created.id)).toBe("not-found");
    // Identique champ par champ, date de dernière modification comprise.
    expect(await getRental(ownerA, created.id)).toEqual(before);
    expect(await listRentals(ownerA)).toEqual([before]);

    // Le résultat est le même que pour un identifiant inconnu.
    expect(await updateRental(ownerB, unknownId, otherValues)).toBe("not-found");
    expect(await setRentalEndDate(ownerB, unknownId, "2027-12-31")).toBe(
      "not-found",
    );
    expect(await reopenRental(ownerB, unknownId)).toBe("not-found");
    expect(await deleteRental(ownerB, unknownId)).toBe("not-found");

    // Les tentatives de B n'ont pas non plus touché sa propre location.
    expect(await listRentals(ownerB)).toEqual([rentalOfB]);
  });

  it("témoin : les mêmes appels, faits par A, écrivent bien", async () => {
    const ownerA = await createOwner("ca4-temoin");
    const created = await createRentalFor(ownerA);
    const newValues = validValues({ address: "7 place Neuve", rentInCents: 90000 });

    expect(await setRentalEndDate(ownerA, created.id, "2026-06-30")).toBe("updated");
    expect((await getRental(ownerA, created.id))?.endDate).toBe("2026-06-30");

    // La modification remplace les dix valeurs et ne touche pas la date de fin.
    expect(await updateRental(ownerA, created.id, newValues)).toBe("updated");
    const updated = await getRental(ownerA, created.id);
    expect(updated).toMatchObject({ ...newValues, endDate: "2026-06-30" });
    expect(updated?.createdAt).toEqual(created.createdAt);
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(
      created.updatedAt.getTime(),
    );

    expect(await reopenRental(ownerA, created.id)).toBe("updated");
    expect((await getRental(ownerA, created.id))?.endDate).toBeNull();
    // Rouvrir une location sans date de fin : aucune erreur (R29).
    expect(await reopenRental(ownerA, created.id)).toBe("updated");

    expect(await deleteRental(ownerA, created.id)).toBe("deleted");
    expect(await getRental(ownerA, created.id)).toBeNull();
    // Supprimer une location déjà supprimée : introuvable.
    expect(await deleteRental(ownerA, created.id)).toBe("not-found");
  });
});

describe("R6 — un identifiant mal formé est une location introuvable, sans requête", () => {
  it("rend « introuvable » sans interroger la base, même pour le propriétaire de la location", async () => {
    const ownerA = await createOwner("r6-a");
    const created = await createRentalFor(ownerA);
    const malformedIds = [
      created.id.toUpperCase(),
      `{${created.id}}`,
      created.id.replaceAll("-", ""),
      ` ${created.id}`,
      `${created.id}\n`,
      encodeURIComponent(`${created.id} `),
      "1",
      "",
      "a".repeat(10_000),
      "../",
      "' or 1=1 --",
      `${created.id}' or '1'='1`,
    ];

    querySpy.mockClear();
    for (const malformedId of malformedIds) {
      expect(await getRental(ownerA, malformedId)).toBeNull();
      expect(await updateRental(ownerA, malformedId, validValues())).toBe(
        "not-found",
      );
      expect(await setRentalEndDate(ownerA, malformedId, "2026-06-30")).toBe(
        "not-found",
      );
      expect(await reopenRental(ownerA, malformedId)).toBe("not-found");
      expect(await deleteRental(ownerA, malformedId)).toBe("not-found");
    }
    expect(querySpy).not.toHaveBeenCalled();

    // Témoin : l'espion voit bien les requêtes, et la location est intacte.
    expect(await getRental(ownerA, created.id)).toEqual(created);
    expect(querySpy).toHaveBeenCalled();
  });
});

describe("CA5 — sans propriétaire, aucune requête ne part", () => {
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

    await expect(createRental(owner, validValues())).rejects.toThrow(
      "propriétaire manquant",
    );
    await expect(listRentals(owner)).rejects.toThrow("propriétaire manquant");
    await expect(getRental(owner, someId)).rejects.toThrow(
      "propriétaire manquant",
    );
    await expect(updateRental(owner, someId, validValues())).rejects.toThrow(
      "propriétaire manquant",
    );
    await expect(setRentalEndDate(owner, someId, "2026-06-30")).rejects.toThrow(
      "propriétaire manquant",
    );
    await expect(reopenRental(owner, someId)).rejects.toThrow(
      "propriétaire manquant",
    );
    await expect(deleteRental(owner, someId)).rejects.toThrow(
      "propriétaire manquant",
    );
    // Le propriétaire est contrôlé avant l'identifiant : même mal formé.
    await expect(getRental(owner, "1")).rejects.toThrow("propriétaire manquant");

    expect(querySpy).not.toHaveBeenCalled();
  });
});

describe("CA5 — la base refuse elle-même les valeurs hors bornes", () => {
  it("témoin : la même écriture directe, avec des valeurs valides, est acceptée", async () => {
    const ownerA = await createOwner("ca5-temoin");

    await insertDirectly(ownerA.id);

    expect(await countRentalsInDatabase(ownerA.id)).toBe(1);
  });

  it.each([
    ["un loyer de 0", { rentInCents: 0 }, "rental_rent_in_cents_range"],
    ["un loyer négatif", { rentInCents: -1 }, "rental_rent_in_cents_range"],
    ["un loyer de 100 000 €", { rentInCents: 10_000_000 }, "rental_rent_in_cents_range"],
    ["des charges négatives", { chargesInCents: -1 }, "rental_charges_in_cents_range"],
    ["des charges de 100 000 €", { chargesInCents: 10_000_000 }, "rental_charges_in_cents_range"],
    ["un jour 32", { dueDay: 32 }, "rental_due_day_range"],
    ["un jour 0", { dueDay: 0 }, "rental_due_day_range"],
    [
      "une date de fin antérieure au début",
      { startDate: "2026-01-05", endDate: "2026-01-04" },
      "rental_end_date_not_before_start_date",
    ],
    [
      "une adresse e-mail en majuscules",
      { tenantEmail: "Paul.Martin@Quittances.test" },
      "rental_tenant_email_normalized",
    ],
    [
      "une adresse e-mail entourée d'espaces",
      { tenantEmail: " paul.martin@quittances.test " },
      "rental_tenant_email_normalized",
    ],
    ["une adresse vide", { address: "" }, "rental_address_length"],
    ["une adresse de 201 caractères", { address: "a".repeat(201) }, "rental_address_length"],
    ["un complément vide", { addressComplement: "" }, "rental_address_complement_length"],
    ["un code postal de 4 chiffres", { postalCode: "7501" }, "rental_postal_code_format"],
    ["une ville vide", { city: "" }, "rental_city_length"],
    ["un nom de locataire de 101 caractères", { tenantName: "a".repeat(101) }, "rental_tenant_name_length"],
    ["une date de début en 1949", { startDate: "1949-12-31" }, "rental_start_date_range"],
    [
      "une date de fin en 2100",
      { endDate: "2100-01-01" },
      "rental_end_date_range",
    ],
    [
      "un propriétaire qui n'existe pas",
      { ownerId: "compte-inexistant" },
      "rental_owner_id_user_id_fk",
    ],
  ])("refuse %s", async (_description, overrides, constraint) => {
    const ownerA = await createOwner("ca5-base");

    // L'erreur de Drizzle porte celle de Postgres en `cause`, avec le nom de
    // la contrainte violée : c'est bien cette règle qui a refusé l'écriture.
    await expect(insertDirectly(ownerA.id, overrides)).rejects.toMatchObject({
      cause: { constraint },
    });

    expect(await countRentalsInDatabase(ownerA.id)).toBe(0);
  });

  it("refuse une location sans propriétaire", async () => {
    // 23502 : violation de NOT NULL.
    await expect(
      insertDirectly("", { ownerId: sql`null` }),
    ).rejects.toMatchObject({ cause: { code: "23502", column: "owner_id" } });
  });

  it("accepte une date de fin égale à la date de début (bail d'un jour)", async () => {
    const ownerA = await createOwner("ca5-un-jour");
    const created = await createRentalFor(ownerA, { startDate: "2026-01-05" });

    expect(await setRentalEndDate(ownerA, created.id, "2026-01-05")).toBe("updated");
  });
});

describe("R43 — une erreur de base ne transporte aucune donnée de locataire", () => {
  it("lève une RentalStoreError sans le nom, sans l'adresse e-mail et sans cause", async () => {
    const ownerA = await createOwner("r43-a");
    const tenantName = `Locataire ${randomUUID()}`;
    const tenantEmail = `locataire-${randomUUID()}@quittances.test`;
    // Un loyer nul : la base refuse, la requête échoue.
    const refusedValues = validValues({ tenantName, tenantEmail, rentInCents: 0 });

    const error: unknown = await createRental(ownerA, refusedValues).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(RentalStoreError);
    if (!(error instanceof RentalStoreError)) return;
    expect(error.name).toBe("RentalStoreError");
    expect(error.cause).toBeUndefined();
    // Ce qu'un journal écrirait de pire : le message et la pile.
    const everythingLoggable = `${error.message}\n${error.stack}`;
    expect(everythingLoggable).not.toContain(tenantName);
    expect(everythingLoggable).not.toContain(tenantEmail);
    expect(everythingLoggable).not.toContain("quittances.test");
    expect(await listRentals(ownerA)).toEqual([]);
  });
});

describe("CA8 — au plus 100 locations par compte", () => {
  it("refuse la 101e, l'accepte après une suppression, et ne gêne pas un autre compte", async () => {
    const ownerA = await createOwner("ca8-a");
    const ownerB = await createOwner("ca8-b");
    await createRentalFor(ownerB);
    // Préparation directe, en une requête (R44, point 4).
    await getDb()
      .insert(rental)
      .values(
        Array.from({ length: MAX_RENTALS_PER_OWNER }, () => ({
          ownerId: ownerA.id,
          ...validValues(),
        })),
      );
    expect(MAX_RENTALS_PER_OWNER).toBe(100);
    expect(await listRentals(ownerA)).toHaveLength(100);

    // La 101e est refusée, rien n'est créé.
    expect(await createRental(ownerA, validValues())).toEqual({
      status: "limit-reached",
    });
    const rentalsOfA = await listRentals(ownerA);
    expect(rentalsOfA).toHaveLength(100);

    // Une location supprimée ne compte plus.
    expect(await deleteRental(ownerA, rentalsOfA[0].id)).toBe("deleted");
    expect((await createRental(ownerA, validValues())).status).toBe("created");
    expect(await listRentals(ownerA)).toHaveLength(100);
    expect((await createRental(ownerA, validValues())).status).toBe(
      "limit-reached",
    );

    // La limite de A ne concerne pas B.
    expect((await createRental(ownerB, validValues())).status).toBe("created");
    expect(await listRentals(ownerB)).toHaveLength(2);
  });
});

describe("CA9 — suppression réelle, et disparition avec le compte", () => {
  it("ne laisse nulle part dans la base le nom ni l'adresse e-mail du locataire", async () => {
    const ownerA = await createOwner("ca9-a");
    const tenantName = `Locataire ${randomUUID()}`;
    const tenantEmail = `locataire-${randomUUID()}@quittances.test`;
    const created = await createRentalFor(ownerA, { tenantName, tenantEmail });
    const kept = await createRentalFor(ownerA);

    // Témoin : la recherche trouve bien ce qui est enregistré.
    expect(await countRowsContaining(tenantName)).toBe(1);
    expect(await countRowsContaining(tenantEmail)).toBe(1);

    expect(await deleteRental(ownerA, created.id)).toBe("deleted");

    expect(await countRowsContaining(tenantName)).toBe(0);
    expect(await countRowsContaining(tenantEmail)).toBe(0);
    // L'autre location du compte est intacte.
    expect(await listRentals(ownerA)).toEqual([kept]);
  });

  it("supprime les locations d'un compte avec lui, et pas celles des autres", async () => {
    const ownerA = await createOwner("ca9-compte-a");
    const ownerB = await createOwner("ca9-compte-b");
    const tenantNameOfA = `Locataire ${randomUUID()}`;
    await createRentalFor(ownerA, { tenantName: tenantNameOfA });
    await createRentalFor(ownerA);
    const rentalOfB = await createRentalFor(ownerB);
    expect(await countRentalsInDatabase(ownerA.id)).toBe(2);

    // La ligne du compte est supprimée directement en base de test.
    await getDb().delete(user).where(eq(user.id, ownerA.id));

    expect(await countRentalsInDatabase(ownerA.id)).toBe(0);
    expect(await countRowsContaining(tenantNameOfA)).toBe(0);
    expect(await listRentals(ownerA)).toEqual([]);
    // Celles de B sont intactes.
    expect(await listRentals(ownerB)).toEqual([rentalOfB]);
  });
});
