import { expect, type Page } from "@playwright/test";

// Fonctions partagées par les specs qui touchent aux locations (R44 de la
// spécification 03). Préparer une liste sans passer par l'interface se fait dans
// la base de test, pour les seuls comptes du domaine quittances.test : le
// garde-fou refuse tout autre domaine. La création par le formulaire reste
// couverte par ses propres tests.

export type ValeursLocation = {
  address: string;
  addressComplement: string | null;
  postalCode: string;
  city: string;
  tenantName: string;
  tenantEmail: string;
  rentInCents: number;
  chargesInCents: number;
  dueDay: number;
  startDate: string;
  endDate: string | null;
};

let compteur = 0;

/** Un suffixe unique par appel : adresses, noms et e-mails de locataires ne se recoupent jamais entre tests. */
export function suffixeUnique(): string {
  compteur += 1;
  return `${Date.now().toString(36)}${compteur}${Math.random().toString(36).slice(2, 6)}`;
}

/** Des valeurs de location valides, uniques, que chaque test peut surcharger. */
export function valeursLocation(surcharge: Partial<ValeursLocation> = {}): ValeursLocation {
  const u = suffixeUnique();
  return {
    address: `12 rue des Lilas ${u}`,
    addressComplement: null,
    postalCode: "69003",
    city: "Lyon",
    tenantName: `Paul Martin ${u}`,
    tenantEmail: `locataire-${u}@quittances.test`,
    rentInCents: 85000,
    chargesInCents: 5000,
    dueDay: 5,
    startDate: "2026-01-05",
    endDate: null,
    ...surcharge,
  };
}

async function surBaseDeTest<T>(requete: string, parametres: unknown[]): Promise<T[]> {
  const { Pool } = await import("pg");
  const { requireTestDatabaseUrl } = await import("../src/db/test-database");
  const pool = new Pool({ connectionString: requireTestDatabaseUrl(process.env) });
  try {
    const resultat = await pool.query(requete, parametres);
    return resultat.rows as T[];
  } finally {
    await pool.end();
  }
}

/**
 * Insère une location directement dans la base de test, pour le compte `email`
 * (qui doit exister et appartenir à quittances.test). Renvoie son identifiant.
 * `creation` permet de fixer l'ordre de création de plusieurs locations.
 */
export async function creerLocation(
  email: string,
  surcharge: Partial<ValeursLocation> = {},
  creation?: Date,
): Promise<{ id: string; valeurs: ValeursLocation }> {
  expect(email).toMatch(/@quittances\.test$/);
  const v = valeursLocation(surcharge);
  const lignes = await surBaseDeTest<{ id: string }>(
    `insert into rental (owner_id, address, address_complement, postal_code, city, tenant_name,
       tenant_email, rent_in_cents, charges_in_cents, due_day, start_date, end_date, created_at)
     select u.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, coalesce($13::timestamptz, now())
     from "user" u where u.email = $1
     returning id`,
    [
      email,
      v.address,
      v.addressComplement,
      v.postalCode,
      v.city,
      v.tenantName,
      v.tenantEmail,
      v.rentInCents,
      v.chargesInCents,
      v.dueDay,
      v.startDate,
      v.endDate,
      creation ?? null,
    ],
  );
  expect(lignes, "le compte doit exister").toHaveLength(1);
  return { id: lignes[0].id, valeurs: v };
}

/** Les locations du compte, telles qu'elles sont en base (vérification d'isolation). */
export async function locationsDuCompte(email: string) {
  expect(email).toMatch(/@quittances\.test$/);
  return surBaseDeTest<{
    id: string;
    address: string;
    tenant_name: string;
    end_date: string | null;
    rent_in_cents: number;
    updated_at: Date;
  }>(
    `select r.id, r.address, r.tenant_name, r.end_date::text as end_date, r.rent_in_cents, r.updated_at
     from rental r join "user" u on u.id = r.owner_id where u.email = $1 order by r.created_at, r.id`,
    [email],
  );
}

/** Identifiant interne du compte (jamais affiché : sert à des champs parasites). */
export async function identifiantDuCompte(email: string): Promise<string> {
  expect(email).toMatch(/@quittances\.test$/);
  const lignes = await surBaseDeTest<{ id: string }>(`select id from "user" where email = $1`, [email]);
  expect(lignes).toHaveLength(1);
  return lignes[0].id;
}

/** Une valeur par champ du formulaire de location, telle qu'on la saisit. */
export type SaisieLocation = {
  adresse: string;
  complement?: string;
  codePostal: string;
  ville: string;
  nom: string;
  email: string;
  loyer: string;
  charges: string;
  jour: string;
  debut: string;
};

export function saisieValide(surcharge: Partial<SaisieLocation> = {}): SaisieLocation {
  const u = suffixeUnique();
  return {
    adresse: `12 rue des Lilas ${u}`,
    codePostal: "69003",
    ville: "Lyon",
    nom: `Paul Martin ${u}`,
    email: `locataire-${u}@quittances.test`,
    loyer: "850",
    charges: "50",
    jour: "5",
    debut: "2026-01-05",
    ...surcharge,
  };
}

/** Remplit les dix champs du formulaire déjà affiché. */
export async function remplirLocation(page: Page, s: SaisieLocation) {
  await page.getByLabel("Adresse", { exact: true }).fill(s.adresse);
  await page.getByLabel("Complément d'adresse (facultatif)").fill(s.complement ?? "");
  await page.getByLabel("Code postal").fill(s.codePostal);
  await page.getByLabel("Ville").fill(s.ville);
  await page.getByLabel("Nom du locataire").fill(s.nom);
  await page.getByLabel("Adresse e-mail du locataire").fill(s.email);
  await page.getByLabel("Loyer hors charges").fill(s.loyer);
  await page.getByLabel("Charges", { exact: true }).fill(s.charges);
  await page.getByLabel("Jour d'échéance").fill(s.jour);
  await page.getByLabel("Date de début du bail").fill(s.debut);
}

/** Ouvre /locations/nouvelle et attend que le formulaire soit hydraté (le bouton Ajouter réagit alors). */
export async function ouvrirCreation(page: Page) {
  await page.goto("/locations/nouvelle");
  await expect(page.getByRole("heading", { level: 1, name: "Ajouter une location" })).toBeVisible();
  await attendreHydratation(page);
}

/** Attend que React ait attaché ses gestionnaires au formulaire de la page. */
export async function attendreHydratation(page: Page) {
  const champ = page.locator("main form input:not([type=hidden])").first();
  await expect
    .poll(() => champ.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))))
    .toBe(true);
}

/** Pose un témoin dans le document : il disparaît si le document est rechargé. */
export async function poserTemoin(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __temoin: string }).__temoin = "present";
  });
}
export const lireTemoin = (page: Page) =>
  page.evaluate(() => (window as unknown as { __temoin?: string }).__temoin);

/** Le texte d'un montant, espaces insécables ordinaires (R16 : les critères les comparent ainsi). */
export const sansEspacesSpeciales = (texte: string) => texte.replace(/[  ]/g, " ");
