// Tests d'intégration des informations du bailleur (CA2 de la spécification
// 04, R1, R3, R21, R23), contre la base de test. Lancés par
// `pnpm test:integration`. Deux propriétaires, A et B, pour tout ce qui touche
// à l'isolation.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { Owner } from "../auth/current-owner";
import { closeDb, getDb } from "../db";
import { landlord } from "../db/schema";
import {
  BAILLEUR_TYPE,
  countRowsContaining,
  createOwner,
  type CreatedEmails,
  purgeOwners,
  readLandlordRow,
} from "../test-support/store-fixtures";
import {
  getLandlord,
  LandlordStoreError,
  saveLandlord,
} from "./landlord-store";
import {
  type LandlordValues,
  validateLandlordForm,
} from "./landlord-validation";

// Toute requête passe par Pool.query (lectures) ou Pool.connect (transactions
// d'écriture) : les espionner permet d'affirmer « aucune requête n'est partie ».
const querySpy = vi.spyOn(Pool.prototype, "query");
const connectSpy = vi.spyOn(Pool.prototype, "connect");

const createdEmails: CreatedEmails = [];

afterAll(async () => {
  await purgeOwners(createdEmails);
  await closeDb();
});

describe("CA2 — enregistrer, relire, remplacer les informations du bailleur", () => {
  it("rend les valeurs normalisées, les remplace au second enregistrement, et B reste « absentes »", async () => {
    const ownerA = await createOwner("ca2-bailleur-a", createdEmails);
    const ownerB = await createOwner("ca2-bailleur-b", createdEmails);

    expect(await getLandlord(ownerA)).toBeNull();
    expect(await getLandlord(ownerB)).toBeNull();

    // La normalisation est celle de la règle pure (T2) : la fonction d'accès
    // enregistre ce qu'elle rend.
    const validation = validateLandlordForm({
      name: "  Marie   Durand ",
      address: "3 rue de la Paix",
      addressComplement: "",
      postalCode: "75 002",
      city: " Paris ",
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    await saveLandlord(ownerA, validation.values);

    expect(await getLandlord(ownerA)).toEqual({
      name: "Marie Durand",
      address: "3 rue de la Paix",
      addressComplement: null,
      postalCode: "75002",
      city: "Paris",
    });
    // L'identifiant du compte ne sort pas du module.
    expect(await getLandlord(ownerA)).not.toHaveProperty("ownerId");
    // B n'a toujours rien.
    expect(await getLandlord(ownerB)).toBeNull();

    // Un second enregistrement remplace le premier : une seule ligne.
    const replacement: LandlordValues = {
      name: "SCI des Lilas",
      address: "8 avenue Foch",
      addressComplement: "Esc. C",
      postalCode: "69006",
      city: "Lyon",
    };
    await saveLandlord(ownerA, replacement);
    expect(await getLandlord(ownerA)).toEqual(replacement);
    const rows = await getDb()
      .select()
      .from(landlord)
      .where(eq(landlord.ownerId, ownerA.id));
    expect(rows).toHaveLength(1);

    // Enregistrer sans rien changer réussit (R3).
    await saveLandlord(ownerA, replacement);
    expect(await getLandlord(ownerA)).toEqual(replacement);

    // L'enregistrement de B ne change pas celles de A, et inversement.
    const beforeOfA = await readLandlordRow(ownerA.id);
    await saveLandlord(ownerB, BAILLEUR_TYPE);
    expect(await getLandlord(ownerB)).toEqual(BAILLEUR_TYPE);
    expect(await readLandlordRow(ownerA.id)).toEqual(beforeOfA);
    expect(await getLandlord(ownerA)).toEqual(replacement);
  });

  it("ignore tout champ inattendu : l'identifiant d'un autre compte ne désigne personne", async () => {
    const ownerA = await createOwner("ca2-champs-a", createdEmails);
    const ownerB = await createOwner("ca2-champs-b", createdEmails);
    await saveLandlord(ownerA, BAILLEUR_TYPE);
    const beforeOfA = await readLandlordRow(ownerA.id);
    // Ce qu'un formulaire falsifié pourrait faire arriver jusqu'ici.
    const forgedValues = {
      ...BAILLEUR_TYPE,
      name: "Bailleur B",
      ownerId: ownerA.id,
      owner_id: ownerA.id,
      id: ownerA.id,
    };

    await saveLandlord(ownerB, forgedValues);

    expect((await getLandlord(ownerB))?.name).toBe("Bailleur B");
    expect(await readLandlordRow(ownerA.id)).toEqual(beforeOfA);
  });
});

describe("CA2 — sans propriétaire, aucune requête ne part", () => {
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
    querySpy.mockClear();
    connectSpy.mockClear();

    await expect(getLandlord(owner)).rejects.toThrow("propriétaire manquant");
    await expect(saveLandlord(owner, BAILLEUR_TYPE)).rejects.toThrow(
      "propriétaire manquant",
    );

    expect(querySpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });
});

describe("R23 — la base refuse elle-même des informations hors des bornes de R1", () => {
  function insertDirectly(ownerId: string, overrides: object = {}) {
    return getDb()
      .insert(landlord)
      .values({ ownerId, ...BAILLEUR_TYPE, ...overrides });
  }

  it("témoin : la même écriture directe, avec des valeurs valides, est acceptée", async () => {
    const ownerA = await createOwner("r23-temoin", createdEmails);

    await insertDirectly(ownerA.id);

    expect(await getLandlord(ownerA)).toEqual(BAILLEUR_TYPE);
  });

  it.each([
    ["un nom vide", { name: "" }, "landlord_name_length"],
    ["un nom de 101 caractères", { name: "a".repeat(101) }, "landlord_name_length"],
    ["une adresse vide", { address: "" }, "landlord_address_length"],
    ["une adresse de 201 caractères", { address: "a".repeat(201) }, "landlord_address_length"],
    ["un complément vide", { addressComplement: "" }, "landlord_address_complement_length"],
    ["un complément de 101 caractères", { addressComplement: "a".repeat(101) }, "landlord_address_complement_length"],
    ["un code postal de 4 chiffres", { postalCode: "7501" }, "landlord_postal_code_format"],
    ["un code postal avec une espace", { postalCode: "75 002" }, "landlord_postal_code_format"],
    ["une ville vide", { city: "" }, "landlord_city_length"],
    ["une ville de 101 caractères", { city: "a".repeat(101) }, "landlord_city_length"],
    ["un compte qui n'existe pas", { ownerId: "compte-inexistant" }, "landlord_owner_id_user_id_fk"],
  ])("refuse %s", async (_description, overrides, constraint) => {
    const ownerA = await createOwner("r23-base", createdEmails);

    await expect(insertDirectly(ownerA.id, overrides)).rejects.toMatchObject({
      cause: { constraint },
    });

    expect(await getLandlord(ownerA)).toBeNull();
  });

  it("refuse un second jeu d'informations pour le même compte (R1)", async () => {
    const ownerA = await createOwner("r23-double", createdEmails);
    await insertDirectly(ownerA.id);

    // 23505 : violation d'unicité, ici celle de la clé primaire.
    await expect(insertDirectly(ownerA.id)).rejects.toMatchObject({
      cause: { code: "23505" },
    });
  });
});

describe("R37 — une erreur de base ne transporte aucune donnée du bailleur", () => {
  it("lève une LandlordStoreError sans le nom, sans l'adresse et sans cause, et n'écrit rien", async () => {
    const ownerA = await createOwner("r37-bailleur", createdEmails);
    const name = `Bailleur ${randomUUID()}`;
    const address = `Adresse ${randomUUID()}`;
    // Un code postal refusé par la base : la requête échoue.
    const refusedValues = { ...BAILLEUR_TYPE, name, address, postalCode: "7501" };

    const error: unknown = await saveLandlord(ownerA, refusedValues).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(LandlordStoreError);
    if (!(error instanceof LandlordStoreError)) return;
    expect(error.name).toBe("LandlordStoreError");
    expect(error.cause).toBeUndefined();
    const everythingLoggable = `${error.message}\n${error.stack}`;
    expect(everythingLoggable).not.toContain(name);
    expect(everythingLoggable).not.toContain(address);
    expect(everythingLoggable.toLowerCase()).not.toContain("insert");
    expect(await getLandlord(ownerA)).toBeNull();
    expect(await countRowsContaining(name)).toBe(0);
  });
});
