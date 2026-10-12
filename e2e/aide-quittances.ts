import { expect, type Locator, type Page } from "@playwright/test";

import { readPdf, type PdfContent } from "../src/test-support/read-pdf";

import { attendreHydratation } from "./aide-locations";

// Fonctions partagées par les specs qui touchent aux informations du bailleur et
// aux quittances (R38 de la spécification 04). Comme aide-locations.ts, la
// préparation directe passe par la base de test, pour les seuls comptes du
// domaine quittances.test. Les colonnes de type date sont lues en texte
// (`::text`) : le pilote `pg` les rend sinon en Date à minuit heure locale.

export type ValeursBailleur = {
  name: string;
  address: string;
  addressComplement: string | null;
  postalCode: string;
  city: string;
};

/** Le bailleur type de la spécification 04, rendu unique par un suffixe. */
export function valeursBailleur(suffixe: string, surcharge: Partial<ValeursBailleur> = {}): ValeursBailleur {
  return {
    name: `Marie Durand ${suffixe}`,
    address: `3 rue de la Paix ${suffixe}`,
    addressComplement: null,
    postalCode: "75002",
    city: "Paris",
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

/** Insère (ou remplace) les informations du bailleur du compte, sans passer par l'interface. */
export async function bailleurEnBase(email: string, v: ValeursBailleur) {
  expect(email).toMatch(/@quittances\.test$/);
  const lignes = await surBaseDeTest<{ owner_id: string }>(
    `insert into landlord (owner_id, name, address, address_complement, postal_code, city)
     select u.id, $2, $3, $4, $5, $6 from "user" u where u.email = $1
     on conflict (owner_id) do update set name = excluded.name, address = excluded.address,
       address_complement = excluded.address_complement, postal_code = excluded.postal_code,
       city = excluded.city, updated_at = now()
     returning owner_id`,
    [email, v.name, v.address, v.addressComplement, v.postalCode, v.city],
  );
  expect(lignes, "le compte doit exister").toHaveLength(1);
}

/** Retire les informations du bailleur (la page ne sait pas les effacer : R3). */
export async function retirerBailleur(email: string) {
  expect(email).toMatch(/@quittances\.test$/);
  await surBaseDeTest(`delete from landlord where owner_id in (select id from "user" where email = $1)`, [email]);
}

export type LigneBailleur = {
  name: string;
  address: string;
  address_complement: string | null;
  postal_code: string;
  city: string;
};

export async function bailleurDuCompte(email: string): Promise<LigneBailleur | null> {
  expect(email).toMatch(/@quittances\.test$/);
  const lignes = await surBaseDeTest<LigneBailleur>(
    `select l.name, l.address, l.address_complement, l.postal_code, l.city
     from landlord l join "user" u on u.id = l.owner_id where u.email = $1`,
    [email],
  );
  return lignes[0] ?? null;
}

export type LigneQuittance = {
  id: string;
  rental_id: string;
  month: string;
  period_start: string;
  period_end: string;
  landlord_name: string;
  landlord_address: string;
  landlord_postal_code: string;
  landlord_city: string;
  tenant_name: string;
  rental_address: string;
  rent_in_cents: number;
  charges_in_cents: number;
  payment_date: string;
  issue_date: string;
  produced_at: Date;
};

/** Les quittances du compte, telles qu'elles sont en base (dates en texte). */
export async function quittancesDuCompte(email: string): Promise<LigneQuittance[]> {
  expect(email).toMatch(/@quittances\.test$/);
  return surBaseDeTest<LigneQuittance>(
    `select r.id, r.rental_id, r.month, r.period_start::text as period_start, r.period_end::text as period_end,
       r.landlord_name, r.landlord_address, r.landlord_postal_code, r.landlord_city, r.tenant_name,
       r.rental_address, r.rent_in_cents, r.charges_in_cents, r.payment_date::text as payment_date,
       r.issue_date::text as issue_date, r.produced_at
     from receipt r join "user" u on u.id = r.owner_id where u.email = $1 order by r.month desc, r.id`,
    [email],
  );
}

/** Nombre de locations du compte encore en base (suppression directe, CA57). */
export async function nombreDeLocations(email: string): Promise<number> {
  expect(email).toMatch(/@quittances\.test$/);
  const l = await surBaseDeTest<{ n: string }>(
    `select count(*)::text as n from rental r join "user" u on u.id = r.owner_id where u.email = $1`,
    [email],
  );
  return Number(l[0].n);
}

/**
 * Insère une quittance directement, avec des valeurs figées complètes, pour le
 * compte et la location donnés (la location doit appartenir au compte).
 */
export async function creerQuittanceEnBase(
  email: string,
  rentalId: string,
  v: Partial<{
    month: string;
    periodStart: string;
    periodEnd: string;
    rentInCents: number;
    chargesInCents: number;
    paymentDate: string;
    issueDate: string;
    producedAt: string;
    landlordName: string;
    tenantName: string;
    rentalAddress: string;
  }> = {},
): Promise<string> {
  expect(email).toMatch(/@quittances\.test$/);
  const mois = v.month ?? "2026-02";
  const lignes = await surBaseDeTest<{ id: string }>(
    `insert into receipt (owner_id, rental_id, month, period_start, period_end,
       landlord_name, landlord_address, landlord_postal_code, landlord_city,
       tenant_name, rental_address, rental_postal_code, rental_city,
       rent_in_cents, charges_in_cents, payment_date, issue_date, produced_at)
     select u.id, r.id, $3, $4, $5, $6, '3 rue de la Paix', '75002', 'Paris',
       $7, $8, r.postal_code, r.city, $9, $10, $11, $12, $13::timestamptz
     from "user" u join rental r on r.owner_id = u.id
     where u.email = $1 and r.id = $2
     returning id`,
    [
      email,
      rentalId,
      mois,
      v.periodStart ?? `${mois}-01`,
      v.periodEnd ?? `${mois}-28`,
      v.landlordName ?? "Marie Durand",
      v.tenantName ?? "Paul Martin",
      v.rentalAddress ?? "12 rue des Lilas",
      v.rentInCents ?? 85000,
      v.chargesInCents ?? 5000,
      v.paymentDate ?? `${mois}-05`,
      v.issueDate ?? "2026-10-12",
      v.producedAt ?? "2026-10-12T10:00:00Z",
    ],
  );
  expect(lignes, "la location doit appartenir au compte").toHaveLength(1);
  return lignes[0].id;
}

/** Les « liens de document » : texte de la page rendue, espaces spéciales remplacées par des espaces ordinaires. */
export const textePlat = (t: string) => t.replace(/[\s  ]+/g, " ").trim();

export type SaisieQuittance = {
  mois?: string; // valeur de l'option, « AAAA-MM »
  loyer?: string;
  charges?: string;
  date?: string;
  attester?: boolean;
};

export const champLoyer = (page: Page) => page.getByLabel("Loyer hors charges");
export const champCharges = (page: Page) => page.getByLabel("Charges", { exact: true });
export const champDate = (page: Page) => page.getByLabel("Date du paiement");
export const caseAttestation = (page: Page) =>
  page.getByRole("checkbox", {
    name: "Je confirme avoir reçu en totalité le loyer et les charges indiqués ci-dessus pour ce mois.",
  });
export const boutonProduire = (page: Page) => page.getByRole("button", { name: "Produire la quittance" });

/** Ouvre la page de production et attend l'hydratation du formulaire. */
export async function ouvrirProduction(page: Page, rentalId: string) {
  await page.goto(`/locations/${rentalId}/quittances/nouvelle`);
  await expect(page.getByRole("heading", { level: 1, name: "Produire une quittance" })).toBeVisible();
  await expect(boutonProduire(page)).toBeVisible();
  await attendreHydratation(page);
}

/** Remplit le formulaire de production déjà affiché (seuls les champs fournis changent). */
export async function remplirProduction(page: Page, s: SaisieQuittance) {
  if (s.mois !== undefined) await page.getByLabel("Mois", { exact: true }).selectOption(s.mois);
  if (s.loyer !== undefined) await champLoyer(page).fill(s.loyer);
  if (s.charges !== undefined) await champCharges(page).fill(s.charges);
  if (s.date !== undefined) await champDate(page).fill(s.date);
  if (s.attester) await caseAttestation(page).check();
}

/** Produit une quittance par l'interface et attend l'arrivée sur le détail. */
export async function produireParInterface(page: Page, rentalId: string, s: SaisieQuittance) {
  await ouvrirProduction(page, rentalId);
  await remplirProduction(page, { attester: true, ...s });
  await boutonProduire(page).click();
  await expect(page).toHaveURL(new RegExp(`/locations/${rentalId}$`));
}

/** La ligne de la section « Quittances » qui porte ce texte (mois, par exemple). */
export const ligneQuittance = (page: Page, texte: string): Locator =>
  page.getByRole("listitem").filter({ hasText: texte });

export type PdfTelecharge = {
  statut: number;
  entetes: Record<string, string>;
  nomDuFichier: string;
  octets: Buffer;
  contenu: PdfContent;
};

/** Enregistre le fichier d'un clic sur `lien` et le lit avec l'aide de lecture de PDF. */
export async function telechargerPdf(page: Page, lien: Locator): Promise<PdfTelecharge> {
  const [telechargement, reponse] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForResponse((r) => /\/quittances\/[^/]+\/pdf$/.test(new URL(r.url()).pathname)),
    lien.click(),
  ]);
  const chemin = await telechargement.path();
  const { readFile } = await import("node:fs/promises");
  const octets = await readFile(chemin);
  return {
    statut: reponse.status(),
    entetes: reponse.headers(),
    nomDuFichier: telechargement.suggestedFilename(),
    octets,
    contenu: await readPdf(new Uint8Array(octets)),
  };
}

/** L'identifiant d'une quittance, lu dans l'adresse de son lien `Télécharger`. */
export async function identifiantDeQuittance(lien: Locator): Promise<string> {
  const href = await lien.getAttribute("href");
  const m = /^\/quittances\/([0-9a-f-]{36})\/pdf$/.exec(href ?? "");
  expect(m, `adresse de téléchargement : ${href}`).not.toBeNull();
  return m![1];
}

/** Le mois et le contenu, mot pour mot, de la mention de réserve (bloc 12 de R27). */
export const MENTION_DE_RESERVE =
  "La présente quittance ne libère le locataire que pour la période indiquée. Elle ne vaut pas quittance des loyers et des charges des périodes antérieures.";

// ---------------------------------------------------------------------------
// Outils d'observation et de requêtes forgées
// ---------------------------------------------------------------------------

import type { Browser, BrowserContext } from "@playwright/test";

import { inscrire } from "./aide-comptes";

export const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
export const MOTIF_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Console : aucune erreur ni avertissement, sauf le 404 que le navigateur écrit lui-même pour une adresse volontairement introuvable. */
export function surveillerConsole(page: Page, { tolerer404 = false } = {}) {
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (tolerer404 && /Failed to load resource: the server responded with a status of 404/.test(m.text())) return;
    messages.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
  return messages;
}

/** Les chemins des requêtes de document (rechargement complet) faites par la page. */
export function surveillerDocuments(page: Page) {
  const documents: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "document") documents.push(new URL(r.url()).pathname);
  });
  return documents;
}

/** Toutes les adresses demandées par la page, requêtes de données comprises, décodées. */
export function surveillerAdresses(page: Page) {
  const adresses: string[] = [];
  page.on("request", (r) => adresses.push(decodeURIComponent(r.url())));
  return adresses;
}

/** Un propriétaire connecté dans son propre contexte de navigateur. */
export async function nouveauProprietaire(browser: Browser) {
  const contexte = await browser.newContext();
  const page = await contexte.newPage();
  const { email } = await inscrire(page);
  return { contexte, page, email };
}

/** Rend un contexte sans JavaScript à partir de la session d'un contexte avec JavaScript. */
export async function sansJavaScript(browser: Browser, contexte: BrowserContext) {
  const stockage = await contexte.storageState();
  return browser.newContext({ javaScriptEnabled: false, storageState: stockage });
}

/** Les champs cachés d'un formulaire envoyé sans JavaScript (références d'action et arguments liés). */
export async function champsCaches(contexte: BrowserContext, chemin: string, indexFormulaire: number) {
  const html = await (await contexte.request.get(chemin)).text();
  const formulaires = [...html.matchAll(/<form[\s\S]*?<\/form>/g)]
    .map((m) => m[0])
    .filter((f) => !f.includes("Se déconnecter"));
  const decoder = (s: string) =>
    s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return [...formulaires[indexFormulaire].matchAll(/<input type="hidden" name="([^"]*)"(?: value="([^"]*)")?/g)].map(
    (m) => [m[1], decoder(m[2] ?? "")] as [string, string],
  );
}

/** Normalise une réponse : les identifiants et les jetons internes de Next ne sont pas des différences. */
export const normaliser = (corps: string) =>
  corps.replace(MOTIF_UUID, "ID").replace(/"[A-Za-z0-9_-]{21,22}"/g, '"JETON"');

/** Envoie sans JavaScript un formulaire : ses champs cachés, ses champs saisis, des champs en plus. Sans suivre les redirections. */
export async function envoyerSansJs(
  contexte: BrowserContext,
  chemin: string,
  champs: [string, string][],
  extra: Record<string, string> = {},
) {
  const multipart: Record<string, string> = {};
  for (const [k, v] of champs) multipart[k] = v;
  Object.assign(multipart, extra);
  const reponse = await contexte.request.post(chemin, { multipart, maxRedirects: 0 });
  return { statut: reponse.status(), emplacement: reponse.headers()["location"], corps: normaliser(await reponse.text()) };
}

/** Remplace `de` par `par` partout dans les requêtes POST de la page : adresse, en-têtes, corps. */
export async function remplacerIdentifiantLie(page: Page, de: string, par: string) {
  const etat = { remplacements: 0, statuts: [] as number[] };
  await page.route("**/*", async (route) => {
    const requete = route.request();
    if (requete.method() !== "POST") return route.continue();
    const corps = requete.postData() ?? "";
    etat.remplacements += corps.split(de).length - 1;
    const entetes = Object.fromEntries(
      Object.entries(requete.headers()).map(([k, v]) => [k, v.split(de).join(par)]),
    );
    const reponse = await route.fetch({
      url: requete.url().split(de).join(par),
      headers: entetes,
      postData: corps.split(de).join(par),
    });
    etat.statuts.push(reponse.status());
    await route.fulfill({ response: reponse });
  });
  return etat;
}

/** Vrai si chaque fragment figure dans le texte, dans cet ordre (texte ramené à des espaces ordinaires). */
export function contientDansLOrdre(texte: string, fragments: string[]): { ok: boolean; manque?: string } {
  const t = textePlat(texte);
  let depuis = 0;
  for (const f of fragments) {
    const i = t.indexOf(textePlat(f), depuis);
    if (i < 0) return { ok: false, manque: f };
    depuis = i + textePlat(f).length;
  }
  return { ok: true };
}

/** Modifie directement la location (valeurs « d'après » la production), pour éprouver les valeurs figées. */
export async function modifierLocationEnBase(
  rentalId: string,
  champs: { rent_in_cents?: number; charges_in_cents?: number; tenant_name?: string; address?: string; city?: string },
) {
  await surBaseDeTest(
    `update rental set rent_in_cents = coalesce($2, rent_in_cents), charges_in_cents = coalesce($3, charges_in_cents),
       tenant_name = coalesce($4, tenant_name), address = coalesce($5, address), city = coalesce($6, city)
     where id = $1 and owner_id in (select id from "user" where email like '%@quittances.test')`,
    [rentalId, champs.rent_in_cents ?? null, champs.charges_in_cents ?? null, champs.tenant_name ?? null, champs.address ?? null, champs.city ?? null],
  );
}

/** Attend que React ait attaché ses gestionnaires au bouton (formulaires sans champ de saisie). */
export async function attendreBouton(page: Page, nom: string) {
  const bouton = page.getByRole("button", { name: nom });
  await expect(bouton).toBeVisible();
  await expect
    .poll(() => bouton.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))))
    .toBe(true);
}
