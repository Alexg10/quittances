// Test d'intégration du socle d'authentification (CA2, CA3, CA4 de la
// spécification 02), contre la base de test. Lancé par `pnpm test:integration`.
//
// Chaque test crée ses propres comptes, dans le domaine réservé quittances.test,
// avec une adresse unique à chaque exécution (R40) : il ne dépend ni d'une base
// vide, ni d'un autre test, ni de l'ordre d'exécution.

import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDb, getDb } from "../db";
import { account, user } from "../db/schema";
import { getAuth } from "./auth";
import { createAccount } from "./create-account";
import { getCurrentOwner } from "./current-owner";

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  maxAge?: number;
  path?: string;
};
type StoredCookie = { value: string; options: CookieOptions };

// Un navigateur réduit à sa boîte à cookies. vi.hoisted la crée avant vi.mock,
// qui est lui-même remonté en tête de fichier par Vitest.
const browser = vi.hoisted(() => ({
  cookies: new Map<string, StoredCookie>(),
}));

// Hors de Next, il n'y a pas de « requête en cours ». On remplace next/headers
// par ce que ferait un navigateur : cookies() range les cookies posés par le
// serveur, headers() les renvoie dans l'en-tête Cookie de la requête suivante.
// Tout le reste est réel : Better Auth, Drizzle, Postgres.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set(name: string, value: string, options: CookieOptions = {}) {
      // Un cookie posé avec une durée nulle est un cookie supprimé.
      if (options.maxAge === 0) {
        browser.cookies.delete(name);
      } else {
        browser.cookies.set(name, { value, options });
      }
    },
  }),
  headers: async () => {
    const cookieHeader = [...browser.cookies]
      .map(([name, cookie]) => `${name}=${encodeURIComponent(cookie.value)}`)
      .join("; ");
    return new Headers(cookieHeader ? { cookie: cookieHeader } : {});
  },
}));

const SESSION_COOKIE = "better-auth.session_token";
const SIXTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 60;

const createdEmails: string[] = [];

// Adresse unique à chaque appel, déjà normalisée.
function uniqueEmail(prefix: string): string {
  const email = `${prefix}-${randomUUID()}@quittances.test`;
  createdEmails.push(email);
  return email;
}

// Mot de passe unique : on peut le chercher dans la base sans faux positif.
function uniquePassword(): string {
  return `MotDePasse-${randomUUID()}`;
}

async function countAccounts(email: string): Promise<number> {
  const rows = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return rows.length;
}

// Nombre de lignes, toutes tables confondues, dont une colonne contient `needle`.
// `ligne::text` est la représentation texte de la ligne entière.
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

beforeEach(() => {
  // Chaque test part d'un navigateur sans cookie.
  browser.cookies.clear();
});

afterAll(async () => {
  // Les comptes de quittances.test sont purgeables à tout moment (R40) : on ne
  // retire que ceux de cette exécution. Sessions et mots de passe hachés
  // partent avec eux (suppression en cascade).
  if (createdEmails.length > 0) {
    await getDb().delete(user).where(inArray(user.email, createdEmails));
  }
  await closeDb();
});

describe("CA2 — compte, session et propriétaire courant", () => {
  it("renvoie le compte créé tant que la session est ouverte, puis plus personne après sa fermeture, même avec le même jeton", async () => {
    const email = uniqueEmail("prenom.nom");
    const password = uniquePassword();
    // Saisie avec majuscules et espaces : c'est la forme normalisée qui compte.
    const typedEmail = `  ${email.toUpperCase()} `;

    expect(await createAccount(typedEmail, password)).toBe("created");

    // Nouveau navigateur : on ouvre une session par la connexion.
    browser.cookies.clear();
    expect(await getCurrentOwner()).toBeNull();
    await getAuth().api.signInEmail({ body: { email, password } });

    const owner = await getCurrentOwner();
    expect(owner).not.toBeNull();
    expect(owner?.email).toBe(email);
    const rows = await getDb()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    expect(owner?.id).toBe(rows[0].id);

    // On relève le cookie avant de fermer la session, comme le ferait un
    // attaquant qui l'aurait copié.
    const stolenCookie = browser.cookies.get(SESSION_COOKIE);
    expect(stolenCookie).toBeDefined();

    const { headers } = await import("next/headers");
    await getAuth().api.signOut({ headers: await headers() });
    expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
    expect(await getCurrentOwner()).toBeNull();

    // Le même jeton, présenté à nouveau, est refusé : la session n'existe plus
    // sur le serveur.
    if (stolenCookie) {
      browser.cookies.set(SESSION_COOKIE, stolenCookie);
    }
    expect(await getCurrentOwner()).toBeNull();
  });

  it("ne reconnaît pas un jeton inventé", async () => {
    browser.cookies.set(SESSION_COOKIE, {
      value: "jeton-invente.signature-inventee",
      options: {},
    });

    expect(await getCurrentOwner()).toBeNull();
  });

  it("pose un cookie de session conforme à R16 et R17", async () => {
    const email = uniqueEmail("cookie");

    expect(await createAccount(email, uniquePassword())).toBe("created");

    const cookie = browser.cookies.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.options.httpOnly).toBe(true);
    expect(cookie?.options.sameSite).toBe("lax");
    expect(cookie?.options.maxAge).toBe(SIXTY_DAYS_IN_SECONDS);
    // Il ne contient qu'un jeton : ni l'adresse, ni son début.
    expect(cookie?.value).not.toContain(email);
    expect(cookie?.value).not.toContain("quittances.test");
  });
});

describe("CA3 — le mot de passe n'est enregistré nulle part en clair", () => {
  it("ne retrouve le mot de passe dans aucune table de la base", async () => {
    const email = uniqueEmail("hachage");
    const password = uniquePassword();

    expect(await createAccount(email, password)).toBe("created");

    // Témoin : la recherche trouve bien ce qui est enregistré en clair.
    expect(await countRowsContaining(email)).toBeGreaterThan(0);
    // Le mot de passe, lui, n'apparaît nulle part.
    expect(await countRowsContaining(password)).toBe(0);

    // Et il existe bien un hachage, différent du mot de passe.
    const rows = await getDb()
      .select({ hash: account.password })
      .from(account)
      .innerJoin(user, eq(account.userId, user.id))
      .where(eq(user.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0].hash).toBeTruthy();
    expect(rows[0].hash).not.toContain(password);
  });
});

describe("CA4 — unicité de l'adresse normalisée", () => {
  it("refuse une seconde inscription avec la même adresse, écrite autrement", async () => {
    const email = uniqueEmail("marie");
    const firstPassword = uniquePassword();

    expect(await createAccount(email, firstPassword)).toBe("created");
    browser.cookies.clear();

    const sameEmailTypedDifferently = ` ${email.replace("marie", "Marie").replace("quittances", "Quittances")} `;
    expect(
      await createAccount(sameEmailTypedDifferently, uniquePassword()),
    ).toBe("email-already-used");

    expect(await countAccounts(email)).toBe(1);
    // Le refus n'a ouvert aucune session.
    expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
    // Le compte d'origine n'a pas été modifié : son mot de passe fonctionne encore.
    await expect(
      getAuth().api.signInEmail({ body: { email, password: firstPassword } }),
    ).resolves.toBeDefined();
  });

  it("ne crée qu'un compte quand deux inscriptions arrivent en même temps", async () => {
    const email = uniqueEmail("simultane");

    const results = await Promise.all([
      createAccount(email, uniquePassword()),
      createAccount(email, uniquePassword()),
    ]);

    expect([...results].sort()).toEqual(["created", "email-already-used"]);
    expect(await countAccounts(email)).toBe(1);
  });

  it("est garantie par la base elle-même, sans passer par le code applicatif", async () => {
    const email = uniqueEmail("contrainte");
    const db = getDb();
    await db.insert(user).values({ id: randomUUID(), name: "", email });

    // Contrainte d'unicité : même adresse, autre identifiant.
    await expect(
      db.insert(user).values({ id: randomUUID(), name: "", email }),
    ).rejects.toThrow();
    // Contrainte de forme : une adresse non normalisée ne peut pas être enregistrée.
    await expect(
      db
        .insert(user)
        .values({ id: randomUUID(), name: "", email: email.toUpperCase() }),
    ).rejects.toThrow();
    await expect(
      db.insert(user).values({ id: randomUUID(), name: "", email: ` ${email}` }),
    ).rejects.toThrow();

    expect(await countAccounts(email)).toBe(1);
  });
});
