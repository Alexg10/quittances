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
