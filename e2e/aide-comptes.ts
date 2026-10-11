import { expect, type Page } from "@playwright/test";

// Fonctions partagées par les specs qui ont besoin d'un compte (R40 de la
// spécification 02) : chaque test crée ses propres comptes, par le formulaire
// d'inscription, avec une adresse unique dans le domaine réservé quittances.test.

export const MOT_DE_PASSE = "MotDePasse-12";

let compteur = 0;

/** Adresse unique à chaque exécution et à chaque appel, en minuscules. */
export function adresseUnique(prefixe = "test"): string {
  compteur += 1;
  const aleatoire = Math.random().toString(36).slice(2, 8);
  return `${prefixe}-${Date.now().toString(36)}${compteur}${aleatoire}@quittances.test`;
}

export const champEmail = (page: Page) => page.getByLabel("Adresse e-mail");
export const champMotDePasse = (page: Page) =>
  page.getByLabel("Mot de passe", { exact: true });

/** Remplit et envoie le formulaire d'inscription déjà affiché. */
export async function remplirEtEnvoyer(page: Page, email: string, motDePasse: string) {
  await champEmail(page).fill(email);
  await champMotDePasse(page).fill(motDePasse);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

/** Ouvre /inscription, attend l'hydratation, puis renvoie les champs. */
export async function ouvrirInscription(page: Page) {
  await page.goto("/inscription");
  await expect(page.getByRole("heading", { level: 1, name: "Créer un compte" })).toBeVisible();
  // Tant que React n'a pas attaché ses gestionnaires, le bouton Afficher ne ferait rien.
  const bouton = page.getByRole("button", { name: "Afficher le mot de passe" });
  await expect
    .poll(() => bouton.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))))
    .toBe(true);
}

/**
 * Crée un compte par le formulaire et attend l'arrivée sur /tableau-de-bord.
 * Renvoie l'adresse normalisée (minuscules).
 */
export async function inscrire(
  page: Page,
  { email = adresseUnique(), motDePasse = MOT_DE_PASSE } = {},
): Promise<{ email: string; motDePasse: string }> {
  await ouvrirInscription(page);
  await remplirEtEnvoyer(page, email, motDePasse);
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  return { email: email.trim().toLowerCase(), motDePasse };
}

/** Le cookie de session, tel que le navigateur le détient. */
export async function cookieDeSession(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name.includes("session_token"));
}

/** Ouvre le tableau de bord et attend son contenu. */
export async function ouvrirTableauDeBord(page: Page) {
  await page.goto("/tableau-de-bord");
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
}

/** Active « Se déconnecter » et attend l'arrivée sur /connexion (rechargement complet). */
export async function deconnecter(page: Page) {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/connexion");
}

/** L'en-tête Cookie à présenter pour rejouer une session relevée. */
export async function enteteCookie(page: Page): Promise<string> {
  const cookie = await cookieDeSession(page);
  expect(cookie, "cookie de session").toBeDefined();
  return `${cookie!.name}=${cookie!.value}`;
}

// Accès direct à la base de test, pour les seuls comptes du domaine quittances.test
// (R40 de la spécification 02) : reculer ou faire expirer la session d'un compte
// créé par le test lui-même. Le garde-fou refuse tout autre domaine.
async function surSessionsDeTest<T>(email: string, requete: string): Promise<T[]> {
  expect(email).toMatch(/@quittances\.test$/);
  const { Pool } = await import("pg");
  const { requireTestDatabaseUrl } = await import("../src/db/test-database");
  const pool = new Pool({ connectionString: requireTestDatabaseUrl(process.env) });
  try {
    const resultat = await pool.query(requete, [email]);
    return resultat.rows as T[];
  } finally {
    await pool.end();
  }
}

const DE_CE_COMPTE = `user_id in (select id from "user" where email = $1)`;

/** Fait expirer la session du compte (elle existe encore en base, mais périmée). */
export async function expirerSession(email: string) {
  await surSessionsDeTest(
    email,
    `update session set expires_at = now() - interval '1 hour' where ${DE_CE_COMPTE} returning id`,
  );
}

/** Simule une session non utilisée depuis 5 jours : expiration dans 10 jours, dernière mise à jour il y a 5 jours. */
export async function reculerSession(email: string) {
  await surSessionsDeTest(
    email,
    `update session set expires_at = now() + interval '10 days', updated_at = now() - interval '5 days' where ${DE_CE_COMPTE} returning id`,
  );
}

/** Date d'expiration de la session du compte (ms depuis 1970), ou null si elle n'existe plus. */
export async function expirationSession(email: string): Promise<number | null> {
  const lignes = await surSessionsDeTest<{ expires_at: Date }>(
    email,
    `select expires_at from session where ${DE_CE_COMPTE}`,
  );
  return lignes.length ? new Date(lignes[0].expires_at).getTime() : null;
}
