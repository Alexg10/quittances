import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import {
  deconnecter,
  expirerSession,
  inscrire,
  ouvrirConnexion,
  remplirEtSeConnecter,
} from "./aide-comptes";
import {
  attendreHydratation,
  creerLocation,
  identifiantDuCompte,
  lireTemoin,
  locationsDuCompte,
  poserTemoin,
  remplirLocation,
  saisieValide,
  sansEspacesSpeciales,
  suffixeUnique,
  supprimerCompte,
} from "./aide-locations";

// Gestion des locations, tranche T6 (spec 03) : modification (CA32), fin et
// réouverture (CA35 à CA37), suppression (CA38, CA39), isolation sur les quatre
// actions (CA34, CA29 et CA30 pour /modifier, /fin, /supprimer), parcours sans
// JavaScript (CA40), accessibilité (CA42), rendu (CA43), console, adresses et
// titres (CA44, CA45), cache (CA46), page 404 générale.
// Chaque test crée ses propres comptes et ses propres locations (R44). Les
// locations de départ sont préparées dans la base de test (aide-locations.ts).

const UUID_INCONNU = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const MOTIF_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PASSE = "2026-06-30";
const FUTUR = "2099-12-31";

/** Console : aucune erreur ni avertissement, sauf le 404 que le navigateur écrit lui-même pour une adresse volontairement introuvable. */
function surveillerConsole(page: Page, { tolerer404 = false } = {}) {
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (tolerer404 && /Failed to load resource: the server responded with a status of 404/.test(m.text())) return;
    messages.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
  return messages;
}

function surveillerDocuments(page: Page) {
  const documents: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "document") documents.push(new URL(r.url()).pathname);
  });
  return documents;
}

/** Toutes les adresses demandées par la page, requêtes de données comprises. */
function surveillerAdresses(page: Page) {
  const adresses: string[] = [];
  page.on("request", (r) => adresses.push(decodeURIComponent(r.url())));
  return adresses;
}

async function nouveauProprietaire(browser: Browser) {
  const contexte = await browser.newContext();
  const page = await contexte.newPage();
  const compte = await inscrire(page);
  return { contexte, page, ...compte };
}

async function valeurDetail(page: Page, libelle: string) {
  return page.getByText(libelle, { exact: true }).locator("xpath=following-sibling::dd").innerText();
}

const ligneDe = (page: Page, adresse: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name: adresse }) });

const champDate = (page: Page, libelle: string) => page.getByLabel(libelle);

/** Attend que React ait attaché ses gestionnaires au bouton d'un formulaire sans champ. */
async function attendreBoutonHydrate(page: Page, nom: string) {
  const bouton = page.getByRole("button", { name: nom });
  await expect
    .poll(() => bouton.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))))
    .toBe(true);
}

async function ouvrir(page: Page, chemin: string, titre: string) {
  await page.goto(chemin);
  await expect(page.getByRole("heading", { level: 1, name: titre })).toBeVisible();
  const champs = await page.locator("main form input:not([type=hidden])").count();
  if (champs > 0) await attendreHydratation(page);
}

const ouvrirModifier = (page: Page, id: string) => ouvrir(page, `/locations/${id}/modifier`, "Modifier la location");
const ouvrirFin = (page: Page, id: string) => ouvrir(page, `/locations/${id}/fin`, "Fin de la location");
const ouvrirSupprimer = async (page: Page, id: string) => {
  await ouvrir(page, `/locations/${id}/supprimer`, "Supprimer cette location");
  await attendreBoutonHydrate(page, "Supprimer définitivement");
};

/** Rend une session sans JavaScript à partir de la session d'un contexte avec JavaScript. */
async function sansJavaScript(browser: Browser, contexte: BrowserContext) {
  const stockage = await contexte.storageState();
  return browser.newContext({ javaScriptEnabled: false, storageState: stockage });
}

/** Les champs cachés d'un formulaire envoyé sans JavaScript (références d'action et arguments liés). */
async function champsCaches(contexte: BrowserContext, chemin: string, indexFormulaire: number) {
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

type Operation = {
  nom: string;
  page: "modifier" | "fin" | "supprimer";
  formulaire: number;
  /** Champs valides, puis invalides, tels qu'un envoi du formulaire les contiendrait. */
  valides: Record<string, string>;
  invalides: Record<string, string>;
  bouton: string;
  /** Saisie dans le navigateur (JavaScript) avant d'activer le bouton. */
  saisir: (page: Page, valide: boolean) => Promise<void>;
};

const OPERATIONS: Operation[] = [
  {
    nom: "modifier",
    page: "modifier",
    formulaire: 0,
    valides: {
      address: "PIRATE rue", addressComplement: "", postalCode: "75011", city: "Paris", tenantName: "Pirate",
      tenantEmail: "pirate@quittances.test", rent: "1", charges: "0", dueDay: "5", startDate: "2026-01-05",
    },
    invalides: { address: "", city: "", rent: "abc" },
    bouton: "Enregistrer les modifications",
    saisir: async (page, valide) => {
      await page.getByLabel("Ville").fill(valide ? "PIRATE" : "");
    },
  },
  {
    nom: "fin",
    page: "fin",
    formulaire: 0,
    valides: { endDate: "2026-07-01" },
    invalides: { endDate: "2100-01-01" },
    bouton: "Enregistrer la date de fin",
    saisir: async (page, valide) => {
      await champDate(page, "Date de fin du bail").fill(valide ? "2026-07-01" : "2100-01-01");
    },
  },
  { nom: "rouvrir", page: "fin", formulaire: 1, valides: {}, invalides: {}, bouton: "Rouvrir la location", saisir: async () => {} },
  { nom: "supprimer", page: "supprimer", formulaire: 0, valides: {}, invalides: {}, bouton: "Supprimer définitivement", saisir: async () => {} },
];

/** Remplace `de` par `par` partout dans les requêtes POST de la page : adresse, en-têtes, corps. Renvoie le nombre de remplacements. */
async function remplacerIdentifiantLie(page: Page, de: string, par: string) {
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

/** Normalise une réponse : l'identifiant demandé n'est pas une différence. */
// Les jetons internes de Next (21 ou 22 caractères entre guillemets) changent d'une requête à l'autre,
// même pour une adresse identique : ils ne sont pas une différence entre deux réponses.
const normaliser = (corps: string) => corps.replace(MOTIF_UUID, "ID").replace(/"[A-Za-z0-9_-]{21,22}"/g, '"JETON"');

async function envoyerSansJs(
  contexte: BrowserContext,
  chemin: string,
  champs: [string, string][],
  extra: Record<string, string> = {},
  entetes: Record<string, string> = {},
) {
  const multipart: Record<string, string> = {};
  for (const [k, v] of champs) multipart[k] = v;
  Object.assign(multipart, extra);
  const reponse = await contexte.request.post(chemin, { multipart, maxRedirects: 0, headers: entetes });
  return { statut: reponse.status(), emplacement: reponse.headers()["location"], corps: normaliser(await reponse.text()) };
}

// ---------------------------------------------------------------------------
// Parcours
// ---------------------------------------------------------------------------

test.describe("Locations : parcours complet avec JavaScript", () => {
  test("Parcours 1 à 4, CA32, CA35, CA37, CA39, CA44, CA45 : créer, consulter, modifier, mettre fin, rouvrir, supprimer, sans rechargement de document", async ({ page }) => {
    const console_ = surveillerConsole(page, { tolerer404: true });
    const adresses = surveillerAdresses(page);
    const documents = surveillerDocuments(page);
    const titres: string[] = [];
    const { email } = await inscrire(page);
    const saisie = saisieValide({ nom: "Zoé O'Brien", loyer: "1250,5", charges: "0", complement: "Bât. B" });

    await page.goto("/tableau-de-bord");
    await expect(page.getByRole("heading", { level: 2, name: "Aucune location pour l'instant" })).toBeVisible();
    await attendreHydratation(page).catch(() => {});
    await poserTemoin(page);
    documents.length = 0;

    // Création.
    await page.getByRole("link", { name: "Ajouter une location" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ajouter une location" })).toBeVisible();
    await attendreHydratation(page);
    await remplirLocation(page, saisie);
    await page.getByRole("button", { name: "Ajouter la location" }).click();
    await expect(page).toHaveURL(/\/locations\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { level: 1 })).toContainText(saisie.adresse);
    await expect(page).toHaveTitle("Location — Quittances");
    titres.push("Location — Quittances");

    // Modification : préremplissage au format de saisie (CA32), puis nouvelles valeurs.
    await page.getByRole("link", { name: "Modifier", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Modifier la location" })).toBeVisible();
    await attendreHydratation(page);
    await expect(page).toHaveTitle("Modifier la location — Quittances");
    titres.push("Modifier la location — Quittances");
    await expect(page).toHaveTitle("Modifier la location — Quittances");
    await expect(page.getByLabel("Adresse", { exact: true })).toHaveValue(saisie.adresse);
    await expect(page.getByLabel("Complément d'adresse (facultatif)")).toHaveValue("Bât. B");
    await expect(page.getByLabel("Code postal")).toHaveValue("69003");
    await expect(page.getByLabel("Nom du locataire")).toHaveValue("Zoé O'Brien");
    await expect(page.getByLabel("Loyer hors charges")).toHaveValue("1250,50");
    await expect(page.getByLabel("Charges", { exact: true })).toHaveValue("0,00");
    await expect(page.getByLabel("Jour d'échéance")).toHaveValue("5");
    await expect(page.getByLabel("Date de début du bail")).toHaveValue("2026-01-05");
    await expect(page.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", `/locations/${id}`);
    await page.getByLabel("Loyer hors charges").fill("900");
    await page.getByLabel("Charges", { exact: true }).fill("45,5");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page).toHaveURL(`/locations/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(saisie.adresse);
    expect(sansEspacesSpeciales(await valeurDetail(page, "Loyer hors charges"))).toBe("900,00 €");
    expect(sansEspacesSpeciales(await valeurDetail(page, "Charges"))).toBe("45,50 €");
    expect(sansEspacesSpeciales(await valeurDetail(page, "Total charges comprises"))).toBe("945,50 €");

    // La liste montre le nouveau total sans rechargement manuel (R30).
    await page.getByRole("link", { name: "Retour au tableau de bord" }).click();
    await expect(ligneDe(page, saisie.adresse)).toBeVisible();
    expect(sansEspacesSpeciales(await ligneDe(page, saisie.adresse).innerText())).toContain("945,50 € charges comprises");

    // Enregistrer sans rien changer (R22).
    await page.getByRole("link", { name: saisie.adresse }).click();
    await page.getByRole("link", { name: "Modifier", exact: true }).click();
    await attendreHydratation(page);
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page).toHaveURL(`/locations/${id}`);
    expect(sansEspacesSpeciales(await valeurDetail(page, "Total charges comprises"))).toBe("945,50 €");
    await expect(page.getByText("Date de fin du bail", { exact: true })).toHaveCount(0);

    // Mettre fin : date passée.
    await page.getByRole("link", { name: "Mettre fin à la location" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Fin de la location" })).toBeVisible();
    await attendreHydratation(page);
    await expect(page).toHaveTitle("Fin de la location — Quittances");
    titres.push("Fin de la location — Quittances");
    await expect(champDate(page, "Date de fin du bail")).toHaveValue("");
    await expect(page.getByRole("heading", { level: 2, name: "Rouvrir la location" })).toHaveCount(0);
    await champDate(page, "Date de fin du bail").fill(PASSE);
    await page.getByRole("button", { name: "Enregistrer la date de fin" }).click();
    await expect(page).toHaveURL(`/locations/${id}`);
    await expect(page.getByRole("main").getByText("Terminée", { exact: true })).toBeVisible();
    expect(await valeurDetail(page, "Date de fin du bail")).toBe("30/06/2026");
    await page.getByRole("link", { name: "Retour au tableau de bord" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Locations terminées" })).toBeVisible();
    await expect(ligneDe(page, saisie.adresse)).toContainText("Terminée le 30/06/2026");

    // Date à venir : « En cours » avec une fin prévue.
    await page.getByRole("link", { name: saisie.adresse }).click();
    await page.getByRole("link", { name: "Modifier la fin de la location" }).click();
    await attendreHydratation(page);
    await expect(champDate(page, "Date de fin du bail")).toHaveValue(PASSE);
    await expect(page.getByRole("heading", { level: 2, name: "Rouvrir la location" })).toBeVisible();
    await champDate(page, "Date de fin du bail").fill(FUTUR);
    await page.getByRole("button", { name: "Enregistrer la date de fin" }).click();
    await expect(page).toHaveURL(`/locations/${id}`);
    await expect(page.getByRole("main").getByText("En cours", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Retour au tableau de bord" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Locations en cours" })).toBeVisible();
    await expect(ligneDe(page, saisie.adresse)).toContainText("Fin prévue le 31/12/2099");

    // Réouverture.
    await page.getByRole("link", { name: saisie.adresse }).click();
    await page.getByRole("link", { name: "Modifier la fin de la location" }).click();
    await attendreBoutonHydrate(page, "Rouvrir la location");
    await page.getByRole("button", { name: "Rouvrir la location" }).click();
    await expect(page).toHaveURL(`/locations/${id}`);
    await expect(page.getByText("Date de fin du bail", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Mettre fin à la location" })).toBeVisible();

    // Suppression : la page de confirmation nomme la location, sans l'e-mail du locataire.
    await page.getByRole("link", { name: "Supprimer" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Supprimer cette location" })).toBeVisible();
    await expect(page).toHaveTitle("Supprimer la location — Quittances");
    titres.push("Supprimer la location — Quittances");
    await expect(page.getByRole("main")).toContainText(saisie.adresse);
    await expect(page.getByRole("main")).toContainText("69003 Lyon");
    await expect(page.getByRole("main")).toContainText("Zoé O'Brien");
    await expect(page.getByRole("main")).not.toContainText(saisie.email);
    await page.getByRole("link", { name: "Annuler" }).click();
    await expect(page).toHaveURL(`/locations/${id}`);
    expect(await locationsDuCompte(email)).toHaveLength(1);
    await page.getByRole("link", { name: "Supprimer" }).click();
    await attendreBoutonHydrate(page, "Supprimer définitivement");
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByRole("heading", { level: 2, name: "Aucune location pour l'instant" })).toBeVisible();
    expect(await locationsDuCompte(email)).toHaveLength(0);

    // Aucun rechargement de document depuis le tableau de bord initial, ni valeur saisie dans une adresse ou un titre.
    expect(await lireTemoin(page)).toBe("present");
    expect(documents).toEqual([]);
    expect(console_).toEqual([]);
    for (const secret of [saisie.adresse, saisie.nom, "O'Brien", saisie.email, "945,50", "1250", "900"]) {
      for (const a of adresses) expect(a, `adresse demandée contenant ${secret}`).not.toContain(secret);
      for (const t of titres) expect(t).not.toContain(secret);
    }
    expect(new Set(titres)).toEqual(
      new Set(["Location — Quittances", "Modifier la location — Quittances", "Fin de la location — Quittances", "Supprimer la location — Quittances"]),
    );

    // Les quatre adresses de la location supprimée répondent 404.
    for (const sfx of ["", "/modifier", "/fin", "/supprimer"]) {
      const r = await page.context().request.get(`/locations/${id}${sfx}`);
      expect(r.status(), sfx).toBe(404);
    }
  });

  test("CA39, R29 : après la suppression, Précédent ne ressuscite rien : toute action depuis la page restée en mémoire mène à « Location introuvable »", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email);
    const autre = await creerLocation(email);
    await page.goto(`/locations/${L.id}`);
    await page.getByRole("link", { name: "Supprimer" }).click();
    await attendreBoutonHydrate(page, "Supprimer définitivement");
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await page.goBack();
    // Soit la page de confirmation en mémoire, soit déjà l'écran introuvable : jamais une location réécrite.
    const bouton = page.getByRole("button", { name: "Supprimer définitivement" });
    if (await bouton.isVisible().catch(() => false)) {
      await bouton.click();
      await expect(page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
    }
    const restantes = await locationsDuCompte(email);
    expect(restantes.map((l) => l.id)).toEqual([autre.id]);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
    // La location du même compte est intacte.
    await page.goto("/tableau-de-bord");
    await expect(page.getByRole("link", { name: autre.valeurs.address })).toBeVisible();
    await expect(page.getByText(L.valeurs.address)).toHaveCount(0);
  });
});

test.describe("Locations : modification, date de fin, réouverture", () => {
  test("CA32 : la modification est préremplie au format de saisie, enregistre, et la liste suit", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, { rentInCents: 125050, chargesInCents: 0, startDate: "2026-01-05" });
    await ouvrirModifier(page, L.id);
    await expect(page).toHaveTitle("Modifier la location — Quittances");
    await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeVisible();
    await expect(page.getByLabel("Loyer hors charges")).toHaveValue("1250,50");
    await expect(page.getByLabel("Charges", { exact: true })).toHaveValue("0,00");
    await expect(page.getByLabel("Date de début du bail")).toHaveValue("2026-01-05");
    await expect(page.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", `/locations/${L.id}`);
    // Aucun champ ne prend le focus à l'ouverture.
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");

    await page.getByLabel("Loyer hors charges").fill("900");
    await page.getByLabel("Charges", { exact: true }).fill("45,5");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page).toHaveURL(`/locations/${L.id}`);
    expect(sansEspacesSpeciales(await valeurDetail(page, "Total charges comprises"))).toBe("945,50 €");
    await poserTemoin(page);
    await page.getByRole("link", { name: "Retour au tableau de bord" }).click();
    await expect(ligneDe(page, L.valeurs.address)).toBeVisible();
    expect(sansEspacesSpeciales(await ligneDe(page, L.valeurs.address).innerText())).toContain("945,50 € charges comprises");
    expect(await lireTemoin(page)).toBe("present");
  });

  test("CA24, CA34 (formulaire), R34 : la modification en erreur affiche les messages sous les champs, garde les valeurs, place le focus, n'écrit rien", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email);
    const avant = await locationsDuCompte(email);
    await ouvrirModifier(page, L.id);
    await page.getByLabel("Adresse", { exact: true }).fill("");
    await page.getByLabel("Code postal").fill("7501");
    await page.getByLabel("Loyer hors charges").fill("850,555");
    await page.getByLabel("Charges", { exact: true }).fill("-5");
    await page.getByLabel("Jour d'échéance").fill("32");
    await page.getByLabel("Date de début du bail").fill("2027-02-28");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page.getByText("Saisissez l'adresse du logement.")).toBeVisible();
    await expect(page.getByText("Le code postal doit contenir 5 chiffres.")).toBeVisible();
    await expect(page.getByText("Saisissez un montant en euros, par exemple 850 ou 850,50.")).toHaveCount(2);
    await expect(page.getByText("Le jour d'échéance doit être un nombre entier de 1 à 31.")).toBeVisible();
    await expect(page.getByLabel("Adresse", { exact: true })).toBeFocused();
    await expect(page.getByLabel("Adresse", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Code postal")).toHaveValue("7501");
    await expect(page.getByLabel("Charges", { exact: true })).toHaveValue("-5");
    await expect(page.getByLabel("Date de début du bail")).toHaveValue("2027-02-28");
    await expect(page).toHaveURL(`/locations/${L.id}/modifier`);
    expect(await locationsDuCompte(email)).toEqual(avant);
    // Le bouton est de nouveau disponible : on peut corriger et enregistrer.
    await page.getByLabel("Adresse", { exact: true }).fill("5 rue Neuve");
    await page.getByLabel("Code postal").fill("69001");
    await page.getByLabel("Loyer hors charges").fill("850");
    await page.getByLabel("Charges", { exact: true }).fill("0");
    await page.getByLabel("Jour d'échéance").fill("5");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page).toHaveURL(`/locations/${L.id}`);
  });

  test("CA36, L20 à L24, L22 : la date de fin vide, inexistante, hors bornes, antérieure ; la date inexistante revient vide ; L22 sur la modification", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, { startDate: "2026-01-05" });
    const avant = await locationsDuCompte(email);
    const console_ = surveillerConsole(page);
    await ouvrirFin(page, L.id);
    const champ = champDate(page, "Date de fin du bail");
    const envoyer = () => page.getByRole("button", { name: "Enregistrer la date de fin" }).click();
    const erreur = (texte: string) => expect(page.getByRole("main").getByText(texte)).toBeVisible();

    // Vide : L23, focus sur le champ.
    await envoyer();
    await erreur("Saisissez la date de fin du bail.");
    await expect(champ).toBeFocused();
    await expect(champ).toHaveAttribute("aria-invalid", "true");

    // Date inexistante : un champ de date n'accepte pas la saisie, on altère la requête d'envoi.
    await page.route("**/*", async (route) => {
      const requete = route.request();
      const corps = requete.postData();
      if (requete.method() === "POST" && corps?.includes("2026-02-01")) {
        return route.continue({ postData: corps.replace("2026-02-01", "2026-02-30") });
      }
      return route.continue();
    });
    await champ.fill("2026-02-01");
    await envoyer();
    await erreur("Saisissez une date valide.");
    await expect(champ).toHaveValue("");
    await page.unroute("**/*");

    // Hors bornes : la valeur est conservée.
    await champ.fill("2100-01-01");
    await envoyer();
    await erreur("La date doit être comprise entre le 1er janvier 1950 et le 31 décembre 2099.");
    await expect(champ).toHaveValue("2100-01-01");

    // Antérieure au début : L24, valeur conservée.
    await champ.fill("2026-01-04");
    await envoyer();
    await erreur("La date de fin ne peut pas être antérieure à la date de début du bail.");
    await expect(champ).toHaveValue("2026-01-04");
    expect(await locationsDuCompte(email)).toEqual(avant);
    expect(console_).toEqual([]);

    // Égale au début : acceptée (bail d'un jour).
    await champ.fill("2026-01-05");
    await envoyer();
    await expect(page).toHaveURL(`/locations/${L.id}`);
    expect(await valeurDetail(page, "Date de fin du bail")).toBe("05/01/2026");

    // L22 : la date de début portée au-delà de la fin ; rien n'est écrit.
    const apres = await locationsDuCompte(email);
    await ouvrirModifier(page, L.id);
    await page.getByLabel("Date de début du bail").fill("2026-01-06");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await erreur("La date de début ne peut pas être postérieure à la date de fin du bail.");
    await expect(page.getByLabel("Date de début du bail")).toBeFocused();
    await expect(page.getByLabel("Date de début du bail")).toHaveValue("2026-01-06");
    expect(await locationsDuCompte(email)).toEqual(apres);
  });

  test("CA37, R21, R29 : rouvrir une location terminée, puis rejouer la requête de réouverture sans erreur ; rouvrir une location sans fin", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, { endDate: PASSE });
    const requetes: { url: string; entetes: Record<string, string>; corps: Buffer | null }[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.headers()["next-action"]) {
        requetes.push({ url: r.url(), entetes: r.headers(), corps: r.postDataBuffer() });
      }
    });
    await ouvrirFin(page, L.id);
    await expect(champDate(page, "Date de fin du bail")).toHaveValue(PASSE);
    await attendreBoutonHydrate(page, "Rouvrir la location");
    await expect(page.getByText("La date de fin est retirée et la location redevient En cours.")).toBeVisible();
    await page.getByRole("button", { name: "Rouvrir la location" }).click();
    await expect(page).toHaveURL(`/locations/${L.id}`);
    await expect(page.getByRole("main").getByText("En cours", { exact: true })).toBeVisible();
    await expect(page.getByText("Date de fin du bail", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Mettre fin à la location" })).toBeVisible();
    const apres = await locationsDuCompte(email);
    expect(apres[0].end_date).toBeNull();

    // Rejouer la requête : même résultat (redirection vers le détail), sans erreur ni écriture.
    const rejouee = requetes.find((r) => r.url.endsWith("/fin"))!;
    // En-têtes de la requête d'origine, sans ceux que le client HTTP recalcule lui-même.
    const entetes = { ...rejouee.entetes };
    delete entetes.host;
    delete entetes["content-length"];
    const reponse = await page.context().request.post(rejouee.url, { headers: entetes, data: rejouee.corps!, maxRedirects: 0 });
    expect([200, 303]).toContain(reponse.status());
    expect(reponse.headers()["x-action-redirect"] ?? reponse.headers()["location"] ?? "").toContain(`/locations/${L.id}`);
    const apresRejeu = await locationsDuCompte(email);
    expect(apresRejeu[0].end_date).toBeNull();
  });
});

test.describe("Locations : robustesse des formulaires de T6", () => {
  test("R34 : une double activation d'un bouton d'envoi ne produit qu'une demande, bouton indisponible et libellé d'attente pendant la réponse", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, { endDate: PASSE });
    const autre = await creerLocation(email);
    const actions: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.headers()["next-action"]) actions.push(new URL(r.url()).pathname);
    });
    // La réponse est retardée : la seconde activation arrive pendant l'attente.
    await page.route("**/*", async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    const essais: { ouvrir: () => Promise<void>; bouton: string; attente: string; arrivee: RegExp }[] = [
      { ouvrir: () => ouvrirModifier(page, L.id), bouton: "Enregistrer les modifications", attente: "Enregistrement en cours", arrivee: new RegExp(`/locations/${L.id}$`) },
      { ouvrir: () => ouvrirFin(page, L.id), bouton: "Enregistrer la date de fin", attente: "Enregistrement en cours", arrivee: new RegExp(`/locations/${L.id}$`) },
      { ouvrir: async () => { await ouvrirFin(page, L.id); await attendreBoutonHydrate(page, "Rouvrir la location"); }, bouton: "Rouvrir la location", attente: "Réouverture en cours", arrivee: new RegExp(`/locations/${L.id}$`) },
      { ouvrir: () => ouvrirSupprimer(page, autre.id), bouton: "Supprimer définitivement", attente: "Suppression en cours", arrivee: /\/tableau-de-bord$/ },
    ];
    for (const essai of essais) {
      actions.length = 0;
      await essai.ouvrir();
      const bouton = page.getByRole("button", { name: essai.bouton });
      const taille = await bouton.boundingBox();
      await bouton.click();
      const enAttente = page.getByRole("button", { name: essai.attente });
      await expect(enAttente).toBeDisabled();
      await expect(enAttente).toHaveCSS("opacity", "0.6");
      expect((await enAttente.boundingBox())?.height).toBe(taille?.height);
      await enAttente.click({ force: true }).catch(() => {});
      await expect(page).toHaveURL(essai.arrivee);
      expect(actions.filter((a) => !a.endsWith("/tableau-de-bord")).length, essai.bouton).toBe(1);
    }
    // Après la suppression double-cliquée : une seule suppression, l'autre location a bien disparu, et L reste.
    expect((await locationsDuCompte(email)).map((l) => l.id)).toEqual([L.id]);
  });

  test("R29, R30 : après un enregistrement, Précédent et le rechargement ne renvoient pas le formulaire", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email);
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") posts.push(r.url());
    });
    await ouvrirModifier(page, L.id);
    await page.getByLabel("Loyer hors charges").fill("700");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page).toHaveURL(`/locations/${L.id}`);
    const apres = await locationsDuCompte(email);
    expect(posts).toHaveLength(1);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(L.valeurs.address);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Modifier la location" })).toBeVisible();
    expect(posts).toHaveLength(1);
    expect(await locationsDuCompte(email)).toEqual(apres);
    await page.goForward();
    await expect(page).toHaveURL(`/locations/${L.id}`);
    expect(sansEspacesSpeciales(await valeurDetail(page, "Loyer hors charges"))).toBe("700,00 €");
  });

  test("CA27, R11 : le HTML saisi s'affiche comme du texte sur la modification, la fin et la suppression, et survit à un enregistrement ; les textes sont normalisés", async ({ page }) => {
    const { email } = await inscrire(page);
    const adresse = `<img src=x onerror="window.__xss=1"> ${suffixeUnique()}`;
    const nom = `<script>window.__xss=1</script> Zoé "L'Été" & Cie`;
    const L = await creerLocation(email, { address: adresse, tenantName: nom, endDate: PASSE });
    for (const [sfx, titre] of [["modifier", "Modifier la location"], ["fin", "Fin de la location"], ["supprimer", "Supprimer cette location"]]) {
      await page.goto(`/locations/${L.id}/${sfx}`);
      await expect(page.getByRole("heading", { level: 1, name: titre })).toBeVisible();
      if (sfx === "modifier") {
        await expect(page.getByLabel("Adresse", { exact: true })).toHaveValue(adresse);
        await expect(page.getByLabel("Nom du locataire")).toHaveValue(nom);
      } else {
        await expect(page.getByRole("main")).toContainText(adresse);
        await expect(page.getByRole("main")).toContainText(nom);
      }
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    }
    // Aller-retour sans modification, puis avec des espaces à normaliser.
    await ouvrirModifier(page, L.id);
    await page.getByLabel("Ville").fill("  Saint-Étienne   d'Aÿ ");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page).toHaveURL(`/locations/${L.id}`);
    expect(await valeurDetail(page, "Nom")).toBe(nom);
    expect(await valeurDetail(page, "Code postal et ville")).toBe("69003 Saint-Étienne d'Aÿ");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(adresse);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });
});

test.describe("Locations : suppression seulement par POST (R24)", () => {
  test("CA38, R24 : GET, HEAD, préchargement, survol, rechargement n'effacent rien ; seul le POST explicite supprime ; le rejeu répond « introuvable »", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    try {
      const L = await creerLocation(a.email);
      const autre = await creerLocation(a.email);
      const requetes: { url: string; entetes: Record<string, string>; corps: Buffer | null }[] = [];
      a.page.on("request", (r) => {
        if (r.method() === "POST" && r.headers()["next-action"]) {
          requetes.push({ url: r.url(), entetes: r.headers(), corps: r.postDataBuffer() });
        }
      });
      await a.page.goto(`/locations/${L.id}`);
      await a.page.getByRole("link", { name: "Supprimer" }).hover();
      await a.page.getByRole("link", { name: "Supprimer" }).click();
      await attendreBoutonHydrate(a.page, "Supprimer définitivement");
      await expect(a.page).toHaveTitle("Supprimer la location — Quittances");
      await expect(a.page.getByText("Vous allez supprimer définitivement la location suivante.")).toBeVisible();
      await expect(a.page.getByText("Cette action est irréversible. Pour conserver la location sans la supprimer, mettez-y fin.")).toBeVisible();
      // Pas de bouton primaire sur cette page.
      const fonds = await a.page.getByRole("main").locator("a, button").evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
      expect(fonds).not.toContain("rgb(79, 70, 229)");
      // Survol de tous les liens, rechargement, GET, HEAD, préchargement RSC.
      for (const lien of await a.page.getByRole("link").all()) await lien.hover();
      await a.page.reload();
      await expect(a.page.getByRole("heading", { level: 1, name: "Supprimer cette location" })).toBeVisible();
      const ctx = a.contexte.request;
      const chemin = `/locations/${L.id}/supprimer`;
      expect((await ctx.get(chemin)).status()).toBe(200);
      expect((await ctx.head(chemin)).status()).toBe(200);
      expect((await ctx.get(chemin, { headers: { RSC: "1", "Next-Router-Prefetch": "1" } })).status()).toBe(200);
      expect((await ctx.fetch(chemin, { method: "OPTIONS" })).status()).toBeLessThan(500);
      // Un POST ordinaire (sans référence d'action) ne supprime rien.
      await ctx.post(chemin, { form: { confirmer: "oui", delete: "1" }, maxRedirects: 0 });
      expect((await locationsDuCompte(a.email)).map((l) => l.id).sort()).toEqual([L.id, autre.id].sort());

      // « Annuler » ramène au détail, intact.
      const avant = await locationsDuCompte(a.email);
      await a.page.getByRole("link", { name: "Annuler" }).click();
      await expect(a.page).toHaveURL(`/locations/${L.id}`);
      expect(await locationsDuCompte(a.email)).toEqual(avant);

      // Le POST explicite supprime.
      await a.page.getByRole("link", { name: "Supprimer" }).click();
      await attendreBoutonHydrate(a.page, "Supprimer définitivement");
      await a.page.getByRole("button", { name: "Supprimer définitivement" }).click();
      await expect(a.page).toHaveURL(/\/tableau-de-bord$/);
      expect((await locationsDuCompte(a.email)).map((l) => l.id)).toEqual([autre.id]);
      await expect(a.page.getByRole("link", { name: autre.valeurs.address })).toBeVisible();

      // Rejeu de la requête de suppression : « Location introuvable », l'autre location intacte.
      const rejouee = requetes[requetes.length - 1];
      // En-têtes de la requête d'origine, sans ceux que le client HTTP recalcule lui-même.
      const entetes = { ...rejouee.entetes };
      delete entetes.host;
      delete entetes["content-length"];
      const rejeu = await ctx.post(rejouee.url, { headers: entetes, data: rejouee.corps!, maxRedirects: 0 });
      expect(rejeu.status()).toBe(404);
      expect((await locationsDuCompte(a.email)).map((l) => l.id)).toEqual([autre.id]);
    } finally {
      await a.contexte.close();
    }
  });

  test("R24, R7 : un POST forgé par le propriétaire lui-même vers /supprimer, sans passer par la page, supprime sa propre location ; depuis une autre origine il est refusé", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    try {
      const L = await creerLocation(a.email);
      const champs = await champsCaches(a.contexte, `/locations/${L.id}/supprimer`, 0);
      // Autre origine : refusé par Next, rien n'est supprimé.
      const etrangere = await envoyerSansJs(a.contexte, `/locations/${L.id}/supprimer`, champs, {}, { origin: "http://evil.example" });
      expect(etrangere.statut).toBeGreaterThanOrEqual(400);
      expect(await locationsDuCompte(a.email)).toHaveLength(1);
      // Même origine : c'est le POST explicite attendu (la spécification ne demande pas de jeton supplémentaire).
      const propre = await envoyerSansJs(a.contexte, `/locations/${L.id}/supprimer`, champs);
      expect(propre.statut).toBe(303);
      expect(propre.emplacement).toBe("/tableau-de-bord");
      expect(await locationsDuCompte(a.email)).toHaveLength(0);
    } finally {
      await a.contexte.close();
    }
  });
});

test.describe("Locations : parcours sans JavaScript", () => {
  test("CA40, R34 : créer, modifier, mettre fin, rouvrir, supprimer, avec des rechargements, valeurs conservées, rien dans les adresses", async ({ browser }) => {
    const { contexte, email } = await nouveauProprietaire(browser);
    const sansJs = await sansJavaScript(browser, contexte);
    await contexte.close();
    try {
      const page = await sansJs.newPage();
      const adresses = surveillerAdresses(page);
      await page.goto("/locations/nouvelle");
      await page.getByRole("button", { name: "Ajouter la location" }).click();
      await expect(page.getByText("Saisissez l'adresse du logement.")).toBeVisible();
      const saisie = saisieValide({ nom: "Zoé O'Brien", loyer: "1250.5", charges: "0", jour: "31" });
      await remplirLocation(page, saisie);
      await page.getByRole("button", { name: "Ajouter la location" }).click();
      await expect(page).toHaveURL(/\/locations\/[0-9a-f-]{36}$/);
      const id = page.url().split("/").pop()!;

      // Modification : valeurs invalides conservées, puis correction.
      await page.getByRole("link", { name: "Modifier", exact: true }).click();
      await expect(page.getByLabel("Loyer hors charges")).toHaveValue("1250,50");
      await page.getByLabel("Loyer hors charges").fill("850,555");
      await page.getByLabel("Ville").fill("");
      await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
      await expect(page.getByText("Saisissez un montant en euros, par exemple 850 ou 850,50.")).toBeVisible();
      await expect(page.getByText("Saisissez la ville.")).toBeVisible();
      await expect(page.getByLabel("Loyer hors charges")).toHaveValue("850,555");
      await expect(page.getByLabel("Adresse", { exact: true })).toHaveValue(saisie.adresse);
      await page.getByLabel("Loyer hors charges").fill("900");
      await page.getByLabel("Ville").fill("Lyon");
      await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
      await expect(page).toHaveURL(`/locations/${id}`);
      expect(sansEspacesSpeciales(await valeurDetail(page, "Loyer hors charges"))).toBe("900,00 €");

      // Fin : erreurs au bon champ, puis date passée.
      await page.getByRole("link", { name: "Mettre fin à la location" }).click();
      await page.getByRole("button", { name: "Enregistrer la date de fin" }).click();
      await expect(page.getByText("Saisissez la date de fin du bail.")).toBeVisible();
      await champDate(page, "Date de fin du bail").fill("2026-01-04");
      await page.getByRole("button", { name: "Enregistrer la date de fin" }).click();
      await expect(page.getByText("La date de fin ne peut pas être antérieure à la date de début du bail.")).toBeVisible();
      await expect(champDate(page, "Date de fin du bail")).toHaveValue("2026-01-04");
      await champDate(page, "Date de fin du bail").fill(PASSE);
      await page.getByRole("button", { name: "Enregistrer la date de fin" }).click();
      await expect(page).toHaveURL(`/locations/${id}`);
      await expect(page.getByRole("main").getByText("Terminée", { exact: true })).toBeVisible();

      // Réouverture.
      await page.getByRole("link", { name: "Modifier la fin de la location" }).click();
      await page.getByRole("button", { name: "Rouvrir la location" }).click();
      await expect(page).toHaveURL(`/locations/${id}`);
      await expect(page.getByRole("main").getByText("En cours", { exact: true })).toBeVisible();
      await expect(page.getByText("Date de fin du bail", { exact: true })).toHaveCount(0);

      // Suppression.
      await page.getByRole("link", { name: "Supprimer" }).click();
      await page.getByRole("button", { name: "Supprimer définitivement" }).click();
      await expect(page).toHaveURL(/\/tableau-de-bord$/);
      await expect(page.getByRole("heading", { level: 2, name: "Aucune location pour l'instant" })).toBeVisible();
      expect(await locationsDuCompte(email)).toHaveLength(0);
      expect((await sansJs.request.get(`/locations/${id}`)).status()).toBe(404);
      for (const a of adresses) {
        for (const secret of [saisie.adresse, saisie.nom, saisie.email, "850", "900"]) expect(a).not.toContain(secret);
      }
    } finally {
      await sansJs.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Isolation : le cœur de la recette
// ---------------------------------------------------------------------------

test.describe("Locations : isolation sur les quatre actions (A et B)", () => {
  for (const op of OPERATIONS) {
    for (const valide of op.nom === "rouvrir" || op.nom === "supprimer" ? [true] : [true, false]) {
      test(`CA34 : B envoie « ${op.nom} » (${valide ? "champs valides" : "champs invalides"}) avec l'identifiant lié remplacé par celui de A : « Location introuvable », A intact`, async ({ browser }) => {
        const a = await nouveauProprietaire(browser);
        const b = await nouveauProprietaire(browser);
        try {
          const la = await creerLocation(a.email, { endDate: PASSE, address: `SECRET-ADR-${suffixeUnique()}` });
          const lb = await creerLocation(b.email, { endDate: PASSE });
          const avantA = await locationsDuCompte(a.email);
          const avantB = await locationsDuCompte(b.email);
          if (op.page === "supprimer") await ouvrirSupprimer(b.page, lb.id);
          else if (op.nom === "rouvrir") {
            await ouvrirFin(b.page, lb.id);
            await attendreBoutonHydrate(b.page, "Rouvrir la location");
          } else await (op.page === "modifier" ? ouvrirModifier : ouvrirFin)(b.page, lb.id);
          const console_ = surveillerConsole(b.page, { tolerer404: true });
          const attaque = await remplacerIdentifiantLie(b.page, lb.id, la.id);
          await op.saisir(b.page, valide);
          await b.page.getByRole("button", { name: op.bouton }).click();
          await expect(b.page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
          // L'attaque a réellement eu lieu, et jamais un message de validation.
          expect(attaque.remplacements).toBeGreaterThan(0);
          expect(attaque.statuts).toEqual([404]);
          await expect(b.page.getByText("Saisissez")).toHaveCount(0);
          await expect(b.page.getByText("doit être")).toHaveCount(0);
          expect(await b.page.content()).not.toContain("SECRET-");
          expect(console_.filter((m) => !m.includes("404"))).toEqual([]);
          // A, relue en base et à l'écran, est identique ; B n'a rien écrit.
          expect(await locationsDuCompte(a.email)).toEqual(avantA);
          expect(await locationsDuCompte(b.email)).toEqual(avantB);
          await a.page.goto(`/locations/${la.id}`);
          await expect(a.page.getByRole("heading", { level: 1 })).toContainText(la.valeurs.address);
          await expect(a.page.getByRole("main").getByText("Terminée", { exact: true })).toBeVisible();
        } finally {
          await a.contexte.close();
          await b.contexte.close();
        }
      });
    }
  }

  test("CA34, R5, R7 : les mêmes envois sans JavaScript (POST direct, identifiant remplacé, champs parasites, types inattendus) donnent la réponse d'une location inconnue ; rien n'est écrit", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email, { endDate: PASSE, address: `SECRET-ADR-${suffixeUnique()}` });
      const lb = await creerLocation(b.email, { endDate: PASSE });
      const idDuCompteA = await identifiantDuCompte(a.email);
      const avantA = await locationsDuCompte(a.email);
      let avantB = await locationsDuCompte(b.email);
      for (const op of OPERATIONS) {
        for (const champsEnvoyes of [op.valides, op.invalides]) {
          const base = await champsCaches(b.contexte, `/locations/${lb.id}/${op.page}`, op.formulaire);
          const vers = (f: (v: string) => string) => base.map(([k, v]) => [k, f(v)] as [string, string]);
          const chemin = `/locations/${lb.id}/${op.page}`;
          const variantes: Record<string, Awaited<ReturnType<typeof envoyerSansJs>>> = {
            inconnu: await envoyerSansJs(b.contexte, chemin, vers((v) => v.split(lb.id).join(UUID_INCONNU)), champsEnvoyes),
            deA: await envoyerSansJs(b.contexte, chemin, vers((v) => v.split(lb.id).join(la.id)), champsEnvoyes),
            deAMajuscules: await envoyerSansJs(b.contexte, chemin, vers((v) => v.split(lb.id).join(la.id.toUpperCase())), champsEnvoyes),
            adresseDeA: await envoyerSansJs(b.contexte, `/locations/${la.id}/${op.page}`, vers((v) => v.split(lb.id).join(la.id)), champsEnvoyes),
            parasites: await envoyerSansJs(b.contexte, chemin, vers((v) => v.split(lb.id).join(la.id)), {
              ...champsEnvoyes, id: la.id, rentalId: la.id, ownerId: idDuCompteA, owner_id: idDuCompteA, endDate: "2020-01-01",
            }),
            nombre: await envoyerSansJs(b.contexte, chemin, vers((v) => v.replace(`"${lb.id}"`, "12345")), champsEnvoyes),
            nul: await envoyerSansJs(b.contexte, chemin, vers((v) => v.replace(`"${lb.id}"`, "null")), champsEnvoyes),
            tableau: await envoyerSansJs(b.contexte, chemin, vers((v) => v.replace(`"${lb.id}"`, `["${la.id}"]`)), champsEnvoyes),
            injection: await envoyerSansJs(b.contexte, chemin, vers((v) => v.replace(`"${lb.id}"`, `"' or 1=1 --"`)), champsEnvoyes),
          };
          for (const [nom, reponse] of Object.entries(variantes)) {
            expect(reponse.statut, `${op.nom} ${nom}`).toBe(404);
            expect(reponse.corps, `${op.nom} ${nom} identique à « inconnu »`).toBe(variantes.inconnu.corps);
            expect(reponse.corps).not.toContain("SECRET-");
          }
          expect(await locationsDuCompte(a.email), op.nom).toEqual(avantA);
          expect(await locationsDuCompte(b.email), op.nom).toEqual(avantB);
        }
        avantB = await locationsDuCompte(b.email);
      }
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("R4, R7 : un envoi légitime de B (identifiant lié à sa propre location) portant des champs id, rentalId, ownerId visant A n'écrit que chez B, jamais chez A", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email, { endDate: PASSE });
      const idDuCompteA = await identifiantDuCompte(a.email);
      const avantA = await locationsDuCompte(a.email);
      for (const op of OPERATIONS) {
        const lb = await creerLocation(b.email, { endDate: PASSE });
        const champs = await champsCaches(b.contexte, `/locations/${lb.id}/${op.page}`, op.formulaire);
        const reponse = await envoyerSansJs(b.contexte, `/locations/${lb.id}/${op.page}`, champs, {
          ...op.valides, id: la.id, rentalId: la.id, rental_id: la.id, ownerId: idDuCompteA, owner_id: idDuCompteA,
        });
        // C'est un envoi valable de B sur sa propre location : il aboutit.
        expect(reponse.statut, op.nom).toBe(303);
        expect(reponse.emplacement).toBe(op.nom === "supprimer" ? "/tableau-de-bord" : `/locations/${lb.id}`);
        expect(await locationsDuCompte(a.email), `${op.nom} : A intact`).toEqual(avantA);
      }
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("R7 : les quatre actions sans session redirigent vers /connexion sans paramètre retour, avec une session expirée aussi, sans écrire", async ({ browser, playwright }) => {
    const a = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email, { endDate: PASSE });
      const avant = await locationsDuCompte(a.email);
      const anonyme = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
      for (const op of OPERATIONS) {
        const champs = await champsCaches(a.contexte, `/locations/${la.id}/${op.page}`, op.formulaire);
        const sansSession = await anonyme.post(`/locations/${la.id}/${op.page}`, {
          multipart: { ...Object.fromEntries(champs), ...op.valides }, maxRedirects: 0,
        });
        expect(sansSession.status(), op.nom).toBe(303);
        expect(sansSession.headers()["location"], op.nom).toMatch(/^\/connexion$/);
        expect(await locationsDuCompte(a.email)).toEqual(avant);
      }
      // Session expirée : les champs ont été lus avant l'expiration.
      const prets = [];
      for (const op of OPERATIONS) prets.push({ op, champs: await champsCaches(a.contexte, `/locations/${la.id}/${op.page}`, op.formulaire) });
      await expirerSession(a.email);
      for (const { op, champs } of prets) {
        const expiree = await a.contexte.request.post(`/locations/${la.id}/${op.page}`, {
          multipart: { ...Object.fromEntries(champs), ...op.valides }, maxRedirects: 0,
        });
        expect(expiree.status(), op.nom).toBe(303);
        expect(expiree.headers()["location"], op.nom).toMatch(/^\/connexion$/);
      }
      expect(await locationsDuCompte(a.email)).toEqual(avant);
      await anonyme.dispose();
    } finally {
      await a.contexte.close();
    }
  });

  test("R7, CA34 : depuis une autre origine, les quatre actions sont refusées et n'écrivent rien", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email, { endDate: PASSE });
      const avant = await locationsDuCompte(a.email);
      for (const op of OPERATIONS) {
        const champs = await champsCaches(a.contexte, `/locations/${la.id}/${op.page}`, op.formulaire);
        for (const origine of ["http://evil.example", "null"]) {
          const r = await envoyerSansJs(a.contexte, `/locations/${la.id}/${op.page}`, champs, op.valides, { origin: origine });
          expect(r.statut, `${op.nom} depuis ${origine}`).toBeGreaterThanOrEqual(400);
          expect(r.emplacement).toBeUndefined();
        }
        expect(await locationsDuCompte(a.email)).toEqual(avant);
      }
    } finally {
      await a.contexte.close();
    }
  });

  test("CA29, CA30, R5 : B demande /modifier, /fin, /supprimer de A : 404 identiques à une location inconnue (HTML et charge RSC), rien de A", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email, { address: `SECRET-ADR-${suffixeUnique()}`, tenantName: `SECRET-NOM-${suffixeUnique()}` });
      const avant = await locationsDuCompte(a.email);
      for (const sfx of ["modifier", "fin", "supprimer"]) {
        for (const entetes of [{}, { RSC: "1" }] as Record<string, string>[]) {
          const demander = async (id: string) => {
            const r = await b.contexte.request.get(`/locations/${id}/${sfx}`, { headers: entetes });
            return { r, corps: await r.text() };
          };
          const deA = await demander(la.id);
          const inconnue = await demander(UUID_INCONNU);
          for (const x of [deA, inconnue]) {
            if (entetes.RSC) expect(x.corps).toContain("Location introuvable"); else expect(x.r.status(), sfx).toBe(404);
            expect(x.r.headers()["cache-control"]).toMatch(/private|no-store/);
            expect(x.corps).not.toContain("SECRET-");
            expect(x.corps).not.toContain(la.valeurs.tenantEmail);
          }
          expect(deA.r.status()).toBe(inconnue.r.status());
          expect(normaliser(deA.corps)).toBe(normaliser(inconnue.corps));
        }
        const console_ = surveillerConsole(b.page, { tolerer404: true });
        await b.page.goto(`/locations/${la.id}/${sfx}`);
        await expect(b.page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
        await expect(b.page).toHaveTitle("Location introuvable — Quittances");
        await expect(b.page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
        expect(await b.page.content()).not.toContain("SECRET-");
        expect(console_).toEqual([]);
      }
      expect(await locationsDuCompte(a.email)).toEqual(avant);
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("CA30, R28 : sans session, /modifier, /fin, /supprimer redirigent vers /connexion?retour= sans contenu ; après connexion, le propriétaire arrive sur le formulaire prérempli, un autre compte sur « Location introuvable »", async ({ browser, playwright }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email, { address: `SECRET-ADR-${suffixeUnique()}`, tenantName: `SECRET-NOM-${suffixeUnique()}` });
      const anonyme = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
      for (const sfx of ["modifier", "fin", "supprimer"]) {
        for (const id of [la.id, UUID_INCONNU]) {
          const r = await anonyme.get(`/locations/${id}/${sfx}`, { maxRedirects: 0 });
          expect(r.status()).toBe(307);
          expect(r.headers()["location"]).toBe(`/connexion?retour=${encodeURIComponent(`/locations/${id}/${sfx}`)}`);
          const corps = await r.text();
          for (const interdit of ["SECRET-", "Location introuvable", "Modifier la location", "Fin de la location", "Supprimer cette location", "Date de fin du bail"]) {
            expect(corps).not.toContain(interdit);
          }
        }
      }
      await anonyme.dispose();

      // Le propriétaire se connecte depuis le lien de retour.
      await deconnecter(a.page);
      await ouvrirConnexion(a.page, `/connexion?retour=${encodeURIComponent(`/locations/${la.id}/modifier`)}`);
      await remplirEtSeConnecter(a.page, a.email, a.motDePasse);
      await expect(a.page).toHaveURL(`/locations/${la.id}/modifier`);
      await expect(a.page.getByLabel("Adresse", { exact: true })).toHaveValue(la.valeurs.address);
      // Un autre compte arrive sur l'écran introuvable.
      await deconnecter(b.page);
      await ouvrirConnexion(b.page, `/connexion?retour=${encodeURIComponent(`/locations/${la.id}/supprimer`)}`);
      await remplirEtSeConnecter(b.page, b.email, b.motDePasse);
      await expect(b.page).toHaveURL(`/locations/${la.id}/supprimer`);
      await expect(b.page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
      expect(await b.page.content()).not.toContain("SECRET-");
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("R4, CA9 : quand le compte de A disparaît de la base, ses locations disparaissent, celles de B restent", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      await creerLocation(a.email);
      await creerLocation(a.email);
      const lb = await creerLocation(b.email);
      await supprimerCompte(a.email);
      expect(await locationsDuCompte(a.email)).toHaveLength(0);
      expect((await locationsDuCompte(b.email)).map((l) => l.id)).toEqual([lb.id]);
      await b.page.goto("/tableau-de-bord");
      await expect(b.page.getByRole("link", { name: lb.valeurs.address })).toBeVisible();
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("R43 : l'adresse e-mail du locataire n'est que dans le détail et le formulaire de modification, jamais dans la liste, la date de fin, la suppression, une adresse ou un titre", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, { endDate: PASSE });
    const adresses = surveillerAdresses(page);
    const titres: string[] = [];
    const contient = async (chemin: string, titre: string) => {
      await page.goto(chemin);
      await expect(page.getByRole("heading", { level: 1, name: titre })).toBeVisible();
      titres.push(await page.title());
      return (await page.content()).includes(L.valeurs.tenantEmail);
    };
    expect(await contient("/tableau-de-bord", "Tableau de bord")).toBe(false);
    expect(await contient(`/locations/${L.id}/fin`, "Fin de la location")).toBe(false);
    expect(await contient(`/locations/${L.id}/supprimer`, "Supprimer cette location")).toBe(false);
    expect(await contient(`/locations/${L.id}`, L.valeurs.address)).toBe(true);
    expect(await contient(`/locations/${L.id}/modifier`, "Modifier la location")).toBe(true);
    for (const a of adresses) {
      expect(a).not.toContain(L.valeurs.tenantEmail);
      expect(a).not.toContain(L.valeurs.tenantName);
      expect(a).not.toContain(L.valeurs.address);
    }
    for (const t of titres) {
      expect(t).not.toContain(L.valeurs.tenantName);
      expect(t).not.toContain(L.valeurs.address);
    }
  });
});

// ---------------------------------------------------------------------------
// Deux onglets
// ---------------------------------------------------------------------------

test.describe("Locations : deux onglets du même compte", () => {
  test("R26, R29 : supprimée dans un onglet, la location ne renaît pas depuis les autres (modifier, fin, rouvrir, supprimer) : « Location introuvable », aucune ligne créée", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    try {
      const L = await creerLocation(a.email, { endDate: PASSE });
      const autre = await creerLocation(a.email);
      const onglets = { modifier: await a.contexte.newPage(), fin: await a.contexte.newPage(), rouvrir: await a.contexte.newPage(), supprimer: await a.contexte.newPage() };
      await ouvrirModifier(onglets.modifier, L.id);
      await ouvrirFin(onglets.fin, L.id);
      await ouvrirFin(onglets.rouvrir, L.id);
      await attendreBoutonHydrate(onglets.rouvrir, "Rouvrir la location");
      await ouvrirSupprimer(onglets.supprimer, L.id);

      await onglets.supprimer.getByRole("button", { name: "Supprimer définitivement" }).click();
      await expect(onglets.supprimer).toHaveURL(/\/tableau-de-bord$/);
      expect((await locationsDuCompte(a.email)).map((l) => l.id)).toEqual([autre.id]);

      await onglets.modifier.getByLabel("Ville").fill("Marseille");
      await onglets.modifier.getByRole("button", { name: "Enregistrer les modifications" }).click();
      await expect(onglets.modifier.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();

      await champDate(onglets.fin, "Date de fin du bail").fill("2026-07-01");
      await onglets.fin.getByRole("button", { name: "Enregistrer la date de fin" }).click();
      await expect(onglets.fin.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();

      await onglets.rouvrir.getByRole("button", { name: "Rouvrir la location" }).click();
      await expect(onglets.rouvrir.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();

      // Rien n'a été recréé, la location du même compte est intacte.
      const restantes = await locationsDuCompte(a.email);
      expect(restantes.map((l) => l.id)).toEqual([autre.id]);
      expect(restantes[0].end_date).toBeNull();
    } finally {
      await a.contexte.close();
    }
  });

  test("R26 : modification dans deux onglets, le dernier enregistrement l'emporte, sans erreur", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    try {
      const L = await creerLocation(a.email, { city: "Lyon", rentInCents: 85000 });
      const premier = a.page;
      const second = await a.contexte.newPage();
      await ouvrirModifier(premier, L.id);
      await ouvrirModifier(second, L.id);
      await second.getByLabel("Ville").fill("Nantes");
      await second.getByRole("button", { name: "Enregistrer les modifications" }).click();
      await expect(second).toHaveURL(`/locations/${L.id}`);
      expect(await valeurDetail(second, "Code postal et ville")).toContain("Nantes");
      await premier.getByLabel("Loyer hors charges").fill("700");
      await premier.getByRole("button", { name: "Enregistrer les modifications" }).click();
      await expect(premier).toHaveURL(`/locations/${L.id}`);
      await expect(premier.getByText("Saisissez")).toHaveCount(0);
      // Les valeurs du premier onglet remplacent celles du second, sans avertissement (limite acceptée).
      expect(await valeurDetail(premier, "Code postal et ville")).toContain("Lyon");
      expect(sansEspacesSpeciales(await valeurDetail(premier, "Loyer hors charges"))).toBe("700,00 €");
    } finally {
      await a.contexte.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Page 404 générale
// ---------------------------------------------------------------------------

test.describe("Page 404 générale", () => {
  test("Une adresse inconnue répond 404, en français, avec un lien vers l'accueil, sans donnée de session, pareil connecté ou non ; sous /locations/<id>/… c'est « Location introuvable »", async ({ browser, playwright }) => {
    const a = await nouveauProprietaire(browser);
    try {
      const anonyme = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
      const visiteur = await anonyme.get("/cette-page-n-existe-pas");
      const connecte = await a.contexte.request.get("/cette-page-n-existe-pas");
      expect(visiteur.status()).toBe(404);
      expect(connecte.status()).toBe(404);
      // Même contenu : aucune donnée de session. Les jetons internes de Next varient d'une requête à l'autre.
      const sansJetons = (s: string) => s.replace(/"[A-Za-z0-9_-]{20,}"/g, '"J"').replace(/\/_next\/static\/[^"']+/g, "S");
      expect(sansJetons(await connecte.text())).toBe(sansJetons(await visiteur.text()));
      expect(await connecte.text()).not.toContain(a.email);
      expect(connecte.headers()["set-cookie"]).toBeUndefined();
      await anonyme.dispose();

      const console_ = surveillerConsole(a.page, { tolerer404: true });
      const reponse = await a.page.goto("/cette-page-n-existe-pas");
      expect(reponse?.status()).toBe(404);
      await expect(a.page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(a.page.getByRole("main")).toHaveCount(1);
      await expect(a.page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(a.page).toHaveTitle("Page introuvable — Quittances");
      await expect(a.page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
      await expect(a.page.getByText("Cette page n'existe pas ou a été déplacée.")).toBeVisible();
      await expect(a.page.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
      await expect(a.page.getByRole("button", { name: "Se déconnecter" })).toHaveCount(0);
      const lien = a.page.getByRole("main").getByRole("link");
      await expect(lien).toHaveAttribute("href", "/");
      // Le lien passe par Link : aucune requête de document.
      await poserTemoin(a.page);
      await attendreHydratationLien(a.page);
      await lien.click();
      await expect(a.page).toHaveURL(/\/$/);
      expect(await lireTemoin(a.page)).toBe("present");
      expect(console_).toEqual([]);


      // Sous /locations/<id>/…, l'écran reste « Location introuvable », jamais la page générale.
      await a.page.goto(`/locations/${UUID_INCONNU}/inconnue`);
      await expect(a.page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
      await a.page.goto(`/locations/${UUID_INCONNU}`);
      await expect(a.page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
      // Hors de /locations, une adresse proche reste la page générale.
      const proche = await a.contexte.request.get("/locationsx");
      expect(proche.status()).toBe(404);
      expect(await proche.text()).not.toContain("Location introuvable");
    } finally {
      await a.contexte.close();
    }
  });
});

async function attendreHydratationLien(page: Page) {
  const lien = page.getByRole("main").getByRole("link");
  await expect
    .poll(() => lien.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))))
    .toBe(true);
}

// ---------------------------------------------------------------------------
// Accessibilité, clavier, rendu, cache
// ---------------------------------------------------------------------------

test.describe("Locations : accessibilité, clavier, rendu et cache des pages de T6", () => {
  async function analyser(page: Page, nom: string) {
    const resultat = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(resultat.violations.map((v) => `${nom}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  }

  test("CA42 : axe sans violation sur la modification, la fin (avec et sans date) et la suppression, à l'état initial et en erreur", async ({ page }) => {
    const { email } = await inscrire(page);
    const sansFin = await creerLocation(email);
    const avecFin = await creerLocation(email, { endDate: PASSE });
    await ouvrirModifier(page, sansFin.id);
    await analyser(page, "modifier");
    await page.getByLabel("Ville").fill("");
    await page.getByLabel("Loyer hors charges").fill("abc");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page.getByText("Saisissez la ville.")).toBeVisible();
    await analyser(page, "modifier en erreur");
    await ouvrirFin(page, sansFin.id);
    await analyser(page, "fin sans date");
    await page.getByRole("button", { name: "Enregistrer la date de fin" }).click();
    await expect(page.getByText("Saisissez la date de fin du bail.")).toBeVisible();
    await analyser(page, "fin en erreur");
    await ouvrirFin(page, avecFin.id);
    await analyser(page, "fin avec date et réouverture");
    await ouvrirSupprimer(page, avecFin.id);
    await analyser(page, "suppression");
    await page.goto("/page-qui-n-existe-pas");
    await analyser(page, "404 générale");
  });

  test("CA44, R40 : au clavier seul, le logo en premier, puis les champs, le bouton et Annuler ; les boutons destructifs ont un nom accessible", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, { endDate: PASSE });
    await ouvrirSupprimer(page, L.id);
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (const element of [
      page.getByRole("link", { name: "Quittances, tableau de bord" }),
      page.getByRole("button", { name: "Se déconnecter" }),
      page.getByRole("button", { name: "Supprimer définitivement" }),
      page.getByRole("link", { name: "Annuler" }),
    ]) {
      await page.keyboard.press("Tab");
      await expect(element).toBeFocused();
    }
    // Focus visible sur le bouton destructif.
    await page.getByRole("button", { name: "Supprimer définitivement" }).focus();
    await expect(page.getByRole("button", { name: "Supprimer définitivement" })).not.toHaveCSS("outline-style", "none");
    // Page de fin : le champ puis le bouton, puis Annuler, puis Rouvrir.
    await ouvrirFin(page, L.id);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Quittances, tableau de bord" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(champDate(page, "Date de fin du bail")).toBeFocused();
    const bouton = page.getByRole("button", { name: "Enregistrer la date de fin" });
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      if (await bouton.evaluate((e) => e === document.activeElement)) break;
    }
    await expect(bouton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Annuler" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Rouvrir la location" })).toBeFocused();
  });

  test("CA43, R40 : pas de défilement horizontal de 320 à 1920px avec des valeurs longues ; bouton « Supprimer définitivement » destructif de 44px, sans fond primaire ; champ de date aligné sur les autres", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, {
      address: "A".repeat(200), tenantName: "N".repeat(100), city: "V".repeat(100),
      rentInCents: 9999999, chargesInCents: 9999999, endDate: PASSE,
    });
    for (const largeur of [320, 412, 768, 1280, 1920]) {
      await page.setViewportSize({ width: largeur, height: 900 });
      for (const [sfx, titre] of [["modifier", "Modifier la location"], ["fin", "Fin de la location"], ["supprimer", "Supprimer cette location"]]) {
        await page.goto(`/locations/${L.id}/${sfx}`);
        await expect(page.getByRole("heading", { level: 1, name: titre })).toBeVisible();
        const defile = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(defile, `${sfx} à ${largeur}px`).toBe(false);
        const colonne = await page.getByRole("main").locator("form").first().evaluate((f) => f.getBoundingClientRect().width);
        expect(colonne).toBeLessThanOrEqual(640);
      }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/locations/${L.id}/supprimer`);
    const destructif = page.getByRole("button", { name: "Supprimer définitivement" });
    await expect(destructif).toHaveCSS("border-top-color", "rgb(239, 68, 68)");
    await expect(destructif).toHaveCSS("color", "rgb(185, 28, 28)");
    await expect(destructif).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(destructif).toHaveCSS("border-radius", "6px");
    expect((await destructif.boundingBox())?.height).toBe(44);
    // Le rappel ne coupe pas un montant et la page n'a aucun bouton primaire.
    await page.goto(`/locations/${L.id}/modifier`);
    const date = page.getByLabel("Date de début du bail");
    const ville = page.getByLabel("Ville");
    expect((await date.boundingBox())?.height).toBe((await ville.boundingBox())?.height);
    for (const prop of ["border-top-color", "border-top-left-radius", "background-color"]) {
      expect(await date.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop)).toBe(
        await ville.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop),
      );
    }
  });

  test("CA46, R30 : les trois pages et leur 404 ne sont jamais en cache partagé", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email);
    for (const sfx of ["modifier", "fin", "supprimer"]) {
      const r = await page.context().request.get(`/locations/${L.id}/${sfx}`);
      expect(r.status()).toBe(200);
      expect(r.headers()["cache-control"], sfx).toMatch(/private|no-store/);
    }
  });
});
