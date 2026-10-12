import { expect, test, type Page } from "@playwright/test";

import { connecter, creerCompte, expirerSession, inscrire } from "./aide-comptes";
import { archiverEnBase, creerLocationArchivee, etatLocation, nombreDeQuittances } from "./aide-archives";
import { attendreHydratation, creerLocation, suffixeUnique } from "./aide-locations";
import {
  attendreBouton,
  bailleurEnBase,
  champsCaches,
  creerQuittanceEnBase,
  envoyerSansJs,
  nouveauProprietaire,
  normaliser,
  quittancesDuCompte,
  remplacerIdentifiantLie,
  valeursBailleur,
} from "./aide-quittances";

// Isolation et états de l'archivage (R21, R40, CA47, CA53) : un propriétaire B ne
// devine rien de l'état des locations de A, et les onglets restés ouverts ne
// font rien écrire sur une location qui a changé d'état. Chaque test crée ses
// comptes ; deux contextes de navigateur indépendants pour A et B.

const UUID_INCONNU = "00000000-0000-4000-8000-000000000000";
const QUITTANCE_INCONNUE = "00000000-0000-4000-8000-000000000001";
const BAIL = { startDate: "2026-01-15", endDate: "2026-03-20" } as const;
const PAGES_DE_LOCATION = ["", "/archiver", "/supprimer", "/modifier", "/fin", "/quittances/nouvelle"];

const bouton = (page: Page, nom: string) => page.getByRole("button", { name: nom });
const detailUrl = (id: string) => new RegExp(`/locations/${id}$`);

async function equipe(page: Page) {
  const { email } = await inscrire(page);
  await bailleurEnBase(email, valeursBailleur(suffixeUnique()));
  return email;
}

test.describe("Isolation : l'état d'une location de A reste invisible à B", () => {
  test("CA53, CA47, R40 : pages, téléchargement et suppression de quittance de A demandés par B, tous 404 et identiques à un identifiant inconnu", async ({
    browser,
  }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      await bailleurEnBase(a.email, valeursBailleur(`A${suffixeUnique()}`));
      const enCours = await creerLocation(a.email, { startDate: "2026-01-15", endDate: null });
      const terminee = await creerLocation(a.email, BAIL);
      const archivee = await creerLocationArchivee(a.email);
      const qTerminee = await creerQuittanceEnBase(a.email, terminee.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
      const qArchivee = await creerQuittanceEnBase(a.email, archivee.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });

      const adresses = [enCours, terminee, archivee];
      const reponseDe = async (chemin: string) => {
        const r = await b.contexte.request.get(chemin, { maxRedirects: 0 });
        return {
          statut: r.status(),
          cache: r.headers()["cache-control"],
          emplacement: r.headers()["location"],
          corps: normaliser(await r.text()),
        };
      };

      for (const suffixe of PAGES_DE_LOCATION) {
        const inconnu = await reponseDe(`/locations/${UUID_INCONNU}${suffixe}`);
        expect(inconnu.statut, suffixe).toBe(404);
        for (const L of adresses) {
          const r = await reponseDe(`/locations/${L.id}${suffixe}`);
          expect(r.statut, `${suffixe} ${L.id}`).toBe(404);
          expect(r.emplacement, "jamais une redirection").toBeUndefined();
          expect(r.cache).toBe(inconnu.cache);
          expect(r.corps, `${suffixe} : identique à un identifiant inconnu`).toBe(inconnu.corps);
          expect(r.corps).not.toContain(L.valeurs.tenantName);
          expect(r.corps).not.toContain(L.valeurs.address);
        }
      }
      // Quittances : téléchargement et page de suppression d'une location archivée ou non.
      for (const suffixe of ["/pdf", "/supprimer"]) {
        const inconnu = await reponseDe(`/quittances/${QUITTANCE_INCONNUE}${suffixe}`);
        expect(inconnu.statut).toBe(404);
        for (const q of [qTerminee, qArchivee]) {
          const r = await reponseDe(`/quittances/${q}${suffixe}`);
          expect(r.statut, suffixe).toBe(404);
          expect(r.emplacement).toBeUndefined();
          expect(r.corps).toBe(inconnu.corps);
        }
      }
      // POST direct sur le téléchargement : sans effet sur la quittance d'une location archivée de A.
      expect((await a.contexte.request.get(`/quittances/${qArchivee}/pdf`)).status()).toBe(200);

      // /archives de B : rien de A, même avec des paramètres qui désignent A.
      const lb = await creerLocationArchivee(b.email, { tenantName: `Locataire de B ${suffixeUnique()}` });
      for (const requete of ["", `?id=${archivee.id}`, `?proprietaire=${a.email}&locationId=${terminee.id}`, `?retour=/locations/${archivee.id}`]) {
        const r = await b.contexte.request.get(`/archives${requete}`);
        expect(r.status()).toBe(200);
        const corps = await r.text();
        expect(corps).toContain(lb.valeurs.tenantName);
        for (const L of adresses) {
          expect(corps).not.toContain(L.valeurs.tenantName);
          expect(corps).not.toContain(L.valeurs.address);
          expect(corps).not.toContain(`/locations/${L.id}`);
        }
        expect(corps).not.toContain(a.email);
      }
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("CA53, CA47, R40 : B attaque archiver, restaurer et supprimer définitivement en remplaçant l'identifiant lié, avec et sans JavaScript ; rien n'est écrit chez A", async ({
    browser,
  }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      await bailleurEnBase(a.email, valeursBailleur(`A${suffixeUnique()}`));
      await bailleurEnBase(b.email, valeursBailleur(`B${suffixeUnique()}`));
      const enCours = await creerLocation(a.email, { startDate: "2026-01-15", endDate: null });
      const terminee = await creerLocation(a.email, BAIL);
      const archivee = await creerLocationArchivee(a.email);
      await creerQuittanceEnBase(a.email, terminee.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
      await creerQuittanceEnBase(a.email, archivee.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
      const bTerminee = await creerLocation(b.email, BAIL);
      const bArchivee = await creerLocationArchivee(b.email);
      const bSansFin = await creerLocation(b.email, { startDate: "2026-01-15", endDate: null });

      const cibles = [enCours, terminee, archivee];
      const avant = await Promise.all(cibles.map((c) => etatLocation(c.id)));
      const quittancesAvant = await quittancesDuCompte(a.email);
      const avantB = await Promise.all([bTerminee, bArchivee].map((c) => etatLocation(c.id)));

      const attaques = [
        { nom: "archiver", page: (id: string) => `/locations/${id}/archiver`, ownB: bTerminee, bouton: "Archiver la location" },
        { nom: "restaurer", page: (id: string) => `/locations/${id}`, ownB: bArchivee, bouton: "Restaurer la location" },
        { nom: "supprimer définitivement", page: (id: string) => `/locations/${id}/supprimer`, ownB: bArchivee, bouton: "Supprimer définitivement" },
      ];

      for (const attaque of attaques) {
        // Avec JavaScript : l'identifiant lié est remplacé partout dans la requête.
        for (const cible of cibles) {
          const own = attaque.nom === "supprimer définitivement" ? bSansFin : attaque.ownB;
          await b.page.goto(attaque.page(own.id));
          await attendreBouton(b.page, attaque.bouton);
          const etat = await remplacerIdentifiantLie(b.page, own.id, cible.id);
          await bouton(b.page, attaque.bouton).click();
          await expect(b.page.getByRole("heading", { level: 1, name: "Location introuvable" }), `${attaque.nom} ${cible.id}`).toBeVisible();
          expect(etat.remplacements).toBeGreaterThan(0);
          expect(etat.statuts.every((s) => s === 404)).toBe(true);
          await b.page.unroute("**/*");
        }
        // Par POST direct, sans JavaScript : les champs cachés d'un formulaire de B portent l'identifiant de A.
        const corps = new Set<string>();
        const inconnu = await (async () => {
          const own = attaque.nom === "supprimer définitivement" ? bSansFin : attaque.ownB;
          const champs = await champsCaches(b.contexte, attaque.page(own.id), 0);
          const remplaces = champs.map(([k, v]) => [k, v.split(own.id).join(UUID_INCONNU)] as [string, string]);
          expect(remplaces.some(([, v]) => v.includes(UUID_INCONNU))).toBe(true);
          return envoyerSansJs(b.contexte, attaque.page(own.id), remplaces);
        })();
        expect(inconnu.statut).toBe(404);
        for (const cible of cibles) {
          const own = attaque.nom === "supprimer définitivement" ? bSansFin : attaque.ownB;
          const champs = await champsCaches(b.contexte, attaque.page(own.id), 0);
          const remplaces = champs.map(([k, v]) => [k, v.split(own.id).join(cible.id)] as [string, string]);
          expect(remplaces.some(([, v]) => v.includes(cible.id))).toBe(true);
          const r = await envoyerSansJs(b.contexte, attaque.page(own.id), remplaces);
          expect(r.statut, `${attaque.nom} ${cible.id}`).toBe(404);
          expect(r.emplacement).toBeUndefined();
          expect(r.corps, "indiscernable d'un identifiant inconnu").toBe(inconnu.corps);
          corps.add(r.corps);
        }
        expect(corps.size).toBe(1);
      }

      // Rien n'a bougé chez A (date d'archivage et de modification comprises) ni chez B.
      expect(await Promise.all(cibles.map((c) => etatLocation(c.id)))).toEqual(avant);
      expect(await quittancesDuCompte(a.email)).toEqual(quittancesAvant);
      expect(await Promise.all([bTerminee, bArchivee].map((c) => etatLocation(c.id)))).toEqual(avantB);
      // B n'a perdu aucune de ses locations propres.
      expect(await etatLocation(bSansFin.id)).not.toBeNull();
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });
});

test.describe("Sans session", () => {
  test("CA38 (partie T5) : /archives et /locations/<id>/archiver renvoient à la connexion, identiquement, avec un identifiant existant ou non ; retour à la page demandée", async ({
    browser,
    playwright,
    baseURL,
  }) => {
    const compte = await creerCompte(browser);
    const contexte = await browser.newContext();
    const page = await contexte.newPage();
    await connecter(page, compte);
    const L = await creerLocation(compte.email, BAIL);
    await contexte.close();

    const visiteurs = [
      { nom: "sans session", extraHTTPHeaders: {} as Record<string, string> },
      { nom: "jeton inventé", extraHTTPHeaders: { Cookie: "better-auth.session_token=inventee.signature" } },
    ];
    for (const v of visiteurs) {
      const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: v.extraHTTPHeaders });
      const corps = new Set<string>();
      for (const chemin of ["/archives", `/locations/${L.id}/archiver`, `/locations/${UUID_INCONNU}/archiver`]) {
        const enLocation = chemin !== "/archives";
        const r = await api.get(chemin, { maxRedirects: 0 });
        expect(r.status(), `${v.nom} ${chemin}`).toBe(307);
        expect(r.headers()["location"]).toMatch(new RegExp(`^(http://localhost:3100)?/connexion\\?retour=${encodeURIComponent(chemin).replace(/%2F/g, "%2F")}$`));
        const texte = await r.text();
        if (enLocation) corps.add(normaliser(texte));
        expect(texte).not.toContain("Archives");
      }
      // Les deux adresses de location donnent la même redirection, hors l'identifiant demandé.
      expect(corps.size).toBe(1);
      await api.dispose();
    }

    // Arrivée sur la page demandée après connexion.
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await p2.goto("/archives");
    await expect(p2).toHaveURL(/\/connexion\?retour=%2Farchives$/);
    await p2.getByLabel("Adresse e-mail").fill(compte.email);
    await p2.getByLabel("Mot de passe", { exact: true }).fill(compte.motDePasse);
    await p2.getByRole("button", { name: "Se connecter" }).click();
    await expect(p2).toHaveURL(/\/archives$/);
    await expect(p2.getByRole("heading", { level: 1, name: "Archives" })).toBeVisible();

    // Session expirée : redirection, puis arrivée sur la page demandée.
    await expirerSession(compte.email);
    const reponse = await p2.request.get(`/locations/${L.id}/archiver`, { maxRedirects: 0 });
    expect(reponse.status()).toBe(307);
    expect(reponse.headers()["location"]).toContain("/connexion?retour=");
    await ctx2.close();
  });
});

test.describe("Onglets restés ouverts", () => {
  test("CA46, CA50, R40 : après un archivage, les formulaires d'un onglet resté sur l'état d'avant n'écrivent rien (champs valides ou invalides) et arrivent sur le détail", async ({
    page,
    context,
  }) => {
    const email = await equipe(page);
    const L = await creerLocation(email, BAIL);
    const q = await creerQuittanceEnBase(email, L.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });

    const ouvrir = async (chemin: string, bouton_?: string) => {
      const o = await context.newPage();
      await o.goto(chemin);
      if (bouton_) await attendreBouton(o, bouton_);
      else await attendreHydratation(o);
      return o;
    };
    const modifierValide = await ouvrir(`/locations/${L.id}/modifier`);
    const modifierInvalide = await ouvrir(`/locations/${L.id}/modifier`);
    const finValide = await ouvrir(`/locations/${L.id}/fin`);
    const finInvalide = await ouvrir(`/locations/${L.id}/fin`);
    const rouvrir = await ouvrir(`/locations/${L.id}/fin`);
    const produire = await ouvrir(`/locations/${L.id}/quittances/nouvelle`);
    const supprimerQuittance = await ouvrir(`/quittances/${q}/supprimer`, "Supprimer définitivement");
    const archiverDeNouveau = await ouvrir(`/locations/${L.id}/archiver`, "Archiver la location");

    // Archivage depuis un onglet.
    await page.goto(`/locations/${L.id}/archiver`);
    await attendreBouton(page, "Archiver la location");
    await bouton(page, "Archiver la location").click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    const archive = await etatLocation(L.id);
    expect(archive!.archived_at).not.toBeNull();
    const quittancesAvant = await quittancesDuCompte(email);

    await modifierValide.getByLabel("Loyer hors charges").fill("999");
    await modifierValide.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(modifierValide).toHaveURL(detailUrl(L.id));

    // Champs invalides : aucun message de champ ne révèle que la validation a eu lieu.
    await modifierInvalide.getByLabel("Loyer hors charges").fill("abc");
    await modifierInvalide.getByLabel("Code postal").fill("7");
    await modifierInvalide.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(modifierInvalide).toHaveURL(detailUrl(L.id));
    await expect(modifierInvalide.getByText(/Saisissez|ne peut pas|doit être/)).toHaveCount(0);

    await finValide.getByLabel("Date de fin du bail").fill("2026-05-01");
    await finValide.getByRole("button", { name: "Enregistrer la date de fin" }).click();
    await expect(finValide).toHaveURL(detailUrl(L.id));
    await finInvalide.getByLabel("Date de fin du bail").fill("2100-01-01");
    await finInvalide.getByRole("button", { name: "Enregistrer la date de fin" }).click();
    await expect(finInvalide).toHaveURL(detailUrl(L.id));
    await expect(finInvalide.getByText(/Saisissez|n'existe pas|doit être|ne peut pas/)).toHaveCount(0);

    await rouvrir.getByRole("button", { name: "Rouvrir la location" }).click();
    await expect(rouvrir).toHaveURL(detailUrl(L.id));

    await produire.getByLabel("Mois", { exact: true }).selectOption("2026-02");
    await produire.getByLabel("Date du paiement").fill("2026-02-05");
    await produire.getByRole("checkbox").check();
    await produire.getByRole("button", { name: "Produire la quittance" }).click();
    await expect(produire).toHaveURL(detailUrl(L.id));

    await supprimerQuittance.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(supprimerQuittance).toHaveURL(detailUrl(L.id));

    await archiverDeNouveau.getByRole("button", { name: "Archiver la location" }).click();
    await expect(archiverDeNouveau).toHaveURL(detailUrl(L.id));
    await expect(archiverDeNouveau.getByText("Location archivée le")).toBeVisible();

    expect(await etatLocation(L.id)).toEqual(archive);
    expect(await quittancesDuCompte(email)).toEqual(quittancesAvant);
  });

  test("CA49, R40 : location rouverte ou fin reportée dans un onglet, puis archivage confirmé dans l'autre : pas archivée", async ({
    page,
    context,
  }) => {
    const email = await equipe(page);
    for (const modification of ["rouvrir", "reporter"] as const) {
      const L = await creerLocation(email, BAIL);
      const ancien = await context.newPage();
      await ancien.goto(`/locations/${L.id}/archiver`);
      await attendreBouton(ancien, "Archiver la location");

      await page.goto(`/locations/${L.id}/fin`);
      await attendreHydratation(page);
      if (modification === "rouvrir") {
        await bouton(page, "Rouvrir la location").click();
      } else {
        await page.getByLabel("Date de fin du bail").fill("2099-12-31");
        await bouton(page, "Enregistrer la date de fin").click();
      }
      await expect(page).toHaveURL(detailUrl(L.id));

      await bouton(ancien, "Archiver la location").click();
      await expect(ancien).toHaveURL(detailUrl(L.id));
      await expect(ancien.getByText("Location archivée le")).toHaveCount(0);
      await expect(ancien.getByRole("main").getByText("En cours", { exact: true })).toBeVisible();
      expect((await etatLocation(L.id))!.archived_at, modification).toBeNull();
      await ancien.close();
    }
  });

  test("CA52, CA57, R43 : restaurée dans un onglet, puis suppression définitive confirmée dans l'autre : pas supprimée ; double activation de chaque bouton", async ({
    page,
    context,
  }) => {
    const email = await equipe(page);
    const console_: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") console_.push(m.text());
    });

    // Restaurée ailleurs, suppression confirmée ici.
    const L = await creerLocationArchivee(email);
    await creerQuittanceEnBase(email, L.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await page.goto(`/locations/${L.id}/supprimer`);
    await attendreBouton(page, "Supprimer définitivement");
    const autre = await context.newPage();
    await autre.goto(`/locations/${L.id}`);
    await attendreBouton(autre, "Restaurer la location");
    await bouton(autre, "Restaurer la location").click();
    await expect(autre.getByText("Location archivée le")).toHaveCount(0);
    expect((await etatLocation(L.id))!.archived_at).toBeNull();
    await autre.close();
    await bouton(page, "Supprimer définitivement").click();
    await expect(page).toHaveURL(detailUrl(L.id));
    expect(await nombreDeQuittances(L.id)).toBe(1);
    expect((await etatLocation(L.id))!.archived_at).toBeNull();
    await expect(page.getByText("Une location qui a des quittances ne peut pas être supprimée directement.")).toBeVisible();

    // Double activation : archiver.
    await page.goto(`/locations/${L.id}/archiver`);
    await attendreBouton(page, "Archiver la location");
    await bouton(page, "Archiver la location").dblclick();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    const archive = (await etatLocation(L.id))!.archived_at;
    expect(archive).not.toBeNull();

    // Double activation : restaurer.
    await page.goto(`/locations/${L.id}`);
    await attendreBouton(page, "Restaurer la location");
    await bouton(page, "Restaurer la location").dblclick();
    await expect(page).toHaveURL(detailUrl(L.id));
    await expect(page.getByText("Location archivée le")).toHaveCount(0);
    expect((await etatLocation(L.id))!.archived_at).toBeNull();

    // Double activation : supprimer définitivement (location archivée de nouveau).
    await archiverEnBase(email, L.id, "2026-09-15T10:00:00Z");
    await page.goto(`/locations/${L.id}/supprimer`);
    await attendreBouton(page, "Supprimer définitivement");
    await bouton(page, "Supprimer définitivement").dblclick();
    await expect(page).toHaveURL(/\/archives$/);
    expect(await etatLocation(L.id)).toBeNull();
    await expect(page.getByText("Aucune location archivée.")).toBeVisible();
    expect(console_.filter((t) => !/status of 404/.test(t))).toEqual([]);
  });
});
