import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { adresseUnique, cookieDeSession, expirerSession, inscrire, MOT_DE_PASSE } from "./aide-comptes";
import {
  attendreHydratation,
  creerLocation,
  identifiantDuCompte,
  lireTemoin,
  locationsDuCompte,
  poserTemoin,
  suffixeUnique,
} from "./aide-locations";
import {
  attendreBouton,
  bailleurDuCompte,
  bailleurEnBase,
  boutonProduire,
  caseAttestation,
  champCharges,
  champDate,
  champLoyer,
  champsCaches,
  contientDansLOrdre,
  creerQuittanceEnBase,
  envoyerSansJs,
  identifiantDeQuittance,
  ligneQuittance,
  MENTION_DE_RESERVE,
  modifierLocationEnBase,
  nombreDeLocations,
  nouveauProprietaire,
  normaliser,
  ouvrirProduction,
  produireParInterface,
  quittancesDuCompte,
  remplacerIdentifiantLie,
  remplirProduction,
  retirerBailleur,
  sansJavaScript,
  surveillerAdresses,
  surveillerConsole,
  surveillerDocuments,
  telechargerPdf,
  textePlat,
  valeursBailleur,
  WCAG,
} from "./aide-quittances";
import { readPdf } from "../src/test-support/read-pdf";

// Recette de T4 de la spécification 04 : informations du bailleur, production,
// téléchargement, suppression d'une quittance, suppression directe d'une
// location (CA19 à CA36, CA38, CA57). Chaque test crée ses comptes et ses
// données ; les dates du bail sont passées (2026-01-15 au 2026-03-20) pour que
// rien ne dépende de l'heure (R38).

const BAIL = { startDate: "2026-01-15", endDate: "2026-03-20" } as const;
const UUID_INCONNU = "00000000-0000-4000-8000-000000000000";
const MOTIF_ID = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;

/** Un compte avec ses informations de bailleur et une location au bail de la spécification (850,00 € + 50,00 €). */
async function compteEquipe(page: Page, surchargeLocation: Parameters<typeof creerLocation>[1] = {}) {
  const { email } = await inscrire(page);
  const u = suffixeUnique();
  const bailleur = valeursBailleur(u);
  await bailleurEnBase(email, bailleur);
  const location = await creerLocation(email, { ...BAIL, ...surchargeLocation });
  return { email, u, bailleur, location };
}

const lienTelecharger = (page: Page, mois: string) =>
  page.getByRole("link", { name: `Télécharger la quittance, ${mois}` });
const lienSupprimerQuittance = (page: Page, mois: string) =>
  page.getByRole("link", { name: `Supprimer la quittance, ${mois}` });

test.describe("Informations du bailleur", () => {
  test("CA19, CA20 : parcours 1 avec JavaScript, sans rechargement de document", async ({ page }) => {
    const console_ = surveillerConsole(page);
    const { email } = await inscrire(page);
    const documents = surveillerDocuments(page);
    await page.goto("/tableau-de-bord");
    await expect(page.getByRole("link", { name: "Mes informations", exact: true })).toHaveAttribute(
      "href",
      "/mes-informations",
    );
    await poserTemoin(page);
    documents.length = 0;

    await page.getByRole("link", { name: "Mes informations", exact: true }).click();
    await expect(page).toHaveURL(/\/mes-informations$/);
    await expect(page).toHaveTitle("Mes informations — Quittances");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mes informations");
    await expect(
      page.getByText(
        "Votre nom et votre adresse figurent sur les quittances que vous produisez. Une quittance déjà produite garde les informations du jour de sa production.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "Le bailleur" })).toBeVisible();
    await attendreHydratation(page);
    const attendus: [string, string][] = [
      ["Nom du bailleur", "name"],
      ["Adresse", "address-line1"],
      ["Complément d'adresse (facultatif)", "address-line2"],
      ["Code postal", "postal-code"],
      ["Ville", "address-level2"],
    ];
    for (const [libelle, autocomplete] of attendus) {
      const champ = page.getByLabel(libelle, { exact: true });
      await expect(champ).toHaveValue("");
      await expect(champ).toHaveAttribute("autocomplete", autocomplete);
      await expect(champ).not.toHaveAttribute("placeholder", /.+/);
    }
    await expect(page.getByText("Prénom et nom, ou dénomination pour une société. Pour plusieurs bailleurs, indiquez tous les noms.")).toBeVisible();
    await expect(page.getByText("Bâtiment, étage, numéro d'appartement.")).toBeVisible();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await expect(page.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", "/tableau-de-bord");
    await expect(page.locator('main a[href="/mes-informations"]')).toHaveCount(0);

    // CA20 : formulaire vide.
    await page.getByRole("button", { name: "Enregistrer mes informations" }).click();
    for (const message of [
      "Saisissez le nom du bailleur.",
      "Saisissez votre adresse.",
      "Saisissez le code postal.",
      "Saisissez la ville.",
    ]) {
      await expect(page.getByText(message)).toBeVisible();
    }
    await expect(page.getByLabel("Nom du bailleur")).toBeFocused();
    await expect(page.getByLabel("Nom du bailleur")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Nom du bailleur")).toHaveAccessibleDescription(/Saisissez le nom du bailleur\./);
    expect(await bailleurDuCompte(email)).toBeNull();

    // Valeurs valides sauf le code postal : seule L5 reste, les valeurs sont conservées.
    await page.getByLabel("Nom du bailleur").fill("  Marie   Durand ");
    await page.getByLabel("Adresse", { exact: true }).fill("3 rue de la Paix");
    await page.getByLabel("Code postal").fill("7501");
    await page.getByLabel("Ville").fill(" Paris ");
    await page.getByRole("button", { name: "Enregistrer mes informations" }).click();
    await expect(page.getByLabel("Code postal")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(1);
    await expect(page.getByLabel("Code postal")).toHaveValue("7501");
    await expect(page.getByLabel("Nom du bailleur")).toHaveValue("  Marie   Durand ");
    expect(await bailleurDuCompte(email)).toBeNull();

    // Les valeurs de CA2, normalisées.
    await page.getByLabel("Code postal").fill("75 002");
    await page.getByRole("button", { name: "Enregistrer mes informations" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    expect(await bailleurDuCompte(email)).toEqual({
      name: "Marie Durand",
      address: "3 rue de la Paix",
      address_complement: null,
      postal_code: "75002",
      city: "Paris",
    });

    // Rouvrir : valeurs normalisées ; enregistrer sans rien changer réussit.
    await page.getByRole("link", { name: "Mes informations", exact: true }).click();
    await attendreHydratation(page);
    await expect(page.getByLabel("Nom du bailleur")).toHaveValue("Marie Durand");
    await expect(page.getByLabel("Code postal")).toHaveValue("75002");
    await expect(page.getByLabel("Ville")).toHaveValue("Paris");
    await page.getByRole("button", { name: "Enregistrer mes informations" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);

    expect(await lireTemoin(page)).toBe("present");
    expect(documents).toEqual([]);
    expect(console_).toEqual([]);
  });

  test("CA21 : un autre compte ne peut ni écrire ni lire les informations de A, quel que soit le champ envoyé", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const u = suffixeUnique();
      await bailleurEnBase(a.email, valeursBailleur(`A${u}`));
      const idA = await identifiantDuCompte(a.email);
      const sans = await sansJavaScript(browser, b.contexte);
      try {
        const champs = await champsCaches(sans, "/mes-informations", 0);
        const parasites = Object.fromEntries(
          ["ownerId", "owner_id", "userId", "user_id", "id", "accountId"].map((n) => [n, idA]),
        );
        const reponse = await envoyerSansJs(sans, "/mes-informations", champs, {
          name: `Bailleur B ${u}`,
          address: "9 avenue B",
          addressComplement: "",
          postalCode: "33000",
          city: "Bordeaux",
          ...parasites,
        });
        expect([200, 303, 307]).toContain(reponse.statut);
      } finally {
        await sans.close();
      }
      expect((await bailleurDuCompte(b.email))?.name).toBe(`Bailleur B ${u}`);
      expect((await bailleurDuCompte(a.email))?.name).toBe(`Marie Durand A${u}`);

      // A voit les siennes, pas celles de B ; le code source de la page de l'un ne contient rien de l'autre.
      await a.page.goto("/mes-informations");
      await expect(a.page.getByLabel("Nom du bailleur")).toHaveValue(`Marie Durand A${u}`);
      const source = await (await a.contexte.request.get("/mes-informations")).text();
      expect(source).not.toContain(`Bailleur B ${u}`);
      expect(source).not.toContain("9 avenue B");
      const sourceB = await (await b.contexte.request.get("/mes-informations")).text();
      expect(sourceB).not.toContain(`Marie Durand A${u}`);
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });
});

test.describe("Production, téléchargement et suppression d'une quittance", () => {
  test("CA22, CA23, CA24, CA25, CA30, CA34, CA35 : parcours 2 à 4 avec JavaScript, PDF téléchargé et valeurs figées", async ({ page }) => {
    const console_ = surveillerConsole(page, { tolerer404: true });
    const { email } = await inscrire(page);
    const u = suffixeUnique();
    const L = await creerLocation(email, { ...BAIL, addressComplement: "Bât. B" });
    const documents = surveillerDocuments(page);

    // CA22 : sans informations de bailleur.
    await page.goto(`/locations/${L.id}`);
    await attendreHydratation(page).catch(() => {});
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Le logement",
      "Le locataire",
      "Le loyer et le bail",
      "Quittances",
      "Actions",
    ]);
    await expect(page.getByText("Aucune quittance pour cette location.")).toBeVisible();
    await poserTemoin(page);
    documents.length = 0;
    await page.getByRole("link", { name: "Produire une quittance" }).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}/quittances/nouvelle$`));
    await expect(page).toHaveTitle("Produire une quittance — Quittances");
    await expect(
      page.getByText("Avant de produire votre première quittance, renseignez votre nom et votre adresse. Ils figureront sur le document."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Produire la quittance" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", `/locations/${L.id}`);
    await page.getByRole("link", { name: "Renseigner mes informations" }).click();
    await expect(page).toHaveURL(/\/mes-informations$/);
    expect(await lireTemoin(page)).toBe("present");
    expect(documents).toEqual([]);

    // Parcours 1, puis retour à la location par le tableau de bord.
    await attendreHydratation(page);
    await page.getByLabel("Nom du bailleur").fill(`Marie Durand ${u}`);
    await page.getByLabel("Adresse", { exact: true }).fill("3 rue de la Paix");
    await page.getByLabel("Code postal").fill("75002");
    await page.getByLabel("Ville").fill("Paris");
    await page.getByRole("button", { name: "Enregistrer mes informations" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await page.getByRole("link", { name: L.valeurs.address }).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));

    // CA23 : le formulaire.
    await page.getByRole("link", { name: "Produire une quittance" }).click();
    await attendreHydratation(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Produire une quittance");
    await expect(
      page.getByText("Le nom et l'adresse du bailleur, le nom du locataire et l'adresse du logement sont copiés dans la quittance tels qu'ils sont enregistrés aujourd'hui."),
    ).toBeVisible();
    const options = await page.getByLabel("Mois", { exact: true }).locator("option").allTextContents();
    expect(options).toEqual([
      "Mars 2026 (du 01/03/2026 au 20/03/2026)",
      "Février 2026",
      "Janvier 2026 (du 15/01/2026 au 31/01/2026)",
    ]);
    await expect(page.getByLabel("Mois", { exact: true })).toHaveValue("2026-03");
    await expect(champLoyer(page)).toHaveValue("850,00");
    await expect(champCharges(page)).toHaveValue("50,00");
    await expect(champDate(page)).toHaveValue("");
    await expect(caseAttestation(page)).not.toBeChecked();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await expect(page.getByText("Montant reçu pour ce mois, en euros. Modifiez-le si le mois est incomplet ou si le loyer a changé.")).toBeVisible();
    await expect(page.getByText("Montant reçu pour ce mois, en euros. Saisissez 0 s'il n'y a pas de charges.")).toBeVisible();
    await expect(page.getByText("Jour où vous avez reçu le paiement.")).toBeVisible();
    await expect(page.getByText("Une quittance atteste un paiement complet. Si le paiement est partiel, ne produisez pas de quittance.")).toBeVisible();
    for (const champ of [page.getByLabel("Mois", { exact: true }), champLoyer(page), champCharges(page), champDate(page)]) {
      await expect(champ).toHaveAttribute("autocomplete", "off");
    }
    await expect(champLoyer(page)).not.toHaveAttribute("type", "number");

    // Ordre de tabulation : mois, loyer, charges, date, case, envoi, Annuler.
    await page.getByLabel("Mois", { exact: true }).focus();
    const ordre: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      ordre.push(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute("name") ?? document.activeElement!.textContent ?? ""));
      // Le champ date a trois segments : on sort du champ avec Tab jusqu'au suivant.
      if (i === 3) {
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
      } else {
        await page.keyboard.press("Tab");
      }
    }
    expect(ordre.slice(0, 3)).toEqual(["month", "rent", "charges"]);
    await expect(page.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", `/locations/${L.id}`);

    // CA25 : erreurs, valeurs conservées, case décochée.
    await page.getByLabel("Mois", { exact: true }).selectOption("2026-02");
    await champLoyer(page).fill("850,555");
    await champCharges(page).fill("");
    await champDate(page).fill("2099-12-31");
    await caseAttestation(page).uncheck().catch(() => {});
    await boutonProduire(page).click();
    await expect(page.getByText("La date du paiement ne peut pas être dans le futur.")).toBeVisible();
    await expect(page.getByText("Cochez la case pour confirmer que le loyer et les charges ont été reçus en totalité.")).toBeVisible();
    await expect(champLoyer(page)).toBeFocused();
    await expect(champLoyer(page)).toHaveValue("850,555");
    await expect(champCharges(page)).toHaveValue("");
    await expect(champDate(page)).toHaveValue("2099-12-31");
    await expect(page.getByLabel("Mois", { exact: true })).toHaveValue("2026-02");
    await expect(caseAttestation(page)).not.toBeChecked();
    await expect(page.locator("main [aria-invalid=true]")).toHaveCount(4); // loyer, charges, date, case
    expect(await quittancesDuCompte(email)).toHaveLength(0);

    // CA24 : janvier, 425,5 et 0.
    await page.getByLabel("Mois", { exact: true }).selectOption("2026-01");
    await champLoyer(page).fill("425,5");
    await champCharges(page).fill("0");
    await champDate(page).fill("2026-01-20");
    await caseAttestation(page).check();
    await boutonProduire(page).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));
    const ligne = ligneQuittance(page, "Janvier 2026");
    await expect(ligne).toHaveCount(1);
    const texteLigne = textePlat(await ligne.innerText());
    for (const fragment of ["Janvier 2026", "Du 15/01/2026 au 31/01/2026", "425,50 € charges comprises", "Payé le 20/01/2026"]) {
      expect(texteLigne).toContain(fragment);
    }
    expect(texteLigne).toMatch(/Référence 2026-01-[0-9A-F]{8}/);
    await expect(lienTelecharger(page, "janvier 2026")).toBeVisible();
    await expect(lienSupprimerQuittance(page, "janvier 2026")).toBeVisible();
    await expect(page.getByText("850,00 €", { exact: false }).first()).toBeVisible();
    expect((await locationsDuCompte(email))[0].rent_in_cents).toBe(85000);

    // Janvier n'est plus proposé ; mars, produit ensuite, précède janvier.
    await page.getByRole("link", { name: "Produire une quittance" }).click();
    await attendreHydratation(page);
    expect(await page.getByLabel("Mois", { exact: true }).locator("option").allTextContents()).toEqual([
      "Mars 2026 (du 01/03/2026 au 20/03/2026)",
      "Février 2026",
    ]);
    await remplirProduction(page, { date: "2026-03-05", attester: true });
    await boutonProduire(page).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));
    await expect(page.getByRole("listitem").filter({ hasText: /^Mars 2026|Mars 2026/ }).first()).toBeVisible();
    const mois = await page.getByRole("listitem").filter({ hasText: "Référence" }).evaluateAll((els) =>
      els.map((e) => (e.textContent ?? "").slice(0, 12)),
    );
    expect(mois[0]).toContain("Mars 2026");
    expect(mois[1]).toContain("Janvier 2026");

    // CA30 : le téléchargement. La page reste affichée.
    const q = (await quittancesDuCompte(email)).find((x) => x.month === "2026-01")!;
    await poserTemoin(page);
    const pdf = await telechargerPdf(page, lienTelecharger(page, "janvier 2026"));
    expect(pdf.statut).toBe(200);
    expect(pdf.nomDuFichier).toBe(`quittance-2026-01-${q.id.slice(0, 8)}.pdf`);
    expect(pdf.entetes["content-type"]).toBe("application/pdf");
    expect(pdf.entetes["content-disposition"]).toBe(`attachment; filename="${pdf.nomDuFichier}"`);
    expect(pdf.entetes["cache-control"]).toBe("private, no-store");
    expect(pdf.entetes["x-content-type-options"]).toBe("nosniff");
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));
    expect(await lireTemoin(page)).toBe("present");
    expect(pdf.octets.subarray(0, 5).toString()).toBe("%PDF-");
    const c = pdf.contenu;
    expect(c.pageCount).toBe(1);
    expect(Math.round(c.pageSizes[0].width)).toBe(595);
    expect(Math.round(c.pageSizes[0].height)).toBe(842);
    const attendu = [
      "Quittance de loyer",
      "Janvier 2026",
      `Référence ${q.id.slice(0, 8).toUpperCase().replace(/^/, "2026-01-")}`,
      "Bailleur",
      `Marie Durand ${u}`,
      "3 rue de la Paix",
      "75002 Paris",
      "Locataire",
      L.valeurs.tenantName,
      "Logement loué",
      L.valeurs.address,
      "Bât. B",
      "69003 Lyon",
      "Période",
      "Du 15/01/2026 au 31/01/2026",
      "Loyer hors charges",
      "425,50 €",
      "Provisions pour charges",
      "0,00 €",
      "Total",
      "425,50 €",
      `Reçu de ${L.valeurs.tenantName} la somme de 425,50 € au titre du loyer et des charges du logement désigné ci-dessus, pour la période du 15/01/2026 au 31/01/2026. Le bailleur en donne quittance au locataire.`,
      "Paiement reçu le 20/01/2026",
      "Fait à Paris, le ",
      "Le bailleur",
      `Marie Durand ${u}`,
      MENTION_DE_RESERVE,
    ];
    expect(contientDansLOrdre(c.text, attendu)).toEqual({ ok: true });
    expect(c.info.title).toBe("Quittance de loyer, janvier 2026");
    expect(c.info.author).toBe(`Marie Durand ${u}`);
    expect(c.info.creator).toBe("Quittances");
    expect(c.language).toBe("fr-FR");
    expect(c.info.subject ?? "").toBe("");
    expect(c.info.keywords ?? "").toBe("");
    expect(Math.floor(c.creationDate!.getTime() / 1000)).toBe(Math.floor(q.produced_at.getTime() / 1000));
    expect(c.fonts.length).toBeGreaterThan(0);
    expect(c.fonts.every((f) => f.embedded)).toBe(true);
    // Les flux du fichier sont compressés : l'adresse e-mail se cherche dans le texte extrait, les métadonnées et le fichier brut.
    expect(c.text + JSON.stringify(c.info)).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/);
    expect(pdf.octets.toString("latin1")).not.toContain("quittances.test");
    expect(JSON.stringify(c.info)).not.toContain(L.valeurs.tenantName);

    // Valeurs figées : on change tout ailleurs, on retélécharge.
    await modifierLocationEnBase(L.id, {
      rent_in_cents: 99000,
      charges_in_cents: 12300,
      tenant_name: `Autre Locataire ${u}`,
      address: `99 boulevard Nouveau ${u}`,
      city: "Nantes",
    });
    await bailleurEnBase(email, valeursBailleur(`Nouveau${u}`, { address: "1 impasse Neuve", city: "Lille", postalCode: "59000" }));
    const encore = await telechargerPdf(page, lienTelecharger(page, "janvier 2026"));
    expect(encore.statut).toBe(200);
    expect(textePlat(encore.contenu.text)).toBe(textePlat(c.text));
    expect(encore.contenu.info).toEqual(c.info);
    expect(encore.contenu.creationDate).toEqual(c.creationDate);
    expect(encore.contenu.pageCount).toBe(1);

    // CA34 : la page de suppression décrit la quittance, sans rien supprimer.
    await lienSupprimerQuittance(page, "janvier 2026").click();
    await expect(page).toHaveURL(new RegExp(`/quittances/${q.id}/supprimer$`));
    await expect(page).toHaveTitle("Supprimer la quittance — Quittances");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Supprimer cette quittance");
    await expect(page.getByText("Vous allez supprimer définitivement la quittance suivante.")).toBeVisible();
    const corps = textePlat(await page.getByRole("main").innerText());
    for (const f of [
      "Janvier 2026, du 15/01/2026 au 31/01/2026",
      L.valeurs.address,
      "69003 Lyon",
      L.valeurs.tenantName,
      "425,50 €",
      `2026-01-${q.id.slice(0, 8).toUpperCase()}`,
      "Cette action est irréversible. Si vous avez déjà remis cette quittance à votre locataire, la supprimer ici ne la lui retire pas. Vous pourrez produire une nouvelle quittance pour ce mois.",
    ]) {
      expect(corps).toContain(f);
    }
    expect(corps).not.toContain("@");
    await expect(page.getByRole("button", { name: "Supprimer définitivement" })).toHaveCSS("border-top-color", "rgb(239, 68, 68)");
    await page.reload();
    await page.getByRole("link", { name: "Annuler" }).hover();
    expect(await quittancesDuCompte(email)).toHaveLength(2);
    await page.getByRole("link", { name: "Annuler" }).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));
    await expect(ligneQuittance(page, "Janvier 2026")).toHaveCount(1);

    // CA35 : suppression, mois de nouveau proposé, adresses en 404, rejeu.
    await lienSupprimerQuittance(page, "janvier 2026").click();
    await attendreBouton(page, "Supprimer définitivement");
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));
    await expect(ligneQuittance(page, "Janvier 2026")).toHaveCount(0);
    await expect(ligneQuittance(page, "Mars 2026")).toHaveCount(1);
    await page.getByRole("link", { name: "Produire une quittance" }).click();
    await attendreHydratation(page);
    expect(await page.getByLabel("Mois", { exact: true }).locator("option").allTextContents()).toContain(
      "Janvier 2026 (du 15/01/2026 au 31/01/2026)",
    );
    const apres = await page.request.get(`/quittances/${q.id}/pdf`);
    expect(apres.status()).toBe(404);
    expect(apres.headers()["content-type"]).toContain("text/html");
    expect((await page.request.get(`/quittances/${q.id}/supprimer`)).status()).toBe(404);
    expect(console_).toEqual([]);
  });

  test("CA26 : même mois dans deux onglets, puis double activation (une seule quittance)", async ({ page, context }) => {
    const { email, location: L } = await compteEquipe(page);
    await ouvrirProduction(page, L.id);
    const second = await context.newPage();
    await ouvrirProduction(second, L.id);
    await remplirProduction(page, { mois: "2026-02", date: "2026-02-05", attester: true });
    await boutonProduire(page).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));
    await remplirProduction(second, { mois: "2026-02", date: "2026-02-05", attester: true });
    await boutonProduire(second).click();
    await expect(
      second.getByText("Une quittance existe déjà pour ce mois. Supprimez-la depuis la page de la location pour en produire une nouvelle."),
    ).toBeVisible();
    await expect(second.getByLabel("Mois", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(caseAttestation(second)).not.toBeChecked();
    const lignes = await quittancesDuCompte(email);
    expect(lignes.filter((x) => x.month === "2026-02")).toHaveLength(1);

    // Double activation avec une réponse retardée par le test.
    await ouvrirProduction(page, L.id);
    let posts = 0;
    let liberer: () => void = () => {};
    const attente = new Promise<void>((r) => (liberer = r));
    await page.route(`**/locations/${L.id}/quittances/nouvelle`, async (route) => {
      if (route.request().method() === "POST") {
        posts += 1;
        await attente;
      }
      await route.continue();
    });
    await remplirProduction(page, { mois: "2026-01", date: "2026-01-20", attester: true });
    await boutonProduire(page).click();
    const enCours = page.getByRole("button", { name: "Production en cours" });
    await expect(enCours).toBeVisible();
    await expect(enCours).toBeDisabled();
    await enCours.click({ force: true }).catch(() => {});
    await page.keyboard.press("Enter").catch(() => {});
    liberer();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));
    expect(posts).toBe(1);
    expect((await quittancesDuCompte(email)).filter((x) => x.month === "2026-01")).toHaveLength(1);
  });

  test("CA27, CA28 : bail à venir, rien à produire, informations retirées (Q7), nom non affichable (Q8)", async ({ page }) => {
    const { email } = await inscrire(page);
    await bailleurEnBase(email, valeursBailleur(suffixeUnique()));
    const futur = await creerLocation(email, { startDate: "2099-01-01", endDate: null });
    await page.goto(`/locations/${futur.id}/quittances/nouvelle`);
    await expect(
      page.getByText("Le bail commence le 01/01/2099. Aucune quittance ne peut être produite avant ce mois."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à la location" })).toHaveAttribute("href", `/locations/${futur.id}`);
    await expect(page.getByRole("button", { name: "Produire la quittance" })).toHaveCount(0);
    await expect(page.getByLabel("Mois", { exact: true })).toHaveCount(0);

    const tout = await creerLocation(email, { startDate: "2026-03-10", endDate: "2026-03-20" });
    await creerQuittanceEnBase(email, tout.id, { month: "2026-03", periodStart: "2026-03-10", periodEnd: "2026-03-20" });
    await page.goto(`/locations/${tout.id}/quittances/nouvelle`);
    await expect(page.getByText("Tous les mois écoulés de cette location ont déjà une quittance.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à la location" })).toHaveAttribute("href", `/locations/${tout.id}`);
    await expect(page.getByRole("button", { name: "Produire la quittance" })).toHaveCount(0);

    // Q7 : informations retirées après l'affichage du formulaire.
    const L = await creerLocation(email, BAIL);
    await ouvrirProduction(page, L.id);
    await retirerBailleur(email);
    await remplirProduction(page, { date: "2026-03-05", attester: true });
    await boutonProduire(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Renseignez vos informations de bailleur avant de produire une quittance." })).toBeVisible();
    expect((await quittancesDuCompte(email)).filter((q) => q.rental_id === L.id)).toHaveLength(0);

    // Q8 : nom de locataire avec un emoji.
    await bailleurEnBase(email, valeursBailleur(suffixeUnique()));
    const E = await creerLocation(email, { ...BAIL, tenantName: "Paul 😀" });
    await ouvrirProduction(page, E.id);
    await remplirProduction(page, { date: "2026-03-05", attester: true });
    await boutonProduire(page).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Le nom du locataire ou l'adresse du logement contient des caractères que la quittance ne peut pas afficher. Modifiez la location puis réessayez.",
      }),
    ).toBeVisible();
    await expect(caseAttestation(page)).not.toBeChecked();
    expect((await quittancesDuCompte(email)).filter((q) => q.rental_id === E.id)).toHaveLength(0);
  });

  test("Q9, R12, R17 : informations non affichables ; mois incomplet (bail du 15) ; caractères français et valeurs longues dans le PDF", async ({ page }) => {
    const { email } = await inscrire(page);
    // Bailleur avec un emoji : Q9.
    await bailleurEnBase(email, valeursBailleur(suffixeUnique(), { name: "Marie 😀" }));
    const L = await creerLocation(email, BAIL);
    await ouvrirProduction(page, L.id);
    await remplirProduction(page, { date: "2026-03-05", attester: true });
    await boutonProduire(page).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Vos informations de bailleur contiennent des caractères que la quittance ne peut pas afficher. Modifiez-les puis réessayez.",
      }),
    ).toBeVisible();
    expect(await quittancesDuCompte(email)).toHaveLength(0);

    // Caractères français et longueurs maximales : un PDF d'une page, tout le texte présent.
    const u = suffixeUnique();
    const nomLocataire = `Œdipe Éléonore d’Aubigné-Çà ${"N".repeat(60)}`.slice(0, 100);
    const adresseLogement = `${"L".repeat(190)} œ€`.slice(0, 200);
    await bailleurEnBase(
      email,
      valeursBailleur(u, {
        name: `SCI d’Hérouville Œuvres ${"B".repeat(70)}`.slice(0, 100),
        address: "É".repeat(200),
        addressComplement: "C".repeat(100),
        city: "V".repeat(100),
      }),
    );
    const G = await creerLocation(email, {
      ...BAIL,
      tenantName: nomLocataire,
      address: adresseLogement,
      addressComplement: "Z".repeat(100),
      city: "W".repeat(100),
      rentInCents: 9999999,
      chargesInCents: 9999999,
    });
    await ouvrirProduction(page, G.id);
    await remplirProduction(page, { mois: "2026-01", loyer: "99999,99", charges: "99999,99", date: "2026-01-20", attester: true });
    await boutonProduire(page).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${G.id}$`));
    const lien = page.getByRole("link", { name: "Télécharger la quittance, janvier 2026" });
    const pdf = await telechargerPdf(page, lien);
    expect(pdf.statut).toBe(200);
    expect(pdf.contenu.pageCount).toBe(1);
    const sans = (t: string) => t.replace(/[\s  ]+/g, "");
    const t = sans(pdf.contenu.text);
    expect(t).toContain(sans(nomLocataire));
    expect(t).toContain("É".repeat(200));
    expect(t).toContain("C".repeat(100));
    expect(t).toContain("Z".repeat(100));
    expect(t).toContain("W".repeat(100));
    expect(t).toContain("99999,99€");
    expect(t).toContain("199999,98€");
    expect(t).toContain(sans(MENTION_DE_RESERVE));
    expect(pdf.contenu.fonts.every((f) => f.embedded)).toBe(true);
    for (const item of pdf.contenu.items) {
      expect(item.x + item.width, `« ${item.str.slice(0, 20)} » dépasse la marge droite`).toBeLessThanOrEqual(595.3 - 56.6 + 1);
    }

    // Mois incomplet : période et montants saisis (bail commencé le 15).
    const H = await creerLocation(email, { ...BAIL });
    await produireParInterface(page, H.id, { mois: "2026-01", loyer: "425,5", charges: "25", date: "2026-01-20" });
    const q = (await quittancesDuCompte(email)).find((x) => x.rental_id === H.id)!;
    expect([q.period_start, q.period_end, q.rent_in_cents, q.charges_in_cents]).toEqual(["2026-01-15", "2026-01-31", 42550, 2500]);
  });
});

test.describe("Isolation et codes HTTP", () => {
  test("CA29, CA36 : B remplace l'identifiant lié par celui de A dans la production et dans la suppression", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      await bailleurEnBase(a.email, valeursBailleur(`A${suffixeUnique()}`));
      await bailleurEnBase(b.email, valeursBailleur(`B${suffixeUnique()}`));
      const la = await creerLocation(a.email, BAIL);
      const lb = await creerLocation(b.email, BAIL);
      const qa = await creerQuittanceEnBase(a.email, la.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
      const qb = await creerQuittanceEnBase(b.email, lb.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });

      // Production : champs valides, puis invalides, avec l'identifiant de la location de A.
      for (const valide of [true, false]) {
        await ouvrirProduction(b.page, lb.id);
        await b.page.unroute("**/*").catch(() => {});
        const attaque = await remplacerIdentifiantLie(b.page, lb.id, la.id);
        await remplirProduction(b.page, {
          mois: "2026-02",
          date: valide ? "2026-02-05" : "2099-12-31",
          attester: valide,
          loyer: valide ? "850" : "abc",
        });
        await boutonProduire(b.page).click();
        await expect(b.page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
        expect(attaque.remplacements).toBeGreaterThan(0);
        await expect(b.page.getByText("Choisissez un mois.")).toHaveCount(0);
        await expect(b.page.getByText("La date du paiement ne peut pas être dans le futur.")).toHaveCount(0);
        await b.page.unroute("**/*");
      }
      expect((await quittancesDuCompte(a.email)).map((x) => x.id)).toEqual([qa]);
      expect((await quittancesDuCompte(b.email)).map((x) => x.id)).toEqual([qb]);

      // Suppression : B envoie la suppression de SA quittance avec l'identifiant de celle de A.
      await b.page.goto(`/quittances/${qb}/supprimer`);
      await attendreBouton(b.page, "Supprimer définitivement");
      const attaque = await remplacerIdentifiantLie(b.page, qb, qa);
      await b.page.getByRole("button", { name: "Supprimer définitivement" }).click();
      await expect(b.page.getByRole("heading", { level: 1, name: "Quittance introuvable" })).toBeVisible();
      expect(attaque.remplacements).toBeGreaterThan(0);
      await b.page.unroute("**/*");
      expect((await quittancesDuCompte(a.email)).map((x) => x.id)).toEqual([qa]);
      expect((await quittancesDuCompte(b.email)).map((x) => x.id)).toEqual([qb]);
      expect((await a.contexte.request.get(`/quittances/${qa}/pdf`)).status()).toBe(200);

      // B demande la page de suppression de la quittance de A : 404, comme un UUID inconnu.
      const sur = await b.contexte.request.get(`/quittances/${qa}/supprimer`);
      const inconnu = await b.contexte.request.get(`/quittances/${UUID_INCONNU}/supprimer`);
      expect(sur.status()).toBe(404);
      expect(inconnu.status()).toBe(404);
      expect(normaliser(await sur.text())).toBe(normaliser(await inconnu.text()));
      // B demande la production sur la location de A : 404 comme inconnu.
      const prodA = await b.contexte.request.get(`/locations/${la.id}/quittances/nouvelle`);
      const prodInconnue = await b.contexte.request.get(`/locations/${UUID_INCONNU}/quittances/nouvelle`);
      expect(prodA.status()).toBe(404);
      expect(prodInconnue.status()).toBe(404);
      expect(normaliser(await prodA.text())).toBe(normaliser(await prodInconnue.text()));
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("CA29, R26 : champs parasites à la production, la quittance ne fige que ce que le serveur relit", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const u = suffixeUnique();
      const bailleurB = valeursBailleur(`B${u}`);
      await bailleurEnBase(a.email, valeursBailleur(`A${u}`));
      await bailleurEnBase(b.email, bailleurB);
      const lb = await creerLocation(b.email, BAIL);
      const idA = await identifiantDuCompte(a.email);
      const sans = await sansJavaScript(browser, b.contexte);
      try {
        const champs = await champsCaches(sans, `/locations/${lb.id}/quittances/nouvelle`, 0);
        const reponse = await envoyerSansJs(
          sans,
          `/locations/${lb.id}/quittances/nouvelle`,
          champs,
          {
            month: "2026-01",
            rent: "425,50",
            charges: "0",
            paymentDate: "2026-01-20",
            attestation: "on",
            ownerId: idA,
            owner_id: idA,
            rentalId: UUID_INCONNU,
            landlordName: "PIRATE bailleur",
            tenantName: "PIRATE locataire",
            periodStart: "2025-01-01",
            periodEnd: "2025-01-31",
            issueDate: "2020-01-01",
            rentInCents: "1",
            chargesInCents: "999999",
            landlordAddress: "PIRATE adresse",
            reference: "PIRATE",
            producedAt: "2000-01-01T00:00:00Z",
          },
        );
        expect([200, 303, 307]).toContain(reponse.statut);
        const mesQuittances = await quittancesDuCompte(b.email);
        expect(mesQuittances).toHaveLength(1);
        const q = mesQuittances[0];
        expect(q.rental_id).toBe(lb.id);
        expect(q.landlord_name).toBe(bailleurB.name);
        expect(q.tenant_name).toBe(lb.valeurs.tenantName);
        expect([q.period_start, q.period_end, q.rent_in_cents, q.charges_in_cents]).toEqual(["2026-01-15", "2026-01-31", 42550, 0]);
        expect(q.issue_date).not.toBe("2020-01-01");
        expect(q.produced_at.getUTCFullYear()).toBeGreaterThanOrEqual(2026);
        expect(await quittancesDuCompte(a.email)).toHaveLength(0);
        // Dans le fichier lui-même.
        const pdf = await readPdf(new Uint8Array(await (await b.contexte.request.get(`/quittances/${q.id}/pdf`)).body()));
        expect(pdf.text).not.toContain("PIRATE");
        expect(pdf.info.author).toBe(bailleurB.name);
        expect(textePlat(pdf.text)).toContain("Du 15/01/2026 au 31/01/2026");
        expect(textePlat(pdf.text)).toContain("425,50 €");
      } finally {
        await sans.close();
      }
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("CA31, CA32, R33 : codes, en-têtes et corps du téléchargement", async ({ browser, playwright, baseURL }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      await bailleurEnBase(a.email, valeursBailleur(`A${suffixeUnique()}`));
      const la = await creerLocation(a.email, BAIL);
      const qa = await creerQuittanceEnBase(a.email, la.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
      const supprimee = await creerQuittanceEnBase(a.email, la.id, { month: "2026-02" });
      await a.contexte.request.post(`/quittances/${supprimee}/supprimer`, { failOnStatusCode: false }).catch(() => {});

      // Visiteur sans session, jeton inventé, session expirée : 307 vers /connexion, sans paramètre.
      const visiteur = await playwright.request.newContext({ baseURL });
      const inventee = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { Cookie: "better-auth.session_token=jeton-invente.signature-inventee" },
      });
      const expire = await browser.newContext();
      const pageExp = await expire.newPage();
      const { email: emailExp } = await inscrire(pageExp);
      await expirerSession(emailExp);
      const reponses: Record<string, { statut: number; loc: string | undefined; type: string | undefined; cache: string | undefined; corps: string }> = {};
      for (const [nom, ctx] of [["visiteur", visiteur], ["inventee", inventee], ["expiree", expire.request]] as const) {
        for (const methode of ["get", "head"] as const) {
          for (const id of [qa, UUID_INCONNU]) {
            const r = await ctx[methode](`/quittances/${id}/pdf`, { maxRedirects: 0 });
            const cle = `${nom}-${methode}-${id === qa ? "existe" : "inconnu"}`;
            reponses[cle] = {
              statut: r.status(),
              loc: r.headers()["location"],
              type: r.headers()["content-type"],
              cache: r.headers()["cache-control"],
              corps: (await r.body()).toString("latin1"),
            };
          }
        }
      }
      for (const [cle, r] of Object.entries(reponses)) {
        expect(r.statut, cle).toBe(307);
        expect(r.loc, cle).toBe("/connexion");
        expect(r.type ?? "", cle).not.toContain("application/pdf");
        expect(r.cache ?? "", cle).toContain("no-store");
        expect(r.corps, cle).not.toContain("%PDF");
      }
      expect(reponses["visiteur-get-existe"].corps).toBe(reponses["visiteur-get-inconnu"].corps);
      await visiteur.dispose();
      await inventee.dispose();
      await expire.close();

      // Méthodes : 405, quittance intacte.
      for (const methode of ["post", "put", "delete", "patch"] as const) {
        const r = await a.contexte.request[methode](`/quittances/${qa}/pdf`);
        expect(r.status(), methode).toBe(405);
        expect(r.headers()["cache-control"]).toContain("no-store");
      }
      expect((await quittancesDuCompte(a.email)).some((x) => x.id === qa)).toBe(true);

      // Propriétaire : 200 et quatre en-têtes. HEAD : mêmes en-têtes, sans corps.
      const bon = await a.contexte.request.get(`/quittances/${qa}/pdf`);
      expect(bon.status()).toBe(200);
      expect(bon.headers()["content-type"]).toBe("application/pdf");
      expect(bon.headers()["content-disposition"]).toBe(`attachment; filename="quittance-2026-01-${qa.slice(0, 8)}.pdf"`);
      expect(bon.headers()["cache-control"]).toBe("private, no-store");
      expect(bon.headers()["x-content-type-options"]).toBe("nosniff");
      const tete = await a.contexte.request.head(`/quittances/${qa}/pdf`);
      expect(tete.status()).toBe(200);
      expect(tete.headers()["content-disposition"]).toBe(bon.headers()["content-disposition"]);
      expect((await tete.body()).length).toBe(0);

      // B : 404 identiques pour l'identifiant de A, inconnu, majuscules, mal formés, supprimé.
      const longue = "a".repeat(5000);
      const identifiants = [qa, UUID_INCONNU, qa.toUpperCase(), "1", "%27%20or%201%3D1", longue, supprimee];
      const vues: { statut: number; type: string; cache: string; disposition: string | undefined; corps: string }[] = [];
      for (const id of identifiants) {
        const r = await b.contexte.request.get(`/quittances/${id}/pdf`);
        vues.push({
          statut: r.status(),
          type: r.headers()["content-type"] ?? "",
          cache: r.headers()["cache-control"] ?? "",
          disposition: r.headers()["content-disposition"],
          corps: (await r.body()).toString("utf8").replace(/&#0?39;|&#x27;/g, "'"),
        });
      }
      for (const [i, v] of vues.entries()) {
        expect(v.statut, identifiants[i].slice(0, 20)).toBe(404);
        expect(v.type).toContain("text/html");
        expect(v.cache).toContain("no-store");
        expect(v.disposition).toBeUndefined();
        expect(v.corps).not.toContain("%PDF");
        expect(v.corps).toContain("Quittance introuvable");
        expect(v.corps).toContain("Cette quittance n'existe pas ou a été supprimée.");
        expect(v.corps).not.toContain(la.valeurs.tenantName);
        expect(v.corps).toBe(vues[0].corps);
      }

      // Encodage illisible : 400, corps vide.
      const mauvais = await b.contexte.request.get("/quittances/%E0%A4%A/pdf", { failOnStatusCode: false });
      expect(mauvais.status()).toBe(400);
      expect((await mauvais.body()).length).toBe(0);
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("CA33, R34 : aucune requête vers un PDF avant l'activation du lien ; liens natifs sans attribut download", async ({ page }) => {
    const { email, location: L } = await compteEquipe(page);
    const q1 = await creerQuittanceEnBase(email, L.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await creerQuittanceEnBase(email, L.id, { month: "2026-02" });
    const adresses = surveillerAdresses(page);
    await page.goto(`/locations/${L.id}`);
    await attendreHydratation(page).catch(() => {});
    for (const lien of await page.getByRole("main").getByRole("link").all()) {
      await lien.hover();
      await lien.focus();
    }
    await expect(lienTelecharger(page, "janvier 2026")).toHaveAttribute("href", `/quittances/${q1}/pdf`);
    for (const lien of await page.getByRole("link", { name: /^Télécharger la quittance/ }).all()) {
      await expect(lien).not.toHaveAttribute("download", /.*/);
    }
    // Un lien rendu par Link porterait un préchargement ; le lien natif n'en a pas.
    expect(adresses.filter((a) => /\/quittances\/[^/]+\/pdf/.test(a))).toEqual([]);
    // Rien n'est supprimé par un survol, un préchargement ou un rechargement.
    await page.reload();
    expect(await quittancesDuCompte(email)).toHaveLength(2);
    expect(adresses.filter((a) => /\/quittances\/[^/]+\/pdf/.test(a))).toEqual([]);
    // Une quittance supprimée : le navigateur affiche « Quittance introuvable » avec le code 404.
    await creerQuittanceEnBase(email, L.id, { month: "2026-03", periodStart: "2026-03-01", periodEnd: "2026-03-20" });
    const reponse = await page.goto(`/quittances/${UUID_INCONNU}/pdf`);
    expect(reponse?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Quittance introuvable" })).toBeVisible();
  });

  test("CA38, R33 : sans session, les pages nouvelles redirigent vers /connexion?retour=… ; le téléchargement ne laisse pas de retour", async ({ browser, page }) => {
    const { email, location: L } = await compteEquipe(page);
    const q = await creerQuittanceEnBase(email, L.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    const visiteur = await browser.newContext();
    try {
      const cibles = [
        "/mes-informations",
        `/locations/${L.id}/quittances/nouvelle`,
        `/locations/${UUID_INCONNU}/quittances/nouvelle`,
        `/quittances/${q}/supprimer`,
        `/quittances/${UUID_INCONNU}/supprimer`,
        `/quittances/${q}`,
      ];
      for (const cible of cibles) {
        const r = await visiteur.request.get(cible, { maxRedirects: 0 });
        expect(r.status(), cible).toBe(307);
        expect(r.headers()["location"], cible).toBe(`/connexion?retour=${encodeURIComponent(cible)}`);
        const corps = await r.text();
        for (const interdit of ["Produire une quittance", "Quittance introuvable", "Nom du bailleur", "Supprimer cette quittance", L.valeurs.tenantName]) {
          expect(corps, cible).not.toContain(interdit);
        }
      }
    } finally {
      await visiteur.close();
    }

    // Sans session dans le navigateur : arrivée sur la page demandée après connexion.
    const autre = await browser.newContext();
    const p = await autre.newPage();
    try {
      await p.goto(`/locations/${L.id}/quittances/nouvelle`);
      await expect(p).toHaveURL(/\/connexion\?retour=/);
      await p.getByLabel("Adresse e-mail").fill(email);
      await p.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
      await p.getByRole("button", { name: "Se connecter" }).click();
      await expect(p).toHaveURL(new RegExp(`/locations/${L.id}/quittances/nouvelle$`));
      await expect(p.getByRole("heading", { level: 1, name: "Produire une quittance" })).toBeVisible();

      // Un retour vers une adresse de téléchargement n'est pas suivi : tableau de bord, sans fichier.
      await autre.clearCookies();
      let telechargement = false;
      p.on("download", () => (telechargement = true));
      await p.goto(`/connexion?retour=${encodeURIComponent(`/quittances/${q}/pdf`)}`);
      await p.getByLabel("Adresse e-mail").fill(email);
      await p.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
      await p.getByRole("button", { name: "Se connecter" }).click();
      await expect(p).toHaveURL(/\/tableau-de-bord$/);
      expect(telechargement).toBe(false);
    } finally {
      await autre.close();
    }
  });
});

test.describe("Suppression directe d'une location (CA57)", () => {
  test("CA57 : lien selon les quittances, confirmation, arrivée, cas des deux onglets", async ({ page, context }) => {
    const { email } = await inscrire(page);
    await bailleurEnBase(email, valeursBailleur(suffixeUnique()));
    const enCours = await creerLocation(email, { startDate: "2026-01-05", endDate: null });
    const terminee = await creerLocation(email, { startDate: "2025-01-05", endDate: "2026-01-31" });

    await page.goto(`/locations/${enCours.id}`);
    await expect(page.getByRole("link", { name: "Supprimer", exact: true })).toHaveAttribute("href", `/locations/${enCours.id}/supprimer`);
    await expect(page.getByText("Une location qui a des quittances ne peut pas être supprimée directement.")).toHaveCount(0);
    await page.goto(`/locations/${terminee.id}`);
    await expect(page.getByRole("link", { name: "Supprimer", exact: true })).toHaveAttribute("href", `/locations/${terminee.id}/supprimer`);
    await expect(page.getByText("Une location qui a des quittances ne peut pas être supprimée directement.")).toHaveCount(0);

    // Page de confirmation de la location en cours, puis suppression.
    await page.goto(`/locations/${enCours.id}/supprimer`);
    await attendreBouton(page, "Supprimer définitivement");
    await expect(page.getByText("Cette action est irréversible. Pour conserver la location sans la supprimer, mettez-y fin.")).toBeVisible();
    await expect(page.getByText(/Cette location a \d+ quittance/)).toHaveCount(0);
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByRole("link", { name: enCours.valeurs.address })).toHaveCount(0);
    expect((await page.request.get(`/locations/${enCours.id}`)).status()).toBe(404);

    // Deux onglets : la confirmation est affichée, une quittance est produite ailleurs, puis la confirmation.
    await page.goto(`/locations/${terminee.id}/supprimer`);
    await attendreBouton(page, "Supprimer définitivement");
    const autre = await context.newPage();
    await produireParInterface(autre, terminee.id, { mois: "2026-01", date: "2026-01-20" });
    await autre.close();
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${terminee.id}$`));
    expect(await nombreDeLocations(email)).toBe(1);
    expect(await quittancesDuCompte(email)).toHaveLength(1);
    await expect(ligneQuittance(page, "Janvier 2026")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Supprimer", exact: true })).toHaveCount(0);
    await expect(page.getByText("Une location qui a des quittances ne peut pas être supprimée directement. Archivez-la, puis supprimez-la depuis les archives.")).toBeVisible();
    expect((await (await page.request.get(`/quittances/${(await quittancesDuCompte(email))[0].id}/pdf`)).body()).subarray(0, 4).toString()).toBe("%PDF");

    // La page de suppression d'une location qui a une quittance redirige vers le détail.
    await page.goto(`/locations/${terminee.id}/supprimer`);
    await expect(page).toHaveURL(new RegExp(`/locations/${terminee.id}$`));

    // Supprimer la quittance rend le lien Supprimer.
    await lienSupprimerQuittance(page, "janvier 2026").click();
    await attendreBouton(page, "Supprimer définitivement");
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${terminee.id}$`));
    await expect(page.getByRole("link", { name: "Supprimer", exact: true })).toBeVisible();
  });
});

test.describe("Sans JavaScript", () => {
  test("CA39 (partie T4) : parcours 1 à 4 sans JavaScript, de la saisie du bailleur à la suppression de la quittance", async ({ browser }) => {
    const proprietaire = await nouveauProprietaire(browser);
    const { email } = proprietaire;
    const L = await creerLocation(email, BAIL);
    const contexteSansJs = await sansJavaScript(browser, proprietaire.contexte);
    const page = await contexteSansJs.newPage();
    const adresses = surveillerAdresses(page);

    await page.goto("/mes-informations");
    await page.getByLabel("Nom du bailleur").fill("Marie Durand");
    await page.getByLabel("Adresse", { exact: true }).fill("3 rue de la Paix");
    await page.getByLabel("Code postal").fill("75 002");
    await page.getByLabel("Ville").fill("Paris");
    await page.getByRole("button", { name: "Enregistrer mes informations" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);

    await page.goto(`/locations/${L.id}/quittances/nouvelle`);
    await page.getByLabel("Mois", { exact: true }).selectOption("2026-01");
    await champLoyer(page).fill("425,5");
    await champCharges(page).fill("0");
    await champDate(page).fill("2026-01-20");
    await boutonProduire(page).click();
    await expect(page.getByText("Cochez la case pour confirmer que le loyer et les charges ont été reçus en totalité.")).toBeVisible();
    await expect(page.getByLabel("Mois", { exact: true })).toHaveValue("2026-01");
    await expect(champLoyer(page)).toHaveValue("425,5");
    await expect(champCharges(page)).toHaveValue("0");
    await expect(champDate(page)).toHaveValue("2026-01-20");
    await expect(caseAttestation(page)).not.toBeChecked();
    await caseAttestation(page).check();
    await boutonProduire(page).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));
    await expect(ligneQuittance(page, "Janvier 2026")).toHaveCount(1);

    const pdf = await telechargerPdf(page, lienTelecharger(page, "janvier 2026"));
    expect(pdf.statut).toBe(200);
    expect(pdf.contenu.pageCount).toBe(1);
    expect(textePlat(pdf.contenu.text)).toContain("Du 15/01/2026 au 31/01/2026");
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));

    await lienSupprimerQuittance(page, "janvier 2026").click();
    await expect(page.getByRole("heading", { level: 1, name: "Supprimer cette quittance" })).toBeVisible();
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${L.id}$`));
    await expect(ligneQuittance(page, "Janvier 2026")).toHaveCount(0);
    expect(await quittancesDuCompte(email)).toHaveLength(0);
    // Aucune valeur saisie dans une adresse.
    expect(adresses.filter((a) => /425|Durand|75002|2026-01-20/.test(a))).toEqual([]);
    await contexteSansJs.close();
    await proprietaire.contexte.close();
  });
});

test.describe("Accessibilité et rendu", () => {
  async function analyser(page: Page, nom: string) {
    const resultat = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(resultat.violations.map((v) => `${v.id} (${v.nodes.length})`), nom).toEqual([]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
  }

  test("CA41 : axe sur les écrans de T4 (WCAG 2.1 A et AA), case nommée par son libellé", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, BAIL);
    await page.goto(`/locations/${L.id}`);
    await analyser(page, "détail sans quittance");
    await page.goto("/mes-informations");
    await analyser(page, "informations vides");
    await page.getByRole("button", { name: "Enregistrer mes informations" }).click();
    await expect(page.getByText("Saisissez le nom du bailleur.")).toBeVisible();
    await analyser(page, "informations en erreur");
    await page.goto(`/locations/${L.id}/quittances/nouvelle`);
    await analyser(page, "bloc informations manquantes");
    await bailleurEnBase(email, valeursBailleur(suffixeUnique()));
    await ouvrirProduction(page, L.id);
    await analyser(page, "formulaire de production");
    await boutonProduire(page).click();
    await expect(page.getByText("Cochez la case")).toBeVisible();
    await analyser(page, "formulaire en erreur");
    const q = await creerQuittanceEnBase(email, L.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await creerQuittanceEnBase(email, L.id, { month: "2026-02" });
    await page.goto(`/locations/${L.id}`);
    await analyser(page, "détail avec deux quittances");
    const noms = await page.getByRole("link", { name: /^(Télécharger|Supprimer) la quittance/ }).evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? e.textContent),
    );
    expect(new Set(noms).size).toBe(noms.length);
    await page.goto(`/quittances/${q}/supprimer`);
    await analyser(page, "suppression d'une quittance");
    const futur = await creerLocation(email, { startDate: "2099-01-01", endDate: null });
    await page.goto(`/locations/${futur.id}/quittances/nouvelle`);
    await analyser(page, "bail à venir");
    const tout = await creerLocation(email, { startDate: "2026-03-10", endDate: "2026-03-20" });
    await creerQuittanceEnBase(email, tout.id, { month: "2026-03", periodStart: "2026-03-10", periodEnd: "2026-03-20" });
    await page.goto(`/locations/${tout.id}/quittances/nouvelle`);
    await analyser(page, "rien à produire");
    await page.goto(`/quittances/${UUID_INCONNU}/supprimer`);
    await expect(page.getByRole("heading", { level: 1, name: "Quittance introuvable" })).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(r.violations).toEqual([]);
  });

  test("CA42 : valeurs au maximum, aucun défilement horizontal de 320 à 1280px, un seul bouton primaire", async ({ page }) => {
    const { email } = await inscrire(page);
    await bailleurEnBase(
      email,
      valeursBailleur("x", { name: "B".repeat(100), address: "A".repeat(200), addressComplement: "C".repeat(100), city: "V".repeat(100) }),
    );
    const L = await creerLocation(email, {
      ...BAIL,
      address: "A".repeat(200),
      addressComplement: "C".repeat(100),
      city: "V".repeat(100),
      tenantName: "N".repeat(100),
      rentInCents: 9999999,
      chargesInCents: 9999999,
    });
    const q = await creerQuittanceEnBase(email, L.id, {
      month: "2026-01",
      periodStart: "2026-01-15",
      periodEnd: "2026-01-31",
      rentInCents: 9999999,
      chargesInCents: 9999999,
      tenantName: "N".repeat(100),
      rentalAddress: "A".repeat(200),
    });
    await creerQuittanceEnBase(email, L.id, { month: "2026-02", rentInCents: 9999999, chargesInCents: 9999999 });
    for (const largeur of [320, 412, 768, 1280]) {
      await page.setViewportSize({ width: largeur, height: 900 });
      for (const chemin of ["/mes-informations", `/locations/${L.id}`, `/locations/${L.id}/quittances/nouvelle`, `/quittances/${q}/supprimer`]) {
        await page.goto(chemin);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const [defilement, fenetre] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        expect(defilement, `${chemin} à ${largeur}px`).toBeLessThanOrEqual(fenetre);
        if (chemin.includes("/quittances/nouvelle") || chemin === "/mes-informations") {
          const largeurForm = await page.locator("main form").first().evaluate((f) => f.getBoundingClientRect().width);
          expect(largeurForm).toBeLessThanOrEqual(640);
        }
        // Un seul élément à fond indigo plein dans le main.
        const primaires = await page.getByRole("main").locator("a, button").evaluateAll(
          (els) => els.filter((e) => getComputedStyle(e).backgroundColor === "rgb(79, 70, 229)").length,
        );
        const attendu = chemin.endsWith("/supprimer") ? 0 : 1;
        expect(primaires, `${chemin} à ${largeur}px`).toBe(attendu);
      }
      // Les montants ne sont pas coupés : une seule ligne.
      await page.goto(`/locations/${L.id}`);
      const montant = page.getByRole("listitem").getByText(/199.999,98.€/).first();
      await expect(montant).toBeVisible();
      const lignes = await montant.evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
      expect(lignes, `montant à ${largeur}px`).toBe(1);
    }
  });
});

// Fonction inutilisée par les tests mais gardée pour les relevés de session (CA31) : voir expirerSession.
void cookieDeSession;
void adresseUnique;
void identifiantDeQuittance;
void ouvrirProduction;
void MOTIF_ID;
void ({} as Browser);
