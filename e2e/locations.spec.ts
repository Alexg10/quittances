import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import {
    deconnecter,
  expirerSession,
  inscrire,
  ouvrirConnexion,
  remplirEtSeConnecter,
  MOT_DE_PASSE,
} from "./aide-comptes";
import {
  attendreHydratation,
  creerLocation,
  identifiantDuCompte,
  lireTemoin,
  locationsDuCompte,
  ouvrirCreation,
  poserTemoin,
  remplirLocation,
  saisieValide,
  sansEspacesSpeciales,
  suffixeUnique,
} from "./aide-locations";

// Gestion des locations, tranche T3 à T5 (spec 03) : liste (CA16 à CA20),
// création (CA22 à CA27), détail et introuvable (CA28), isolation et protection
// (CA19, CA26, CA29 à CA31), robustesse sans JavaScript (CA40, partie création),
// accessibilité et clavier (CA42, CA44), cache (CA46).
// Chaque test crée ses propres comptes et ses propres locations (R44). Les
// locations préparées sans interface passent par aide-locations.ts (base de test).

const UUID_INCONNU = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

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

/** Requêtes de document (rechargement complet) faites par la page. */
function surveillerDocuments(page: Page) {
  const documents: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "document") documents.push(new URL(r.url()).pathname);
  });
  return documents;
}

async function nouveauProprietaire(browser: Browser) {
  const contexte = await browser.newContext();
  const page = await contexte.newPage();
  const compte = await inscrire(page);
  return { contexte, page, ...compte };
}

const ligneDe = (page: Page, adresse: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name: adresse }) });

async function valeurDetail(page: Page, libelle: string) {
  return page.getByText(libelle, { exact: true }).locator("xpath=following-sibling::dd").innerText();
}

test.describe("Locations : liste et création", () => {
  test("CA16, CA22, CA23, CA44 : premier parcours avec JavaScript, sans rechargement de document", async ({ page }) => {
    const console_ = surveillerConsole(page);
    const { email } = await inscrire(page);
    const documents = surveillerDocuments(page);
    await expect(page).toHaveTitle("Tableau de bord — Quittances");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Aucune location pour l'instant");
    // Liens désignés par leur nom (T5 ajoute « Archives »).
    for (const nom of ["Quittances, tableau de bord", "Mes informations", "Archives", "Ajouter une location"]) {
      await expect(page.getByRole("link", { name: nom, exact: true })).toHaveCount(1);
    }
    await expect(page.getByRole("link", { name: "Archives", exact: true })).toHaveAttribute("href", "/archives");
    await expect(page.getByRole("button")).toHaveCount(1);
    await poserTemoin(page);

    // CA16 / CA22 : le lien mène au formulaire sans requête de document.
    await page.getByRole("link", { name: "Ajouter une location" }).click();
    await expect(page).toHaveURL(/\/locations\/nouvelle$/);
    await expect(page).toHaveTitle("Ajouter une location — Quittances");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ajouter une location");
    await expect(page.getByRole("main")).toHaveCount(1);
    await attendreHydratation(page);
    // La case d'accord (spécification 05) a toujours la valeur « on » : elle est vérifiée décochée, à part.
    for (const champ of await page.locator("main form input:not([type=hidden]):not([type=checkbox])").all()) {
      await expect(champ).toHaveValue("");
    }
    await expect(page.locator("main form input[type=checkbox]")).not.toBeChecked();
    await expect(page.locator("main form [role=alert]")).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await expect(page.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", "/tableau-de-bord");

    // CA23 : les valeurs de la spécification, normalisées.
    const u = suffixeUnique();
    await remplirLocation(page, {
      adresse: "  12  rue des Lilas ",
      complement: "Bât. B",
      codePostal: "69 003",
      ville: " Lyon ",
      nom: " Paul   Martin ",
      email: ` Paul.Martin-${u}@Quittances.test `,
      loyer: "1 250,50 €",
      charges: "0",
      jour: "05",
      debut: "2026-01-05",
    });
    await page.getByRole("button", { name: "Ajouter la location" }).click();
    await expect(page).toHaveURL(/\/locations\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await expect(page).toHaveTitle("Location — Quittances");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("12 rue des Lilas");
    await expect(page.getByRole("main").getByText("En cours", { exact: true })).toBeVisible();
    expect(await valeurDetail(page, "Adresse")).toBe("12 rue des Lilas");
    expect(await valeurDetail(page, "Complément d'adresse")).toBe("Bât. B");
    expect(await valeurDetail(page, "Code postal et ville")).toBe("69003 Lyon");
    expect(await valeurDetail(page, "Nom")).toBe("Paul Martin");
    expect(await valeurDetail(page, "Adresse e-mail")).toBe(`paul.martin-${u}@quittances.test`);
    expect(sansEspacesSpeciales(await valeurDetail(page, "Loyer hors charges"))).toBe("1 250,50 €");
    expect(sansEspacesSpeciales(await valeurDetail(page, "Charges"))).toBe("0,00 €");
    expect(sansEspacesSpeciales(await valeurDetail(page, "Total charges comprises"))).toBe("1 250,50 €");
    expect(await valeurDetail(page, "Jour d'échéance")).toBe("Le 5 de chaque mois");
    expect(await valeurDetail(page, "Date de début du bail")).toBe("05/01/2026");
    await expect(page.getByText("Date de fin du bail", { exact: true })).toHaveCount(0);
    const [enBase] = await locationsDuCompte(email);
    expect(enBase.address).toBe("12 rue des Lilas");

    // Retour à la liste : la location y est, toujours sans document.
    await page.getByRole("link", { name: "Retour au tableau de bord" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByRole("heading", { level: 2, name: "Locations en cours" })).toBeVisible();
    await expect(ligneDe(page, "12 rue des Lilas, Bât. B")).toContainText("Paul Martin");
    await expect(page.getByRole("heading", { level: 2, name: "Aucune location pour l'instant" })).toHaveCount(0);
    // Un seul h1 et un seul main : la page précédente n'est pas gardée dans le DOM.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await lireTemoin(page)).toBe("present");
    expect(documents).toEqual([]);
    expect(console_).toEqual([]);
  });

  test("CA40 (création), R34 : sans JavaScript, erreurs réaffichées avec les valeurs, puis création", async ({ browser }) => {
    const { contexte, email } = await nouveauProprietaire(browser);
    const stockage = await contexte.storageState();
    await contexte.close();
    const sansJs = await browser.newContext({ javaScriptEnabled: false, storageState: stockage });
    try {
      const page = await sansJs.newPage();
      await page.goto("/tableau-de-bord");
      await expect(page.getByRole("heading", { level: 2 })).toHaveText("Aucune location pour l'instant");
      await page.getByRole("link", { name: "Ajouter une location" }).click();
      await expect(page).toHaveURL(/\/locations\/nouvelle$/);

      await page.getByRole("button", { name: "Ajouter la location" }).click();
      await expect(page.getByText("Saisissez l'adresse du logement.")).toBeVisible();
      for (const message of [
        "Saisissez le code postal.",
        "Saisissez la ville.",
        "Saisissez le nom du locataire.",
        "Saisissez l'adresse e-mail du locataire.",
        "Saisissez le loyer hors charges.",
        "Saisissez le montant des charges, ou 0 s'il n'y en a pas.",
        "Saisissez le jour d'échéance.",
        "Saisissez la date de début du bail.",
      ]) {
        await expect(page.getByText(message)).toBeVisible();
      }
      expect(await locationsDuCompte(email)).toHaveLength(0);

      // Valeurs conservées, aucune valeur dans l'adresse.
      await page.getByLabel("Adresse", { exact: true }).fill("1 rue d'Été");
      await page.getByLabel("Code postal").fill("7501");
      await page.getByLabel("Adresse e-mail du locataire").fill("paul@exemple");
      await page.getByLabel("Loyer hors charges").fill("850,555");
      await page.getByLabel("Charges", { exact: true }).fill("-5");
      await page.getByLabel("Jour d'échéance").fill("32");
      await page.getByLabel("Date de début du bail").fill("2027-02-28");
      await page.getByRole("button", { name: "Ajouter la location" }).click();
      await expect(page.getByText("Le code postal doit contenir 5 chiffres.")).toBeVisible();
      await expect(page.getByText("Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.")).toBeVisible();
      await expect(page.getByText("Saisissez un montant en euros, par exemple 850 ou 850,50.")).toHaveCount(2);
      await expect(page.getByText("Le jour d'échéance doit être un nombre entier de 1 à 31.")).toBeVisible();
      await expect(page.getByLabel("Adresse", { exact: true })).toHaveValue("1 rue d'Été");
      await expect(page.getByLabel("Code postal")).toHaveValue("7501");
      await expect(page.getByLabel("Charges", { exact: true })).toHaveValue("-5");
      await expect(page.getByLabel("Date de début du bail")).toHaveValue("2027-02-28");
      expect(page.url()).not.toContain("rue");
      expect(await locationsDuCompte(email)).toHaveLength(0);

      const saisie = saisieValide({ nom: "Zoé O'Brien", loyer: "1250.5", charges: "0", jour: "31" });
      await remplirLocation(page, saisie);
      await page.getByRole("button", { name: "Ajouter la location" }).click();
      await expect(page).toHaveURL(/\/locations\/[0-9a-f-]{36}$/);
      expect(sansEspacesSpeciales(await valeurDetail(page, "Loyer hors charges"))).toBe("1 250,50 €");
      expect(await valeurDetail(page, "Nom")).toBe("Zoé O'Brien");
      expect(await valeurDetail(page, "Jour d'échéance")).toBe(
        "Le 31 de chaque mois, ou le dernier jour du mois s'il est plus court",
      );
      await page.getByRole("link", { name: "Retour au tableau de bord" }).click();
      await expect(page.getByRole("link", { name: saisie.adresse })).toBeVisible();
      expect(await locationsDuCompte(email)).toHaveLength(1);
    } finally {
      await sansJs.close();
    }
  });

  test("CA24 : formulaire vide puis valeurs invalides, messages sous leurs champs, focus, valeurs conservées", async ({ page }) => {
    const { email } = await inscrire(page);
    await ouvrirCreation(page);
    await page.getByRole("button", { name: "Ajouter la location" }).click();

    const champErreur = (libelle: string, message: string, exact = false) => {
      const champ = page.getByLabel(libelle, { exact });
      return { champ, message: page.getByText(message, { exact: true }) };
    };
    for (const [libelle, message, exact] of [
      ["Adresse", "Saisissez l'adresse du logement.", true],
      ["Code postal", "Saisissez le code postal.", false],
      ["Ville", "Saisissez la ville.", false],
      ["Nom du locataire", "Saisissez le nom du locataire.", false],
      ["Adresse e-mail du locataire", "Saisissez l'adresse e-mail du locataire.", false],
      ["Loyer hors charges", "Saisissez le loyer hors charges.", false],
      ["Charges", "Saisissez le montant des charges, ou 0 s'il n'y en a pas.", true],
      ["Jour d'échéance", "Saisissez le jour d'échéance.", false],
      ["Date de début du bail", "Saisissez la date de début du bail.", false],
    ] as const) {
      const { champ, message: m } = champErreur(libelle, message, exact);
      await expect(m).toBeVisible();
      await expect(champ).toHaveAttribute("aria-invalid", "true");
      // Le message fait partie de la description accessible du champ.
      await expect(champ).toHaveAccessibleDescription(new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    await expect(page.getByLabel("Complément d'adresse (facultatif)")).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Adresse", { exact: true })).toBeFocused();
    await expect(page).toHaveURL(/\/locations\/nouvelle$/);

    const saisie = saisieValide({
      codePostal: "7501",
      email: "paul@exemple",
      loyer: "850,555",
      charges: "-5",
      jour: "32",
      debut: "2026-01-05",
    });
    await remplirLocation(page, saisie);
    await page.getByRole("button", { name: "Ajouter la location" }).click();
    await expect(page.getByText("Le code postal doit contenir 5 chiffres.")).toBeVisible();
    await expect(page.getByText("Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.")).toBeVisible();
    await expect(page.getByText("Saisissez un montant en euros, par exemple 850 ou 850,50.")).toHaveCount(2);
    await expect(page.getByText("Le jour d'échéance doit être un nombre entier de 1 à 31.")).toBeVisible();
    await expect(page.getByText("Saisissez l'adresse du logement.")).toHaveCount(0);
    await expect(page.getByLabel("Code postal")).toBeFocused();
    for (const [libelle, valeur, exact] of [
      ["Adresse", saisie.adresse, true],
      ["Code postal", "7501", false],
      ["Adresse e-mail du locataire", "paul@exemple", false],
      ["Loyer hors charges", "850,555", false],
      ["Charges", "-5", true],
      ["Jour d'échéance", "32", false],
    ] as const) {
      await expect(page.getByLabel(libelle, { exact })).toHaveValue(valeur);
    }
    expect(await locationsDuCompte(email)).toHaveLength(0);
  });

  test("CA10 (par l'interface), R15 : montants acceptés ou refusés, valeur enregistrée relue dans le détail", async ({ page }) => {
    await inscrire(page);
    const accepte = async (loyer: string, attendu: string) => {
      await ouvrirCreation(page);
      await remplirLocation(page, saisieValide({ loyer }));
      await page.getByRole("button", { name: "Ajouter la location" }).click();
      await expect(page).toHaveURL(/\/locations\/[0-9a-f-]{36}$/);
      expect(sansEspacesSpeciales(await valeurDetail(page, "Loyer hors charges"))).toBe(attendu);
    };
    const refuse = async (loyer: string, message: string) => {
      await ouvrirCreation(page);
      await remplirLocation(page, saisieValide({ loyer }));
      await page.getByRole("button", { name: "Ajouter la location" }).click();
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/locations\/nouvelle$/);
    };
    await accepte("1 250,50", "1 250,50 €");
    await accepte("1250.5", "1 250,50 €");
    await accepte("99999,99", "99 999,99 €");
    await refuse("1.250", "Saisissez un montant en euros, par exemple 850 ou 850,50.");
    await refuse("0", "Le loyer hors charges doit être supérieur à zéro.");
    await refuse("100000", "Le montant ne peut pas dépasser 99 999,99 euros.");
  });

  test("CA25, R25 : double activation, une seule location, bouton indisponible pendant l'attente", async ({ page }) => {
    const { email } = await inscrire(page);
    await ouvrirCreation(page);
    const saisie = saisieValide();
    await remplirLocation(page, saisie);

    let liberer!: () => void;
    const porte = new Promise<void>((resolve) => (liberer = resolve));
    await page.route("**/locations/nouvelle", async (route) => {
      if (route.request().method() === "POST") await porte;
      await route.continue();
    });
    await page.getByRole("button", { name: "Ajouter la location" }).dblclick();
    const attente = page.getByRole("button", { name: "Ajout en cours" });
    await expect(attente).toBeVisible();
    await expect(attente).toBeDisabled();
    await expect(attente).toHaveCSS("opacity", "0.6");
    liberer();
    await expect(page).toHaveURL(/\/locations\/[0-9a-f-]{36}$/);
    expect(await locationsDuCompte(email)).toHaveLength(1);
  });

  test("CA27 : le HTML saisi s'affiche comme du texte, sur la liste et le détail", async ({ page }) => {
    await inscrire(page);
    await ouvrirCreation(page);
    const adresse = `<img src=x onerror="window.__xss=1">`;
    const nom = "<script>window.__xss=1</script>";
    await remplirLocation(page, saisieValide({ adresse, nom }));
    await page.getByRole("button", { name: "Ajouter la location" }).click();
    await expect(page).toHaveURL(/\/locations\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(adresse);
    expect(await valeurDetail(page, "Nom")).toBe(nom);
    await page.getByRole("link", { name: "Retour au tableau de bord" }).click();
    await expect(page.getByRole("link", { name: adresse })).toBeVisible();
    await expect(page.getByText(nom, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("CA17, CA20 : ordre, groupes, contenu des lignes, chips, un seul bouton primaire, e-mail du locataire absent du code source", async ({ page }) => {
    const { email } = await inscrire(page);
    const debut = Date.now() - 600_000;
    const X = await creerLocation(email, { address: `X ${suffixeUnique()}`, addressComplement: "Bât. X", rentInCents: 125050, chargesInCents: 0, dueDay: 31 }, new Date(debut));
    const Y = await creerLocation(email, { address: `Y ${suffixeUnique()}` }, new Date(debut + 1000));
    const Z = await creerLocation(email, { address: `Z ${suffixeUnique()}`, endDate: "2099-12-31" }, new Date(debut + 2000));
    const T1 = await creerLocation(email, { address: `T1 ${suffixeUnique()}`, startDate: "2025-01-01", endDate: "2026-01-31" });
    const T2 = await creerLocation(email, { address: `T2 ${suffixeUnique()}`, startDate: "2025-01-01", endDate: "2026-06-30" });
    await page.goto("/tableau-de-bord");
    await expect(page.getByRole("heading", { level: 2, name: "Locations en cours" })).toBeVisible();

    const liens = await page.getByRole("listitem").getByRole("link").allInnerTexts();
    expect(liens).toEqual([
      `${X.valeurs.address}, Bât. X`,
      Y.valeurs.address,
      Z.valeurs.address,
      T2.valeurs.address,
      T1.valeurs.address,
    ]);
    const titres = await page.getByRole("heading", { level: 2 }).allInnerTexts();
    expect(titres).toEqual(["Locations en cours", "Locations terminées"]);

    const ligneX = ligneDe(page, `${X.valeurs.address}, Bât. X`);
    const texteX = sansEspacesSpeciales((await ligneX.innerText()).replace(/\n+/g, " | "));
    expect(texteX).toContain("69003 Lyon");
    expect(texteX).toContain(X.valeurs.tenantName);
    expect(texteX).toContain("Échéance le 31 du mois");
    expect(texteX).toContain("1 250,50 € charges comprises");
    expect(texteX).toContain("En cours");
    await expect(ligneDe(page, Z.valeurs.address)).toContainText("Fin prévue le 31/12/2099");
    await expect(ligneDe(page, T2.valeurs.address)).toContainText("Terminée le 30/06/2026");
    await expect(ligneDe(page, T1.valeurs.address)).toContainText("Terminée le 31/01/2026");
    // Un seul lien par ligne : le détail.
    await expect(ligneX.getByRole("link")).toHaveCount(1);
    await expect(ligneX.getByRole("link")).toHaveAttribute("href", `/locations/${X.id}`);

    // CA20 : chips.
    const chip = (ligne: ReturnType<typeof ligneDe>, texte: string) => ligne.getByText(texte, { exact: true });
    const encours = chip(ligneX, "En cours");
    await expect(encours).toHaveCSS("color", "rgb(4, 120, 87)");
    await expect(encours).toHaveCSS("background-color", "rgb(236, 253, 245)");
    await expect(encours).toHaveCSS("font-size", "12px");
    await expect(encours).toHaveCSS("border-top-left-radius", "9999px");
    const terminee = chip(ligneDe(page, T1.valeurs.address), "Terminée");
    await expect(terminee).toHaveCSS("color", "rgb(107, 107, 107)");
    await expect(terminee).toHaveCSS("background-color", "rgb(250, 250, 250)");
    await expect(terminee).toHaveCSS("border-top-color", "rgb(232, 232, 236)");
    const tokens = await page.evaluate(() =>
      ["success-text", "success-surface", "warning-text", "warning-surface"].map((n) =>
        getComputedStyle(document.documentElement).getPropertyValue(`--color-${n}`).trim().toLowerCase(),
      ),
    );
    expect(tokens).toEqual(["#047857", "#ecfdf5", "#b45309", "#fffbeb"]);

    // CA17 : « Ajouter une location » est le seul élément à fond primaire.
    const fondsPrimaires = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((e) => getComputedStyle(e).backgroundColor === "rgb(79, 70, 229)")
        .map((e) => e.textContent?.trim()),
    );
    expect(fondsPrimaires).toEqual(["Ajouter une location"]);

    // Aucune adresse e-mail de locataire dans le document ni dans la charge RSC.
    const source = await (await page.request.get("/tableau-de-bord")).text();
    const rsc = await (await page.request.get("/tableau-de-bord", { headers: { RSC: "1" } })).text();
    for (const l of [X, Y, Z, T1, T2]) {
      expect(source).not.toContain(l.valeurs.tenantEmail);
      expect(rsc).not.toContain(l.valeurs.tenantEmail);
    }
  });

  test("CA18 : uniquement des locations terminées", async ({ page }) => {
    const { email } = await inscrire(page);
    const T = await creerLocation(email, { startDate: "2025-01-01", endDate: "2026-01-31" });
    await page.goto("/tableau-de-bord");
    await expect(page.getByRole("heading", { level: 2, name: "Locations en cours" })).toBeVisible();
    await expect(page.getByText("Aucune location en cours.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Locations terminées" })).toBeVisible();
    await expect(page.getByRole("link", { name: T.valeurs.address })).toBeVisible();
    await expect(page.getByText("Aucune location pour l'instant")).toHaveCount(0);
  });

  test("CA28 : détail d'une location terminée, avec complément, liens d'action, pas de lien vers elle-même", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, { addressComplement: "Bât. C", startDate: "2025-01-01", endDate: "2026-01-31", dueDay: 31 });
    await page.goto(`/locations/${L.id}`);
    await expect(page).toHaveTitle("Location — Quittances");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(L.valeurs.address);
    await expect(page.getByRole("main").getByText("Terminée", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Le logement",
      "Le locataire",
      "Le loyer et le bail",
      "Quittances",
      "Actions",
    ]);
    expect(await valeurDetail(page, "Complément d'adresse")).toBe("Bât. C");
    expect(await valeurDetail(page, "Date de fin du bail")).toBe("31/01/2026");
    expect(await valeurDetail(page, "Jour d'échéance")).toBe(
      "Le 31 de chaque mois, ou le dernier jour du mois s'il est plus court",
    );
    expect(sansEspacesSpeciales(await valeurDetail(page, "Total charges comprises"))).toBe("900,00 €");
    await expect(page.getByRole("link", { name: "Modifier", exact: true })).toHaveAttribute("href", `/locations/${L.id}/modifier`);
    await expect(page.getByRole("link", { name: "Modifier la fin de la location" })).toHaveAttribute("href", `/locations/${L.id}/fin`);
    // T5 : une location terminée sans quittance a le lien Archiver, puis Supprimer (R43 de la spécification 04).
    await expect(page.getByRole("link", { name: "Archiver", exact: true })).toHaveAttribute("href", `/locations/${L.id}/archiver`);
    await expect(page.getByRole("link", { name: "Supprimer", exact: true })).toHaveAttribute("href", `/locations/${L.id}/supprimer`);
    await expect(page.getByRole("link", { name: "Mettre fin à la location" })).toHaveCount(0);
    await expect(page.locator(`a[href="/locations/${L.id}"]`)).toHaveCount(0);
    const terminee = page.getByRole("main").getByText("Terminée", { exact: true });
    await expect(terminee).toHaveCSS("color", "rgb(107, 107, 107)");
    // CA43 : bouton destructif.
    const supprimer = page.getByRole("link", { name: "Supprimer" });
    await expect(supprimer).toHaveCSS("border-top-color", "rgb(239, 68, 68)");
    await expect(supprimer).toHaveCSS("color", "rgb(185, 28, 28)");
  });

  test("CA43 (partie T3 à T5) : valeurs très longues, aucun défilement horizontal de 320 à 1920px, montants sur une ligne", async ({ page }) => {
    const { email } = await inscrire(page);
    const L = await creerLocation(email, {
      address: "A".repeat(200),
      addressComplement: "C".repeat(100),
      city: "V".repeat(100),
      tenantName: "N".repeat(100),
      tenantEmail: `${"e".repeat(60)}@quittances.test`,
      rentInCents: 9999999,
      chargesInCents: 9999999,
    });
    for (const largeur of [320, 412, 768, 1280, 1920]) {
      await page.setViewportSize({ width: largeur, height: 900 });
      for (const chemin of ["/tableau-de-bord", `/locations/${L.id}`, "/locations/nouvelle"]) {
        await page.goto(chemin);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const [defilement, fenetre] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        expect(defilement, `${chemin} à ${largeur}px`).toBeLessThanOrEqual(fenetre);
      }
      await page.goto("/tableau-de-bord");
      const montant = page.locator("p").filter({ hasText: /199.999,98.€ charges comprises/ }).first();
      await expect(montant).toBeVisible();
      // Une seule ligne : la hauteur de l'élément ne dépasse pas celle d'une ligne de texte.
      const lignes = await montant.evaluate((e) => {
        const style = getComputedStyle(e);
        return Math.round(e.getBoundingClientRect().height / parseFloat(style.lineHeight));
      });
      expect(lignes, `montant coupé à ${largeur}px`).toBe(1);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/locations/${L.id}`);
    const largeurColonne = await page.locator("main > div").first().evaluate((e) => e.getBoundingClientRect().width);
    expect(largeurColonne).toBeLessThanOrEqual(640);
  });
});

test.describe("Locations : isolation entre comptes (A et B)", () => {
  test("CA19 : chaque liste ne contient que ses locations, aucune donnée de l'autre dans le code source, rien après déconnexion", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const a1 = await creerLocation(a.email, { address: `ADR-A1-${suffixeUnique()}` });
      const a2 = await creerLocation(a.email, { address: `ADR-A2-${suffixeUnique()}` });
      const b1 = await creerLocation(b.email, { address: `ADR-B1-${suffixeUnique()}` });
      await a.page.goto("/tableau-de-bord");
      await b.page.goto("/tableau-de-bord");
      await expect(a.page.getByRole("link", { name: a1.valeurs.address })).toBeVisible();
      await expect(a.page.getByRole("link", { name: a2.valeurs.address })).toBeVisible();
      await expect(b.page.getByRole("link", { name: b1.valeurs.address })).toBeVisible();
      await expect(a.page.getByRole("listitem")).toHaveCount(2);
      await expect(b.page.getByRole("listitem")).toHaveCount(1);

      const sourceA = await a.page.content();
      const sourceB = await b.page.content();
      for (const secret of [b1.valeurs.address, b1.valeurs.tenantName, b1.id, b1.valeurs.tenantEmail]) expect(sourceA).not.toContain(secret);
      for (const l of [a1, a2]) {
        for (const secret of [l.valeurs.address, l.valeurs.tenantName, l.id, l.valeurs.tenantEmail]) expect(sourceB).not.toContain(secret);
      }

      // Même onglet : A se déconnecte, B se connecte ; rien de A ne réapparaît, y compris par Précédent.
      await deconnecter(a.page);
      const contenu = await a.page.content();
      for (const secret of [a1.valeurs.address, a1.valeurs.tenantName, a1.id, a.email]) expect(contenu).not.toContain(secret);
      await ouvrirConnexion(a.page);
      await remplirEtSeConnecter(a.page, b.email, b.motDePasse);
      await expect(a.page).toHaveURL(/\/tableau-de-bord$/);
      await expect(a.page.getByRole("link", { name: b1.valeurs.address })).toBeVisible();
      await expect(a.page.getByText(a1.valeurs.address)).toHaveCount(0);
      await a.page.goBack();
      await a.page.goBack();
      const apresRetour = await a.page.content();
      for (const secret of [a1.valeurs.address, a1.valeurs.tenantName, a1.id, a.email]) expect(apresRetour).not.toContain(secret);
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("CA29, R5 : B demande la location de A, un UUID inconnu, des identifiants mal formés : 404 identiques, rien de A, A intact", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email, { address: `SECRET-ADR-${suffixeUnique()}`, tenantName: `SECRET-NOM-${suffixeUnique()}` });
      const avant = await locationsDuCompte(a.email);
      const demander = async (chemin: string) => {
        const reponse = await b.contexte.request.get(chemin, { maxRedirects: 0 });
        const corps = await reponse.text();
        return { reponse, corps, titre: /<title>([^<]*)/.exec(corps)?.[1] };
      };
      const normaliser = (corps: string, ...ids: string[]) => {
        let s = corps;
        for (const id of ids) s = s.split(id).join("ID");
        return s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "ID");
      };
      const mal = ["1", "nouvelle2", "%27%20or%201%3D1", "a".repeat(5000), "%7B" + UUID_INCONNU + "%7D", UUID_INCONNU.replace(/-/g, ""), "%00", "..%2F", "😀"];

      for (const sfx of ["", "/modifier", "/fin", "/supprimer", "/autre/chose"]) {
        const demandeA = await demander(`/locations/${la.id}${sfx}`);
        const inconnue = await demander(`/locations/${UUID_INCONNU}${sfx}`);
        const majuscules = await demander(`/locations/${la.id.toUpperCase()}${sfx}`);
        for (const x of [demandeA, inconnue, majuscules]) {
          expect(x.reponse.status(), `statut ${sfx}`).toBe(404);
          expect(x.reponse.headers()["cache-control"]).toMatch(/private|no-store/);
          expect(x.corps).not.toContain("SECRET-");
          expect(x.corps).not.toContain(la.valeurs.tenantEmail);
        }
        // Ne diffèrent que par l'adresse demandée.
        expect(normaliser(demandeA.corps, la.id)).toBe(normaliser(inconnue.corps, UUID_INCONNU));
        expect(normaliser(majuscules.corps, la.id.toUpperCase(), la.id)).toBe(normaliser(inconnue.corps, UUID_INCONNU));
        expect(demandeA.titre).toBe(inconnue.titre);
        expect(demandeA.reponse.headers()["content-type"]).toBe(inconnue.reponse.headers()["content-type"]);
        for (const m of mal) {
          const x = await demander(`/locations/${m}${sfx}`);
          expect(x.reponse.status(), `/locations/${m.slice(0, 20)}${sfx}`).toBe(404);
          expect(x.corps).not.toContain("SECRET-");
        }
      }

      // Charge RSC : même réponse, rien de A.
      for (const id of [la.id, UUID_INCONNU]) {
        const rsc = await b.contexte.request.get(`/locations/${id}`, { headers: { RSC: "1" } });
        const texte = await rsc.text();
        expect(texte).not.toContain("SECRET-");
        expect(texte).toContain("Location introuvable");
      }

      // Dans le navigateur, avec JavaScript : l'écran, sans donnée de A.
      const console_ = surveillerConsole(b.page, { tolerer404: true });
      await b.page.goto(`/locations/${la.id}`);
      await expect(b.page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
      await expect(b.page).toHaveTitle("Location introuvable — Quittances");
      await expect(b.page.getByText("Cette location n'existe pas ou a été supprimée.")).toBeVisible();
      await expect(b.page.getByRole("link", { name: "Retour au tableau de bord" })).toBeVisible();
      await expect(b.page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
      expect(await b.page.content()).not.toContain("SECRET-");
      expect(console_).toEqual([]);

      // La liste de B ne contient pas la location de A ; A l'a toujours, intacte.
      await b.page.goto("/tableau-de-bord");
      await expect(b.page.getByText("Aucune location pour l'instant")).toBeVisible();
      expect(await locationsDuCompte(a.email)).toEqual(avant);
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("CA26, R4, R7 : B appelle la création avec des champs parasites, la location est à B, A est intact", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email, { address: `A-INTACT-${suffixeUnique()}` });
      const avant = await locationsDuCompte(a.email);
      const idCompteA = await identifiantDuCompte(a.email);

      await ouvrirCreation(b.page);
      const saisie = saisieValide();
      await remplirLocation(b.page, saisie);
      // Champs parasites sous tous les noms plausibles, ajoutés au formulaire réel.
      await b.page.evaluate(
        ([parasites]) => {
          const formulaire = document.querySelector("main form")!;
          for (const [nom, valeur] of Object.entries(parasites)) {
            const champ = document.createElement("input");
            champ.type = "hidden";
            champ.name = nom;
            champ.value = valeur;
            formulaire.appendChild(champ);
          }
        },
        [
          {
            ownerId: idCompteA,
            owner_id: idCompteA,
            userId: idCompteA,
            id: la.id,
            rentalId: la.id,
            endDate: "2026-03-01",
            end_date: "2026-03-01",
          },
        ],
      );
      await b.page.getByRole("button", { name: "Ajouter la location" }).click();
      await expect(b.page).toHaveURL(/\/locations\/[0-9a-f-]{36}$/);
      const idNouvelle = b.page.url().split("/").pop()!;
      expect(idNouvelle).not.toBe(la.id);
      await expect(b.page.getByText("Date de fin du bail", { exact: true })).toHaveCount(0);

      const chezB = await locationsDuCompte(b.email);
      expect(chezB.map((l) => l.id)).toEqual([idNouvelle]);
      expect(chezB[0].end_date).toBeNull();
      expect(await locationsDuCompte(a.email)).toEqual(avant);
      // Elle n'apparaît pas chez A.
      await a.page.goto("/tableau-de-bord");
      await expect(a.page.getByRole("link", { name: saisie.adresse })).toHaveCount(0);
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("R7, CA26 : l'action de création sans session redirige vers /connexion et n'écrit rien ; depuis une autre origine elle est refusée", async ({ browser, request }) => {
    const b = await nouveauProprietaire(browser);
    try {
      await ouvrirCreation(b.page);
      const html = await (await b.contexte.request.get("/locations/nouvelle")).text();
      const idAction = /name="\$ACTION_ID_([0-9a-f]+)"/.exec(html)?.[1];
      expect(idAction, "identifiant de l'action dans le formulaire").toBeDefined();
      const adresse = `SANS-SESSION-${suffixeUnique()}`;
      const corps = {
        address: adresse,
        postalCode: "69001",
        city: "Lyon",
        tenantName: "Intrus",
        tenantEmail: "intrus@quittances.test",
        rent: "1",
        charges: "0",
        dueDay: "1",
        startDate: "2026-01-01",
        [`$ACTION_ID_${idAction}`]: "",
      };
      const sansSession = await request.post("/locations/nouvelle", { multipart: corps, maxRedirects: 0 });
      expect(sansSession.status()).toBe(303);
      expect(sansSession.headers().location).toBe("/connexion");

      const autreOrigine = await b.contexte.request.post("/locations/nouvelle", {
        multipart: corps,
        headers: { Origin: "https://evil.example" },
        maxRedirects: 0,
      });
      expect(autreOrigine.status()).toBeGreaterThanOrEqual(400);
      expect(await locationsDuCompte(b.email)).toHaveLength(0);
    } finally {
      await b.contexte.close();
    }
  });
});

test.describe("Locations : protection et codes HTTP", () => {
  test("CA30, R28 : sans session, cookie inventé ou session expirée, 307 vers /connexion avec retour, aucun contenu protégé", async ({ browser, playwright }) => {
    const a = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email, { address: `SECRET-ADR-${suffixeUnique()}` });
      const cookie = (await a.contexte.cookies()).find((c) => c.name.includes("session_token"))!;
      const inventé = `${cookie.name}=${"x".repeat(32)}.${"y".repeat(43)}`;
      // Session d'un autre compte, expirée en base.
      const e = await nouveauProprietaire(browser);
      const cookieE = (await e.contexte.cookies()).find((c) => c.name.includes("session_token"))!;
      await expirerSession(e.email);
      await e.contexte.close();

      const chemins = [
        "/tableau-de-bord",
        "/locations",
        "/locations/nouvelle",
        "/archives",
        `/locations/${la.id}/archiver`,
        `/locations/${la.id}`,
        `/locations/${UUID_INCONNU}`,
        `/locations/${la.id}/modifier`,
        `/locations/${UUID_INCONNU}/fin`,
        `/locations/${la.id}/supprimer`,
        `/locations/${la.id}/autre`,
      ];
      const interdits = ["SECRET-", "Aucune location archivée", "Archiver cette location", "Location introuvable", "Ajouter une location", "Adresse e-mail du locataire", "Se déconnecter", "Modifier la location"];
      for (const [cas, entete] of [
        ["sans cookie", undefined],
        ["cookie inventé", inventé],
        ["session expirée", `${cookieE.name}=${cookieE.value}`],
      ] as const) {
        const contexte = await playwright.request.newContext({
          baseURL: "http://localhost:3100",
          extraHTTPHeaders: entete ? { Cookie: entete } : {},
        });
        try {
          const redirections = new Set<string>();
          for (const chemin of chemins) {
            const reponse = await contexte.get(chemin, { maxRedirects: 0 });
            expect(reponse.status(), `${cas} ${chemin}`).toBe(307);
            const location = reponse.headers().location;
            expect(location, `${cas} ${chemin}`).toBe(`/connexion?retour=${encodeURIComponent(chemin)}`);
            const corps = await reponse.text();
            for (const interdit of interdits) expect(corps).not.toContain(interdit);
            expect(corps).not.toMatch(/<title>[^<]*(Ajouter une location|Location|Modifier|Fin de la|Supprimer|Tableau de bord)/);
            redirections.add(location.replace(la.id, "ID").replace(UUID_INCONNU, "ID"));
          }
          expect(redirections.size).toBeGreaterThan(1);
        } finally {
          await contexte.dispose();
        }
      }

      // Chemin et paramètres préservés, encodés.
      const contexte = await playwright.request.newContext({ baseURL: "http://localhost:3100" });
      const avecParametres = await contexte.get("/locations/zzz/fin?x=1&y=%C3%A9", { maxRedirects: 0 });
      expect(avecParametres.status()).toBe(307);
      expect(avecParametres.headers().location).toBe(`/connexion?retour=${encodeURIComponent("/locations/zzz/fin?x=1&y=%C3%A9")}`);
      await contexte.dispose();
    } finally {
      await a.contexte.close();
    }
  });

  test("R28, R4 : chaque page redirige elle-même sans session (une requête HEAD n'est pas traitée par le proxy)", async ({ playwright }) => {
    // Le proxy ne redirige que les lectures GET (src/proxy.ts) : avec HEAD, seule la page
    // peut refuser. Ce test prouve la seconde barrière, celle qui reste si le proxy saute.
    const contexte = await playwright.request.newContext({ baseURL: "http://localhost:3100" });
    try {
      for (const chemin of [
        "/tableau-de-bord",
        "/locations",
        "/locations/nouvelle",
        "/archives",
        `/locations/${UUID_INCONNU}/archiver`,
        `/locations/${UUID_INCONNU}`,
        `/locations/${UUID_INCONNU}/autre`,
      ]) {
        const reponse = await contexte.head(chemin, { maxRedirects: 0 });
        expect(reponse.status(), chemin).toBe(307);
        expect(reponse.headers().location, chemin).toBe(`/connexion?retour=${encodeURIComponent(chemin)}`);
      }
    } finally {
      await contexte.dispose();
    }
  });

  test("CA30 (retour après connexion), R28 : le propriétaire retrouve la page demandée, un autre compte l'écran introuvable", async ({ browser }) => {
    const a = await nouveauProprietaire(browser);
    const b = await nouveauProprietaire(browser);
    try {
      const la = await creerLocation(a.email);
      // Déconnecte A et B, puis rejoue un retour.
      await deconnecter(a.page);
      await deconnecter(b.page);

      await ouvrirConnexion(a.page, `/connexion?retour=${encodeURIComponent(`/locations/${la.id}`)}`);
      await remplirEtSeConnecter(a.page, a.email, MOT_DE_PASSE);
      await expect(a.page).toHaveURL(`/locations/${la.id}`);
      await expect(a.page.getByRole("heading", { level: 1 })).toContainText(la.valeurs.address);

      await deconnecter(a.page);
      await ouvrirConnexion(a.page, `/connexion?retour=${encodeURIComponent("/locations/nouvelle")}`);
      await remplirEtSeConnecter(a.page, a.email, MOT_DE_PASSE);
      await expect(a.page).toHaveURL(/\/locations\/nouvelle$/);
      await expect(a.page.getByRole("heading", { level: 1, name: "Ajouter une location" })).toBeVisible();

      const console_ = surveillerConsole(b.page, { tolerer404: true });
      await ouvrirConnexion(b.page, `/connexion?retour=${encodeURIComponent(`/locations/${la.id}`)}`);
      await remplirEtSeConnecter(b.page, b.email, b.motDePasse);
      await expect(b.page).toHaveURL(`/locations/${la.id}`);
      await expect(b.page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
      expect(await b.page.content()).not.toContain(la.valeurs.address);
      expect(console_).toEqual([]);
    } finally {
      await a.contexte.close();
      await b.contexte.close();
    }
  });

  test("CA31, CA46 : /locations mène au tableau de bord ; les pages protégées ne sont jamais en cache partagé", async ({ page }) => {
    const { email } = await inscrire(page);
    const la = await creerLocation(email);
    const redirection = await page.request.get("/locations", { maxRedirects: 0 });
    expect(redirection.status()).toBe(307);
    expect(redirection.headers().location).toBe("/tableau-de-bord");
    await page.goto("/locations");
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    for (const chemin of ["/tableau-de-bord", "/locations/nouvelle", "/archives", `/locations/${la.id}/archiver`, `/locations/${la.id}`, `/locations/${UUID_INCONNU}`]) {
      const r = await page.request.get(chemin);
      expect(r.headers()["cache-control"], chemin).toMatch(/private|no-store/);
    }
  });

  test("R5, R6 : identifiants hostiles dans l'adresse, jamais d'erreur serveur ni de fuite", async ({ page, request }) => {
    await inscrire(page);
    const hostiles = [
      "%7B" + UUID_INCONNU + "%7D",
      "%00",
      "%0A",
      "..%2F",
      "a".repeat(5000),
      "%27%20or%201%3D1",
      "%252e",
      "'%3B%20drop%20table%20rental%3B--",
      "%C0%AF",
      "%",
      "%zz",
    ];
    for (const h of hostiles) {
      for (const sfx of ["", "/modifier"]) {
        const connecte = await page.request.get(`/locations/${h}${sfx}`, { maxRedirects: 0 });
        expect(connecte.status(), `connecté ${h.slice(0, 20)}${sfx}`).toBeLessThan(500);
        expect([404, 400]).toContain(connecte.status());
        const visiteur = await request.get(`/locations/${h}${sfx}`, { maxRedirects: 0 });
        expect(visiteur.status(), `visiteur ${h.slice(0, 20)}${sfx}`).toBeLessThan(500);
        if (visiteur.status() === 307) {
          // Un retour hostile reste un chemin interne sous /connexion.
          expect(visiteur.headers().location.startsWith("/connexion?retour=%2Flocations%2F")).toBe(true);
        }
      }
    }
  });
});

test.describe("Locations : accessibilité et clavier", () => {
  async function analyser(page: Page, nom: string) {
    const resultat = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(resultat.violations.map((v) => `${nom}: ${v.id}`)).toEqual([]);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  }

  test("CA42 : axe sans violation sur le tableau de bord (vide et rempli), le formulaire (vide et en erreur), le détail et l'écran introuvable", async ({ page }) => {
    const { email } = await inscrire(page);
    await analyser(page, "tableau de bord vide");
    const la = await creerLocation(email, { startDate: "2025-01-01", endDate: "2026-01-31" });
    await creerLocation(email);
    await page.goto("/tableau-de-bord");
    await expect(page.getByRole("heading", { level: 2, name: "Locations terminées" })).toBeVisible();
    await analyser(page, "tableau de bord rempli");
    await ouvrirCreation(page);
    await analyser(page, "formulaire vide");
    await page.getByRole("button", { name: "Ajouter la location" }).click();
    await expect(page.getByText("Saisissez la ville.")).toBeVisible();
    await analyser(page, "formulaire en erreur");
    await page.goto(`/locations/${la.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(la.valeurs.address);
    await analyser(page, "détail");
    await page.goto(`/locations/${UUID_INCONNU}`);
    await expect(page.getByRole("heading", { level: 1, name: "Location introuvable" })).toBeVisible();
    await analyser(page, "introuvable");
  });

  test("CA44, R33 : au clavier seul, le logo en premier, puis les onze champs (la case d'accord après l'adresse e-mail) dans l'ordre, le bouton et Annuler, avec un focus visible", async ({ page }) => {
    await inscrire(page);
    await ouvrirCreation(page);
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const ordre = [
      page.getByRole("link", { name: "Quittances, tableau de bord" }),
      page.getByRole("button", { name: "Se déconnecter" }),
      page.getByLabel("Adresse", { exact: true }),
      page.getByLabel("Complément d'adresse (facultatif)"),
      page.getByLabel("Code postal"),
      page.getByLabel("Ville"),
      page.getByLabel("Nom du locataire"),
      page.getByLabel("Adresse e-mail du locataire"),
      page.getByLabel("Mon locataire a accepté de recevoir ses quittances de loyer par e-mail."),
      page.getByLabel("Loyer hors charges"),
      page.getByLabel("Charges", { exact: true }),
      page.getByLabel("Jour d'échéance"),
    ];
    for (const element of ordre) {
      await page.keyboard.press("Tab");
      await expect(element).toBeFocused();
    }
    // Le champ de date contient plusieurs segments : on le traverse jusqu'au bouton.
    const bouton = page.getByRole("button", { name: "Ajouter la location" });
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      if (await bouton.evaluate((e) => e === document.activeElement)) break;
    }
    await expect(bouton).toBeFocused();
    await expect(bouton).not.toHaveCSS("outline-style", "none");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Annuler" })).toBeFocused();
    // Le focus d'un champ est visible.
    await page.getByLabel("Ville").focus();
    await expect(page.getByLabel("Ville")).toHaveCSS("border-top-color", "rgb(79, 70, 229)");
  });

  test("CA44 : « Annuler », liens du détail et de la liste sans rechargement de document", async ({ page }) => {
    const { email } = await inscrire(page);
    const la = await creerLocation(email);
    const documents = surveillerDocuments(page);
    await page.goto("/tableau-de-bord");
    documents.length = 0;
    await poserTemoin(page);
    await page.getByRole("link", { name: la.valeurs.address }).click();
    await expect(page).toHaveURL(`/locations/${la.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(la.valeurs.address);
    await page.getByRole("link", { name: "Retour au tableau de bord" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await page.getByRole("link", { name: "Ajouter une location" }).click();
    await expect(page).toHaveURL(/\/locations\/nouvelle$/);
    await page.getByRole("link", { name: "Annuler" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    expect(await lireTemoin(page)).toBe("present");
    expect(documents).toEqual([]);
    expect(await locationsDuCompte(email)).toHaveLength(1);
  });
});
