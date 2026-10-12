import { expect, test, type Browser, type Page } from "@playwright/test";

import { inscrire } from "./aide-comptes";
import {
  archiverEnBase,
  creerLocationArchivee,
  etatLocation,
  jourDeParis,
  nombreDeQuittances,
  occurrencesEnBase,
} from "./aide-archives";
import {
  attendreHydratation,
  creerLocation,
  locationsDuCompte,
  ouvrirCreation,
  poserTemoin,
  lireTemoin,
  remplirLocation,
  saisieValide,
  suffixeUnique,
} from "./aide-locations";
import {
  attendreBouton,
  bailleurEnBase,
  champsCaches,
  creerQuittanceEnBase,
  envoyerSansJs,
  ligneQuittance,
  produireParInterface,
  quittancesDuCompte,
  surveillerConsole,
  surveillerDocuments,
  telechargerPdf,
  valeursBailleur,
} from "./aide-quittances";

// Recette de T5 de la spécification 04 : archivage des locations, archives,
// consultation seule, suppression définitive (R19, R39 à R43 ; CA39, CA46 à CA57,
// parcours 5 et 6). Chaque test crée ses comptes et ses données. Les dates de
// fin sont fixes et passées (2026-03-20, 2026-06-30) ; seul le test de la règle
// « terminée » dépend du jour, et il le prend sur l'horloge de Paris (R38).

const PHRASE_A =
  "Une location ne peut être archivée qu'une fois terminée, c'est-à-dire le lendemain de sa date de fin.";
const PHRASE_B =
  "Une location qui a des quittances ne peut pas être supprimée directement. Archivez-la, puis supprimez-la depuis les archives.";
const BANDEAU_FIN =
  "Elle n'apparaît plus au tableau de bord et ne peut plus être modifiée. Restaurez-la pour la modifier ou produire une quittance.";
const BAIL = { startDate: "2026-01-15", endDate: "2026-03-20" } as const;

const lien = (page: Page, nom: string) => page.getByRole("link", { name: nom, exact: true });
const bouton = (page: Page, nom: string) => page.getByRole("button", { name: nom });
const detailUrl = (id: string) => new RegExp(`/locations/${id}$`);

/** Un compte avec ses informations de bailleur. */
async function compte(page: Page) {
  const { email } = await inscrire(page);
  await bailleurEnBase(email, valeursBailleur(suffixeUnique()));
  return email;
}

test.describe("Archivage : parcours d'une location qui a une histoire", () => {
  test("CA46, CA49, CA50, CA51, CA52, parcours 5 : créer, deux quittances, fin, archiver, archives, télécharger, restaurer, une de plus, archiver, supprimer définitivement", async ({
    page,
  }) => {
    const console_ = surveillerConsole(page);
    const email = await compte(page);

    // Création par le formulaire.
    await ouvrirCreation(page);
    const saisie = saisieValide({ debut: "2026-01-15" });
    await remplirLocation(page, saisie);
    await bouton(page, "Ajouter la location").click();
    await expect(page).toHaveURL(/\/locations\/[0-9a-f-]{36}$/);
    const id = (await locationsDuCompte(email))[0].id;

    // Deux quittances.
    await produireParInterface(page, id, { mois: "2026-01", date: "2026-01-20" });
    await produireParInterface(page, id, { mois: "2026-02", date: "2026-02-05" });
    expect(await quittancesDuCompte(email)).toHaveLength(2);

    // En cours avec quittances : ni Archiver ni Supprimer, phrases A puis B.
    await expect(lien(page, "Archiver")).toHaveCount(0);
    await expect(lien(page, "Supprimer")).toHaveCount(0);
    const paragraphes = await page.getByRole("main").locator("p.text-text-secondary").allTextContents();
    expect(paragraphes.filter((t) => t === PHRASE_A || t === PHRASE_B)).toEqual([PHRASE_A, PHRASE_B]);

    // Le PDF avant archivage.
    const avant = await telechargerPdf(page, page.getByRole("link", { name: "Télécharger la quittance, janvier 2026" }));
    expect(avant.statut).toBe(200);
    const idJanvier = (await quittancesDuCompte(email)).find((q) => q.month === "2026-01")!.id;

    // Mettre fin, date passée.
    await lien(page, "Mettre fin à la location").click();
    await attendreHydratation(page);
    await page.getByLabel("Date de fin du bail").fill("2026-03-20");
    await bouton(page, "Enregistrer la date de fin").click();
    await expect(page).toHaveURL(detailUrl(id));
    await expect(page.getByRole("main").getByText("Terminée", { exact: true })).toBeVisible();
    await expect(lien(page, "Archiver")).toHaveAttribute("href", `/locations/${id}/archiver`);
    await expect(lien(page, "Supprimer")).toHaveCount(0);
    await expect(page.getByText(PHRASE_A)).toHaveCount(0);
    await expect(page.getByText(PHRASE_B)).toBeVisible();

    // Page d'archivage : textes, Annuler, puis archivage. Aucune requête de document.
    const documents = surveillerDocuments(page);
    await poserTemoin(page);
    await lien(page, "Archiver").click();
    await expect(page).toHaveURL(`/locations/${id}/archiver`);
    await expect(page).toHaveTitle("Archiver la location — Quittances");
    await expect(page.getByRole("heading", { level: 1, name: "Archiver cette location" })).toBeVisible();
    await expect(page.getByText("Vous allez archiver la location suivante.")).toBeVisible();
    await expect(
      page.getByText(
        "La location quitte le tableau de bord et rejoint les archives avec ses quittances, qui restent téléchargeables. Rien n'est effacé et vous pourrez la restaurer à tout moment.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("main").getByText(saisie.adresse)).toBeVisible();
    await expect(page.getByRole("main").getByText(saisie.nom)).toBeVisible();
    // Un survol, un focus et un rechargement n'archivent rien.
    await bouton(page, "Archiver la location").hover();
    await bouton(page, "Archiver la location").focus();
    await page.reload();
    expect((await etatLocation(id))!.archived_at).toBeNull();
    await poserTemoin(page);
    await lien(page, "Annuler").click();
    await expect(page).toHaveURL(detailUrl(id));
    await lien(page, "Archiver").click();
    await attendreBouton(page, "Archiver la location");
    await bouton(page, "Archiver la location").click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByRole("heading", { level: 2, name: "Aucune location pour l'instant" })).toBeVisible();
    expect((await etatLocation(id))!.archived_at).not.toBeNull();
    expect(await lireTemoin(page)).toBe("present");
    // Seul le rechargement volontaire est une requête de document.
    expect(documents.filter((d) => d !== `/locations/${id}/archiver`)).toEqual([]);

    // Archives : la ligne, sans l'adresse e-mail du locataire.
    await lien(page, "Archives").click();
    await expect(page).toHaveURL(/\/archives$/);
    await expect(page).toHaveTitle("Archives — Quittances");
    await expect(page.getByRole("main").getByText(saisie.nom)).toBeVisible();
    await expect(page.getByText("2 quittances")).toBeVisible();
    await expect(page.getByText(`Archivée le ${jourDeParis().split("-").reverse().join("/")}`)).toBeVisible();
    expect(await page.content()).not.toContain(saisie.email);
    await lien(page, saisie.adresse).click();
    await expect(page).toHaveURL(detailUrl(id));

    // Consultation seule : bandeau, aucun geste d'écriture, quittances téléchargeables.
    await expect(
      page.getByText(`Location archivée le ${jourDeParis().split("-").reverse().join("/")}. ${BANDEAU_FIN}`),
    ).toBeVisible();
    await expect(lien(page, "Retour aux archives")).toHaveAttribute("href", "/archives");
    await expect(page.getByRole("main").getByText("Terminée", { exact: true })).toBeVisible();
    for (const absent of ["Modifier", "Modifier la fin de la location", "Mettre fin à la location", "Archiver", "Produire une quittance", "Supprimer"]) {
      await expect(lien(page, absent), absent).toHaveCount(0);
    }
    await expect(page.getByRole("link", { name: /^Supprimer la quittance/ })).toHaveCount(0);
    await expect(lien(page, "Supprimer définitivement")).toHaveAttribute("href", `/locations/${id}/supprimer`);
    await expect(bouton(page, "Restaurer la location")).toBeVisible();

    // Télécharger depuis l'archive : même PDF qu'avant l'archivage.
    const apres = await telechargerPdf(page, page.getByRole("link", { name: "Télécharger la quittance, janvier 2026" }));
    expect(apres.statut).toBe(200);
    expect(apres.nomDuFichier).toBe(avant.nomDuFichier);
    expect(apres.nomDuFichier).toContain(idJanvier.slice(0, 8));
    expect(apres.contenu.text).toBe(avant.contenu.text);
    expect(apres.contenu.pageCount).toBe(avant.contenu.pageCount);
    expect(apres.contenu.info).toEqual(avant.contenu.info);
    expect(apres.contenu.creationDate?.getTime()).toBe(avant.contenu.creationDate?.getTime());

    // Restaurer.
    await attendreBouton(page, "Restaurer la location");
    await bouton(page, "Restaurer la location").click();
    await expect(page).toHaveURL(detailUrl(id));
    await expect(page.getByText("Location archivée le")).toHaveCount(0);
    await expect(lien(page, "Archiver")).toBeVisible();
    await expect(lien(page, "Produire une quittance")).toBeVisible();
    expect((await etatLocation(id))!.archived_at).toBeNull();
    await expect(ligneQuittance(page, "Janvier 2026")).toHaveCount(1);
    await expect(ligneQuittance(page, "Février 2026")).toHaveCount(1);

    // Une quittance de plus, puis archiver de nouveau.
    await produireParInterface(page, id, { mois: "2026-03", date: "2026-03-05" });
    await expect(ligneQuittance(page, "Mars 2026")).toHaveCount(1);
    await lien(page, "Archiver").click();
    await attendreBouton(page, "Archiver la location");
    await bouton(page, "Archiver la location").click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);

    // Suppression définitive : la page annonce trois quittances.
    await page.goto(`/locations/${id}`);
    await lien(page, "Supprimer définitivement").click();
    await expect(page).toHaveURL(`/locations/${id}/supprimer`);
    await expect(page.getByRole("heading", { level: 1, name: "Supprimer cette location" })).toBeVisible();
    await expect(page.getByText("Cette location a 3 quittances. Elles seront supprimées avec la location.")).toBeVisible();
    await expect(
      page.getByText("Cette action est irréversible. Pour conserver la location et ses quittances, laissez-la dans les archives."),
    ).toBeVisible();
    await attendreBouton(page, "Supprimer définitivement");
    await bouton(page, "Supprimer définitivement").click();
    await expect(page).toHaveURL(/\/archives$/);
    await expect(page.getByText("Aucune location archivée.")).toBeVisible();
    expect(await etatLocation(id)).toBeNull();
    expect(await nombreDeQuittances(id)).toBe(0);
    expect(await quittancesDuCompte(email)).toHaveLength(0);
    expect(await occurrencesEnBase([saisie.nom, saisie.email, saisie.adresse])).toBe(0);
    expect((await page.request.get(`/locations/${id}`)).status()).toBe(404);
    expect((await page.request.get(`/quittances/${idJanvier}/pdf`)).status()).toBe(404);

    // Précédent ne fait rien réapparaître.
    await page.goBack();
    await page.goto("/archives");
    await expect(page.getByText("Aucune location archivée.")).toBeVisible();
    expect(await etatLocation(id)).toBeNull();
    expect(console_).toEqual([]);
  });

  test("CA39 (partie T5), parcours 5 sans JavaScript : archiver, restaurer, archiver, supprimer définitivement", async ({
    browser,
  }) => {
    const hote = await browser.newContext();
    const pageAvec = await hote.newPage();
    const email = await compte(pageAvec);
    const L = await creerLocation(email, BAIL);
    await creerQuittanceEnBase(email, L.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    const stockage = await hote.storageState();
    await hote.close();
    const contexte = await browser.newContext({ javaScriptEnabled: false, storageState: stockage });
    const page = await contexte.newPage();
    try {
      const adresses: string[] = [];
      page.on("request", (r) => adresses.push(decodeURIComponent(r.url())));
      await page.goto(`/locations/${L.id}`);
      await lien(page, "Archiver").click();
      await expect(page).toHaveURL(`/locations/${L.id}/archiver`);
      await bouton(page, "Archiver la location").click();
      await expect(page).toHaveURL(/\/tableau-de-bord$/);
      await expect(page.getByRole("link", { name: L.valeurs.address })).toHaveCount(0);
      expect((await etatLocation(L.id))!.archived_at).not.toBeNull();

      await page.goto(`/locations/${L.id}`);
      await expect(page.getByText("Location archivée le")).toBeVisible();
      await bouton(page, "Restaurer la location").click();
      await expect(page).toHaveURL(detailUrl(L.id));
      await expect(page.getByText("Location archivée le")).toHaveCount(0);
      expect((await etatLocation(L.id))!.archived_at).toBeNull();

      await lien(page, "Archiver").click();
      await bouton(page, "Archiver la location").click();
      await expect(page).toHaveURL(/\/tableau-de-bord$/);

      await page.goto("/archives");
      await expect(page.getByText("1 quittance", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: L.valeurs.address }).click();
      await lien(page, "Supprimer définitivement").click();
      await expect(page.getByText("Cette location a 1 quittance. Elle sera supprimée avec la location.")).toBeVisible();
      await bouton(page, "Supprimer définitivement").click();
      await expect(page).toHaveURL(/\/archives$/);
      await expect(page.getByText("Aucune location archivée.")).toBeVisible();
      expect(await etatLocation(L.id)).toBeNull();
      expect(await nombreDeQuittances(L.id)).toBe(0);
      expect(adresses.filter((a) => a.includes(L.valeurs.tenantName) || a.includes(L.valeurs.address))).toEqual([]);
    } finally {
      await contexte.close();
    }
  });
});

test.describe("Archivage : les quatre cas du détail et la règle « terminée »", () => {
  test("CA49, CA57, R43 : liens et phrases selon l'état (en cours ou terminée, avec ou sans quittance), mot pour mot", async ({
    page,
  }) => {
    const email = await compte(page);
    const cas = [
      { nom: "en cours sans quittance", fin: null, quittances: 0, archiver: false, supprimer: true, a: true, b: false },
      { nom: "en cours à fin à venir avec quittance", fin: "2099-12-31", quittances: 1, archiver: false, supprimer: false, a: true, b: true },
      { nom: "en cours sans fin avec quittance", fin: null, quittances: 1, archiver: false, supprimer: false, a: true, b: true },
      { nom: "terminée sans quittance", fin: "2026-03-20", quittances: 0, archiver: true, supprimer: true, a: false, b: false },
      { nom: "terminée avec deux quittances", fin: "2026-03-20", quittances: 2, archiver: true, supprimer: false, a: false, b: true },
    ];
    for (const c of cas) {
      const L = await creerLocation(email, { startDate: "2026-01-15", endDate: c.fin });
      if (c.quittances >= 1) await creerQuittanceEnBase(email, L.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
      if (c.quittances >= 2) await creerQuittanceEnBase(email, L.id, { month: "2026-02" });
      await page.goto(`/locations/${L.id}`);
      await expect(page.getByRole("heading", { level: 2, name: "Actions" })).toBeVisible();
      const actions = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Actions" }) });
      await expect(actions.getByRole("link", { name: "Archiver", exact: true }), c.nom).toHaveCount(c.archiver ? 1 : 0);
      await expect(actions.getByRole("link", { name: "Supprimer", exact: true }), c.nom).toHaveCount(c.supprimer ? 1 : 0);
      await expect(actions.getByText(PHRASE_A, { exact: true }), c.nom).toHaveCount(c.a ? 1 : 0);
      await expect(actions.getByText(PHRASE_B, { exact: true }), c.nom).toHaveCount(c.b ? 1 : 0);
      // Ordre : Modifier, fin, puis Archiver, puis Supprimer.
      const noms = await actions.getByRole("link").allTextContents();
      expect(noms, c.nom).toEqual(
        ["Modifier", c.fin ? "Modifier la fin de la location" : "Mettre fin à la location"]
          .concat(c.archiver ? ["Archiver"] : [])
          .concat(c.supprimer ? ["Supprimer"] : []),
      );
    }
  });

  test("R39, CA46, CA49 : seule une location dont la fin est antérieure au jour (Paris) s'archive ; /archiver sur une location en cours redirige sans rien écrire", async ({
    page,
  }) => {
    const email = await compte(page);
    const hier = await creerLocation(email, { startDate: "2025-01-01", endDate: jourDeParis(-1) });
    const aujourdhui = await creerLocation(email, { startDate: "2025-01-01", endDate: jourDeParis(0) });
    const demain = await creerLocation(email, { startDate: "2025-01-01", endDate: jourDeParis(1) });
    const sansFin = await creerLocation(email, { startDate: "2025-01-01", endDate: null });

    await page.goto(`/locations/${hier.id}`);
    await expect(lien(page, "Archiver")).toBeVisible();
    for (const L of [aujourdhui, demain, sansFin]) {
      await page.goto(`/locations/${L.id}`);
      await expect(lien(page, "Archiver")).toHaveCount(0);
      await expect(page.getByText(PHRASE_A)).toBeVisible();
      const avant = await etatLocation(L.id);
      await page.goto(`/locations/${L.id}/archiver`);
      await expect(page).toHaveURL(detailUrl(L.id));
      await expect(page.getByRole("heading", { level: 1, name: L.valeurs.address })).toBeVisible();
      expect(await etatLocation(L.id)).toEqual(avant);
    }

    // Un POST direct qui vise une location en cours (identifiant lié remplacé) est sans effet : le serveur
    // recontrôle « terminée » à l'écriture (R40) ; arrivée sur son détail.
    const champs = await champsCaches(page.context(), `/locations/${hier.id}/archiver`, 0);
    for (const L of [aujourdhui, demain, sansFin]) {
      const avant = await etatLocation(L.id);
      const forges = champs.map(([k, v]) => [k, v.split(hier.id).join(L.id)] as [string, string]);
      expect(forges.some(([, v]) => v.includes(L.id))).toBe(true);
      const r = await envoyerSansJs(page.context(), `/locations/${hier.id}/archiver`, forges);
      expect(r.statut).toBeLessThan(400);
      expect(r.emplacement).toContain(`/locations/${L.id}`);
      expect(await etatLocation(L.id)).toEqual(avant);
      expect((await etatLocation(L.id))!.archived_at).toBeNull();
    }

    // La demande directe (POST) d'archiver une location en cours est sans effet : formulaire de la veille rejoué.
    await page.goto(`/locations/${hier.id}/archiver`);
    await attendreBouton(page, "Archiver la location");
    const html = await page.content();
    expect(html).toContain("Archiver la location");
    await bouton(page, "Archiver la location").click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    expect((await etatLocation(hier.id))!.archived_at).not.toBeNull();
  });

  test("R43, CA56, CA57 : une location créée par erreur se supprime directement, même en cours, même avec un bail à venir", async ({
    page,
  }) => {
    const email = await compte(page);
    const aVenir = await creerLocation(email, { startDate: "2099-01-01", endDate: null });
    const enCours = await creerLocation(email, { startDate: "2026-01-05", endDate: "2099-12-31" });
    for (const L of [aVenir, enCours]) {
      await page.goto(`/locations/${L.id}`);
      await lien(page, "Supprimer").click();
      await expect(page).toHaveURL(`/locations/${L.id}/supprimer`);
      await expect(page.getByText("Vous allez supprimer définitivement la location suivante.")).toBeVisible();
      await expect(page.getByText("Cette action est irréversible. Pour conserver la location sans la supprimer, mettez-y fin.")).toBeVisible();
      await attendreBouton(page, "Supprimer définitivement");
      await bouton(page, "Supprimer définitivement").click();
      await expect(page).toHaveURL(/\/tableau-de-bord$/);
      expect(await etatLocation(L.id)).toBeNull();
      expect((await page.request.get(`/locations/${L.id}`)).status()).toBe(404);
    }
    await page.goto("/archives");
    await expect(page.getByText("Aucune location archivée.")).toBeVisible();
  });
});

test.describe("Archivage : aucune lecture n'écrit", () => {
  test("R40, CA45 : GET, HEAD, préchargement et en-têtes de cache des pages d'archivage, de suppression et d'archives ; rien n'est modifié", async ({
    page,
  }) => {
    const email = await compte(page);
    const terminee = await creerLocation(email, BAIL);
    const archivee = await creerLocationArchivee(email);
    await creerQuittanceEnBase(email, archivee.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    const avant = [await etatLocation(terminee.id), await etatLocation(archivee.id)];
    const chemins = [
      `/locations/${terminee.id}`,
      `/locations/${terminee.id}/archiver`,
      `/locations/${terminee.id}/supprimer`,
      `/locations/${archivee.id}`,
      `/locations/${archivee.id}/supprimer`,
      "/archives",
    ];
    for (const chemin of chemins) {
      for (const methode of ["get", "head"] as const) {
        const r = await page.request[methode](chemin, { maxRedirects: 0 });
        expect(r.status(), `${methode} ${chemin}`).toBe(200);
        expect(r.headers()["cache-control"], chemin).toMatch(/private|no-store/);
      }
      // Requête de préchargement du routeur de Next.
      const pre = await page.request.get(chemin, { headers: { RSC: "1", "Next-Router-Prefetch": "1" }, maxRedirects: 0 });
      expect(pre.status(), `préchargement ${chemin}`).toBeLessThan(400);
    }
    // Survol et focus de tous les liens et boutons du détail archivé.
    await page.goto(`/locations/${archivee.id}`);
    for (const element of await page.getByRole("main").locator("a, button").all()) {
      await element.hover();
      await element.focus();
    }
    await page.reload();
    expect(await Promise.all([terminee, archivee].map((l) => etatLocation(l.id)))).toEqual(avant);
  });
});

test.describe("Archives et consultation seule", () => {
  test("CA54 : état vide, tableau de bord d'un compte dont tout est archivé, ordre et nombres de quittances", async ({
    page,
  }) => {
    const email = await compte(page);
    await page.goto("/archives");
    await expect(page).toHaveTitle("Archives — Quittances");
    await expect(page.getByRole("heading", { level: 1, name: "Archives" })).toBeVisible();
    await expect(page.getByText("Aucune location archivée.")).toBeVisible();
    await expect(page.getByRole("main").getByRole("list")).toHaveCount(0);
    await expect(
      page.getByText(
        "Les locations archivées sont conservées ici avec leurs quittances. Ouvrez une location pour télécharger ses quittances, la restaurer ou la supprimer définitivement.",
      ),
    ).toBeVisible();
    await expect(lien(page, "Retour au tableau de bord")).toHaveAttribute("href", "/tableau-de-bord");

    const a = await creerLocationArchivee(email, { addressComplement: "Bât. Z" }, "2026-09-01T10:00:00Z");
    const b = await creerLocationArchivee(email, {}, "2026-09-15T10:00:00Z");
    const c = await creerLocationArchivee(email, {}, "2026-09-10T10:00:00Z");
    await creerQuittanceEnBase(email, b.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await creerQuittanceEnBase(email, c.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await creerQuittanceEnBase(email, c.id, { month: "2026-02" });

    await page.goto("/tableau-de-bord");
    await expect(page.getByRole("heading", { level: 2, name: "Aucune location pour l'instant" })).toBeVisible();
    await expect(lien(page, "Archives")).toBeVisible();

    await lien(page, "Archives").click();
    const lignes = page.getByRole("main").getByRole("listitem");
    await expect(lignes).toHaveCount(3);
    await expect(lignes.nth(0)).toContainText(b.valeurs.address);
    await expect(lignes.nth(0)).toContainText("Archivée le 15/09/2026");
    await expect(lignes.nth(0)).toContainText("1 quittance");
    await expect(lignes.nth(1)).toContainText(c.valeurs.address);
    await expect(lignes.nth(1)).toContainText("Archivée le 10/09/2026");
    await expect(lignes.nth(1)).toContainText("2 quittances");
    await expect(lignes.nth(2)).toContainText(`${a.valeurs.address}, Bât. Z`);
    await expect(lignes.nth(2)).toContainText("Archivée le 01/09/2026");
    await expect(lignes.nth(2)).toContainText("Aucune quittance");
    await expect(lignes.nth(2)).toContainText(`${a.valeurs.postalCode} ${a.valeurs.city}`);
    await expect(lignes.nth(2)).toContainText(a.valeurs.tenantName);
    // Un seul lien par ligne, vers le détail ; jamais l'adresse e-mail.
    for (const [i, L] of [b, c, a].entries()) {
      await expect(lignes.nth(i).getByRole("link")).toHaveCount(1);
      await expect(lignes.nth(i).getByRole("link")).toHaveAttribute("href", `/locations/${L.id}`);
    }
    const html = await page.content();
    for (const L of [a, b, c]) expect(html).not.toContain(L.valeurs.tenantEmail);
    // Les locations archivées ne figurent plus au tableau de bord.
    await page.goto("/tableau-de-bord");
    await expect(page.getByText(b.valeurs.address)).toHaveCount(0);
  });

  test("CA50, CA51 : location archivée, consultation seule, adresses hors de propos redirigées, requêtes antérieures rejouées sans effet, restauration", async ({
    page,
  }) => {
    const email = await compte(page);
    const L = await creerLocation(email, { startDate: "2026-01-15", endDate: "2026-06-30" });
    const q1 = await creerQuittanceEnBase(email, L.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await creerQuittanceEnBase(email, L.id, { month: "2026-02" });

    // Formulaires captés avant l'archivage : la page de modification et celle de la fin ouvertes dans deux onglets.
    const onglets = [];
    for (const chemin of [`/locations/${L.id}/modifier`, `/locations/${L.id}/fin`, `/locations/${L.id}/quittances/nouvelle`, `/quittances/${q1}/supprimer`]) {
      const o = await page.context().newPage();
      await o.goto(chemin);
      await attendreHydratation(o).catch(async () => {
        await attendreBouton(o, "Supprimer définitivement");
      });
      onglets.push(o);
    }
    await archiverEnBase(email, L.id, "2026-09-15T10:00:00Z");
    const avant = await etatLocation(L.id);
    const quittancesAvant = await quittancesDuCompte(email);

    await page.goto(`/locations/${L.id}`);
    await expect(page.getByText(`Location archivée le 15/09/2026. ${BANDEAU_FIN}`)).toBeVisible();
    await expect(lien(page, "Retour aux archives")).toBeVisible();
    await expect(lien(page, "Retour au tableau de bord")).toHaveCount(0);
    await expect(page.getByRole("main").getByText("Terminée", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Le logement", "Le locataire", "Le loyer et le bail", "Quittances", "Actions"]);
    await expect(page.getByRole("link", { name: /^Télécharger la quittance/ })).toHaveCount(2);
    for (const absent of ["Modifier", "Modifier la fin de la location", "Archiver", "Produire une quittance", "Supprimer"]) {
      await expect(lien(page, absent), absent).toHaveCount(0);
    }
    const actions = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Actions" }) });
    expect(await actions.locator("a, button").allTextContents()).toEqual(["Restaurer la location", "Supprimer définitivement"]);
    await expect(page.getByText(PHRASE_A)).toHaveCount(0);
    await expect(page.getByText(PHRASE_B)).toHaveCount(0);

    // Adresses hors de propos : redirection vers le détail.
    for (const chemin of ["modifier", "fin", "archiver", "quittances/nouvelle"]) {
      await page.goto(`/locations/${L.id}/${chemin}`);
      await expect(page, chemin).toHaveURL(detailUrl(L.id));
    }
    await page.goto(`/quittances/${q1}/supprimer`);
    await expect(page).toHaveURL(detailUrl(L.id));
    const rep = await page.request.get(`/locations/${L.id}/modifier`, { maxRedirects: 0 });
    expect(rep.status()).toBe(307);
    expect(new URL(rep.headers()["location"], "http://x").pathname).toBe(`/locations/${L.id}`);

    // Rejeu des formulaires captés avant l'archivage : rien n'est écrit, arrivée sur le détail.
    const [modifier, fin, produire, supprimerQuittance] = onglets;
    await modifier.getByLabel("Loyer hors charges").fill("999");
    await modifier.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(modifier).toHaveURL(detailUrl(L.id));
    await fin.getByLabel("Date de fin du bail").fill("2026-07-01");
    await fin.getByRole("button", { name: "Enregistrer la date de fin" }).click();
    await expect(fin).toHaveURL(detailUrl(L.id));
    await produire.getByLabel("Mois", { exact: true }).selectOption("2026-03");
    await produire.getByLabel("Date du paiement").fill("2026-03-05");
    await produire.getByRole("checkbox").check();
    await produire.getByRole("button", { name: "Produire la quittance" }).click();
    await expect(produire).toHaveURL(detailUrl(L.id));
    await supprimerQuittance.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(supprimerQuittance).toHaveURL(detailUrl(L.id));
    expect(await etatLocation(L.id)).toEqual(avant);
    expect(await quittancesDuCompte(email)).toEqual(quittancesAvant);

    // Télécharger reste possible.
    expect((await page.request.get(`/quittances/${q1}/pdf`)).status()).toBe(200);

    // Restaurer : sans bandeau, terminée, mêmes actions qu'une location terminée.
    await page.goto(`/locations/${L.id}`);
    await attendreBouton(page, "Restaurer la location");
    await bouton(page, "Restaurer la location").click();
    await expect(page).toHaveURL(detailUrl(L.id));
    await expect(page.getByText("Location archivée le")).toHaveCount(0);
    await expect(page.getByRole("main").getByText("Terminée", { exact: true })).toBeVisible();
    await expect(lien(page, "Archiver")).toBeVisible();
    await expect(lien(page, "Produire une quittance")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Supprimer la quittance/ })).toHaveCount(2);

    // Rouvrir : en cours, phrase A, plus d'Archiver, plus sur /archives.
    await lien(page, "Modifier la fin de la location").click();
    await attendreBouton(page, "Rouvrir la location");
    await bouton(page, "Rouvrir la location").click();
    await expect(page).toHaveURL(detailUrl(L.id));
    await expect(page.getByRole("main").getByText("En cours", { exact: true })).toBeVisible();
    await expect(lien(page, "Archiver")).toHaveCount(0);
    await expect(page.getByText(PHRASE_A)).toBeVisible();
    await page.goto("/archives");
    await expect(page.getByText(L.valeurs.address)).toHaveCount(0);

    // Rejeu de la restauration sur une location active : détail, rien ne change.
    for (const o of onglets) await o.close();
  });

  test("CA52 : suppression définitive pour 0, 1 et 2 quittances, locations voisines intactes ; location active avec quittance redirigée", async ({
    page,
  }) => {
    const email = await compte(page);
    const zero = await creerLocationArchivee(email);
    const une = await creerLocationArchivee(email);
    const deux = await creerLocationArchivee(email);
    await creerQuittanceEnBase(email, une.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await creerQuittanceEnBase(email, deux.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    const q2 = await creerQuittanceEnBase(email, deux.id, { month: "2026-02" });
    const active = await creerLocation(email, BAIL);
    await creerQuittanceEnBase(email, active.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });

    const phrases: [typeof zero, string | null][] = [
      [zero, null],
      [une, "Cette location a 1 quittance. Elle sera supprimée avec la location."],
      [deux, "Cette location a 2 quittances. Elles seront supprimées avec la location."],
    ];
    for (const [L, phrase] of phrases) {
      await page.goto(`/locations/${L.id}/supprimer`);
      await expect(page).toHaveTitle("Supprimer la location — Quittances");
      await expect(page.getByRole("heading", { level: 1, name: "Supprimer cette location" })).toBeVisible();
      await expect(page.getByText(/Cette location a \d+ quittance/)).toHaveCount(phrase ? 1 : 0);
      if (phrase) await expect(page.getByText(phrase, { exact: true })).toBeVisible();
      await expect(page.getByText("Cette action est irréversible. Pour conserver la location et ses quittances, laissez-la dans les archives.")).toBeVisible();
      await expect(lien(page, "Annuler")).toHaveAttribute("href", `/locations/${L.id}`);
      await bouton(page, "Supprimer définitivement").hover();
      await page.reload();
      expect(await etatLocation(L.id), "affichage, survol et rechargement ne suppriment rien").not.toBeNull();
    }

    // Location active avec quittance : redirection vers le détail.
    await page.goto(`/locations/${active.id}/supprimer`);
    await expect(page).toHaveURL(detailUrl(active.id));

    // Suppression de la troisième.
    await page.goto(`/locations/${deux.id}/supprimer`);
    await attendreBouton(page, "Supprimer définitivement");
    await bouton(page, "Supprimer définitivement").click();
    await expect(page).toHaveURL(/\/archives$/);
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(2);
    expect(await etatLocation(deux.id)).toBeNull();
    expect((await page.request.get(`/locations/${deux.id}`)).status()).toBe(404);
    expect((await page.request.get(`/quittances/${q2}/pdf`)).status()).toBe(404);
    expect(await nombreDeQuittances(une.id)).toBe(1);
    expect(await nombreDeQuittances(active.id)).toBe(1);
    expect(await occurrencesEnBase([deux.valeurs.tenantName, deux.valeurs.tenantEmail])).toBe(0);
  });
});

// Évite l'avertissement « import inutilisé » pour les aides gardées à portée de main.
void ({} as Browser);
