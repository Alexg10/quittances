// Test d'intégration de closePreviousSession (R3, précision après T4), contre la
// base de test. Lancé par `pnpm test:integration`.
//
// readPreviousSessionToken lit le cookie de la requête en cours (next/headers) :
// il relève de la recette dans un vrai navigateur. Ici on teste la fermeture,
// qui n'a besoin que de la base.

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDb, getDb } from "../db";
import { session, user } from "../db/schema";
import { getAuth } from "./auth";
import { createAccount } from "./create-account";
import { closePreviousSession } from "./previous-session";

type CookieOptions = { maxAge?: number };
type StoredCookie = { value: string; options: CookieOptions };

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

const createdEmails: string[] = [];

async function createOwner(prefix: string) {
  const email = `${prefix}-${randomUUID()}@quittances.test`;
  const password = `MotDePasse-${randomUUID()}`;
  createdEmails.push(email);
  expect(await createAccount(email, password)).toBe("created");
  const [created] = await getDb().select().from(user).where(eq(user.email, email));
  // On repart sans session : celle de l'inscription est retirée.
  await getDb().delete(session).where(eq(session.userId, created.id));
  browser.cookies.clear();
  return { email, password, id: created.id };
}

// Ouvre une session du compte et renvoie son jeton (celui qui est en base).
async function openSession(owner: { email: string; password: string }): Promise<string> {
  const result = await getAuth().api.signInEmail({
    body: { email: owner.email, password: owner.password },
  });
  browser.cookies.clear();
  return result.token;
}

async function sessionTokens(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ token: session.token })
    .from(session)
    .where(eq(session.userId, userId));
  return rows.map((row) => row.token);
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

describe("closePreviousSession (R3)", () => {
  it("la session visée disparaît de la base", async () => {
    const owner = await createOwner("fermee");
    const token = await openSession(owner);
    expect(await sessionTokens(owner.id)).toEqual([token]);

    await closePreviousSession(token);

    expect(await sessionTokens(owner.id)).toEqual([]);
  });

  it("une autre session du même compte survit (autre navigateur)", async () => {
    const owner = await createOwner("deux-navigateurs");
    const ancien = await openSession(owner);
    const autre = await openSession(owner);
    expect(ancien).not.toBe(autre);

    await closePreviousSession(ancien);

    expect(await sessionTokens(owner.id)).toEqual([autre]);
  });

  it("la session d'un autre compte survit", async () => {
    const proprietaire = await createOwner("visee");
    const voisin = await createOwner("voisin");
    const token = await openSession(proprietaire);
    const tokenVoisin = await openSession(voisin);

    await closePreviousSession(token);

    expect(await sessionTokens(proprietaire.id)).toEqual([]);
    expect(await sessionTokens(voisin.id)).toEqual([tokenVoisin]);
  });

  it("un jeton inconnu ne lève rien et ne supprime aucune session", async () => {
    const owner = await createOwner("inconnu");
    const token = await openSession(owner);

    await expect(closePreviousSession(`jeton-inconnu-${randomUUID()}`)).resolves.toBeUndefined();

    expect(await sessionTokens(owner.id)).toEqual([token]);
  });

  it("un jeton déjà fermé ne lève rien (fermeture répétée)", async () => {
    const owner = await createOwner("deja-fermee");
    const token = await openSession(owner);
    await closePreviousSession(token);

    await expect(closePreviousSession(token)).resolves.toBeUndefined();
  });
});
