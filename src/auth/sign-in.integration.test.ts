// Test d'intégration de la connexion (CA24, CA25, R13, R4 de la spécification 02),
// contre la base de test. Lancé par `pnpm test:integration`.
//
// Chaque test crée ses propres comptes, dans le domaine réservé quittances.test,
// avec une adresse unique à chaque exécution (R40).

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDb, getDb } from "../db";
import { account, session, user } from "../db/schema";
import { createAccount } from "./create-account";
import { getCurrentOwner } from "./current-owner";
import { signInWithPassword } from "./sign-in";

type CookieOptions = { maxAge?: number };
type StoredCookie = { value: string; options: CookieOptions };

// Un navigateur réduit à sa boîte à cookies (même doublure que auth.integration.test.ts).
const browser = vi.hoisted(() => ({
  cookies: new Map<string, StoredCookie>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set(name: string, value: string, options: CookieOptions = {}) {
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

const createdEmails: string[] = [];

function uniqueEmail(prefix: string): string {
  const email = `${prefix}-${randomUUID()}@quittances.test`;
  createdEmails.push(email);
  return email;
}

function uniquePassword(): string {
  return `MotDePasse-${randomUUID()}`;
}

async function findUser(email: string) {
  const rows = await getDb().select().from(user).where(eq(user.email, email));
  return rows[0];
}

async function countSessions(userId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: session.id })
    .from(session)
    .where(eq(session.userId, userId));
  return rows.length;
}

// Crée un compte puis repart d'un navigateur sans cookie, sans session ouverte.
async function createOwner(prefix: string) {
  const email = uniqueEmail(prefix);
  const password = uniquePassword();
  expect(await createAccount(email, password)).toBe("created");
  const created = await findUser(email);
  // L'inscription connecte : on supprime la session qu'elle a ouverte pour
  // partir de zéro et compter ce que la connexion crée.
  await getDb().delete(session).where(eq(session.userId, created.id));
  browser.cookies.clear();
  return { email, password, id: created.id };
}

beforeEach(() => {
  browser.cookies.clear();
});

afterAll(async () => {
  if (createdEmails.length > 0) {
    await getDb().delete(user).where(inArray(user.email, createdEmails));
  }
  await closeDb();
});

describe("signInWithPassword — succès et normalisation (CA24, R4)", () => {
  it("CA24 — une adresse saisie en majuscules et avec des espaces ouvre la session du compte", async () => {
    const owner = await createOwner("prenom");

    const result = await signInWithPassword(
      `  ${owner.email.toUpperCase()} `,
      owner.password,
    );

    expect(result).toBe("signed-in");
    expect(browser.cookies.has(SESSION_COOKIE)).toBe(true);
    expect(await countSessions(owner.id)).toBe(1);
    expect((await getCurrentOwner())?.email).toBe(owner.email);
  });

  it("R4 — l'adresse normalisée sert aussi quand elle est saisie telle quelle", async () => {
    const owner = await createOwner("simple");

    expect(await signInWithPassword(owner.email, owner.password)).toBe("signed-in");
    expect((await getCurrentOwner())?.id).toBe(owner.id);
  });

  it("R7 — le mot de passe n'est jamais rogné : avec des espaces autour, il est refusé", async () => {
    const owner = await createOwner("espaces");

    expect(await signInWithPassword(owner.email, ` ${owner.password} `)).toBe("refused");
    expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
  });
});

describe("signInWithPassword — tous les refus sont identiques (CA25, R13)", () => {
  it("renvoie le même résultat « refused », sans cookie ni session, pour une adresse inconnue, un mot de passe faux, une adresse mal formée et un mot de passe très long", async () => {
    const owner = await createOwner("refus");

    const cas: [string, string, string][] = [
      ["adresse inconnue", uniqueEmail("inconnu"), owner.password],
      ["mot de passe faux", owner.email, "mauvais-mot-de-passe-1234"],
      ["adresse mal formée (sans @)", "marie", "un-mot-de-passe-quelconque"],
      ["adresse mal formée (sans point dans le domaine)", "marie@exemple", "un-mot-de-passe-quelconque"],
      ["mot de passe très long (300 caractères)", owner.email, "a".repeat(300)],
      ["mot de passe très long (10 000 caractères)", owner.email, "a".repeat(10_000)],
      ["mot de passe d'un seul caractère", owner.email, "a"],
      ["adresse existante avec le mot de passe d'un autre", owner.email, uniquePassword()],
    ];

    const resultats: string[] = [];
    for (const [, email, password] of cas) {
      resultats.push(await signInWithPassword(email, password));
      expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
    }

    expect(resultats).toEqual(cas.map(() => "refused"));
    expect(await countSessions(owner.id)).toBe(0);
    // Une adresse inconnue n'a pas créé de compte.
    expect(await findUser(cas[0][1])).toBeUndefined();
    expect(await getCurrentOwner()).toBeNull();
  });

  it("n'apprend rien sur l'existence du compte : adresse inconnue et mot de passe faux donnent exactement le même résultat", async () => {
    const owner = await createOwner("indistinct");

    const inconnue = await signInWithPassword(uniqueEmail("absent"), "mot-de-passe-quelconque");
    const fausse = await signInWithPassword(owner.email, "mot-de-passe-quelconque");

    expect(inconnue).toBe(fausse);
  });

  it("CA25 — un échec ne modifie pas le compte et ne ferme aucune session existante", async () => {
    const owner = await createOwner("intact");
    const avant = await findUser(owner.email);
    const hashAvant = (
      await getDb().select({ hash: account.password }).from(account).where(eq(account.userId, owner.id))
    )[0].hash;
    // Une session déjà ouverte (autre navigateur).
    expect(await signInWithPassword(owner.email, owner.password)).toBe("signed-in");
    browser.cookies.clear();
    expect(await countSessions(owner.id)).toBe(1);

    expect(await signInWithPassword(owner.email, "mauvais-mot-de-passe-1234")).toBe("refused");

    const apres = await findUser(owner.email);
    const hashApres = (
      await getDb().select({ hash: account.password }).from(account).where(eq(account.userId, owner.id))
    )[0].hash;
    expect(apres).toEqual(avant);
    expect(hashApres).toBe(hashAvant);
    expect(await countSessions(owner.id)).toBe(1);
    // Le bon mot de passe fonctionne toujours.
    expect(await signInWithPassword(owner.email, owner.password)).toBe("signed-in");
  });
});
