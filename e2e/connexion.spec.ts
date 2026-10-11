import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  adresseUnique,
  champEmail,
  champMotDePasse,
  connecter,
  cookieDeSession,
  creerCompte,
  deconnecter,
  enteteCookie,
  expirationSession,
  inscrire,
  MOT_DE_PASSE,
  nombreDeSessions,
  ouvrirConnexion,
  ouvrirInscription,
  remplirEtEnvoyer,
  remplirEtSeConnecter,
} from "./aide-comptes";

// Connexion (spec 02, T4) : CA9 (vu du navigateur), CA13 (dernière partie), CA15 et
// CA17 (arrivée), CA22 (cookie après connexion), CA23 à CA28, CA30 et CA32 pour
// /connexion, R3 (ancienne session fermée), R13, R14 (redirection ouverte), CA21 (dans espace-reserve.spec.ts), R21
// (aucun mot de passe dans le document), parcours complet des quatre parcours.
// Non couvert ici : E8 (panne de base, CA29), qui exige un second serveur dont la
// base est injoignable : manipulation manuelle, voir le compte rendu de recette.
// Chaque test crée ses propres comptes (R40).

const E1 = "Saisissez votre adresse e-mail.";
const E4 = "Saisissez votre mot de passe.";
const E3 = "Un compte existe déjà avec cette adresse e-mail.";
const E7 = "Adresse e-mail ou mot de passe incorrect.";
const ROUGE_TEXTE = "rgb(185, 28, 28)";
const BOUTON = "Se connecter";
const RETOUR = "/connexion?retour=%2Ftableau-de-bord%3Fexemple%3D1";

/** Attend la réponse du serveur à un envoi de formulaire. */
async function envoyer(page: Page) {
  const reponse = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name: BOUTON }).click();
  await reponse;
}

/** Les champs cachés que Next ajoute au formulaire pour retrouver sa Server Action. */
async function champsCaches(page: Page): Promise<Record<string, string>> {
  const champs = await page
    .locator("form input[type=hidden]")
    .evaluateAll((els) =>
      els.map((e) => [(e as HTMLInputElement).name, (e as HTMLInputElement).value]),
    );
  return Object.fromEntries(champs);
}

/** Le statut de /tableau-de-bord pour un cookie donné : 200 si la session vit, 307 sinon. */
async function statutTableauDeBord(request: APIRequestContext, entete: string) {
  const reponse = await request.get("/tableau-de-bord", {
    headers: { Cookie: entete },
    maxRedirects: 0,
  });
  return reponse.status();
}

const pose = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __temoin: string }).__temoin = "present";
  });
const temoin = (page: Page) =>
  page.evaluate(() => (window as unknown as { __temoin?: string }).__temoin);

test.describe("Connexion : page et formulaire", () => {
  test("CA23 : contenus, attributs des champs, aucun lien « oublié », liens sans rechargement", async ({
    page,
  }) => {
    await ouvrirConnexion(page);
    await expect(page).toHaveTitle("Connexion — Quittances");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connexion");
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
    await expect(page.getByLabel("Mot de passe", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: BOUTON })).toBeVisible();
    await expect(
      page.getByText("La réinitialisation du mot de passe n'est pas encore disponible."),
    ).toBeVisible();
    await expect(page.getByText("Pas encore de compte.")).toBeVisible();

    const email = champEmail(page);
    const mdp = champMotDePasse(page);
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "username");
    await expect(mdp).toHaveAttribute("type", "password");
    await expect(mdp).toHaveAttribute("autocomplete", "current-password");
    for (const champ of [email, mdp]) {
      await expect(champ).toHaveValue("");
      await expect(champ).toHaveJSProperty("required", true);
      await expect(champ).not.toHaveAttribute("placeholder", /.+/);
      await expect(champ).not.toBeFocused();
      await expect(champ).not.toHaveAttribute("aria-invalid", "true");
    }
    // Pas d'introduction, pas de texte d'aide sous le champ, aucune erreur au départ.
    await expect(page.getByText("Un compte par propriétaire")).toHaveCount(0);
    await expect(page.getByText("12 caractères au minimum")).toHaveCount(0);
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
    await expect(page.locator("form")).toHaveAttribute("novalidate", "");

    // Aucun lien ni bouton « mot de passe oublié ».
    await expect(page.getByRole("link", { name: /oubli/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /oubli/i })).toHaveCount(0);
    // Pas de lien vers /connexion sur /connexion (le logo mène à l'accueil).
    await expect(page.locator('a[href^="/connexion"]')).toHaveCount(0);

    // « Créer un compte » : /inscription sans paramètre, sans rechargement du document.
    const lien = page.getByRole("link", { name: "Créer un compte" });
    await expect(lien).toHaveAttribute("href", "/inscription");
    await pose(page);
    const documents: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "document") documents.push(r.url());
    });
    await lien.click();
    await expect(page).toHaveURL((u) => u.pathname === "/inscription");
    await expect(page.getByRole("heading", { level: 1, name: "Créer un compte" })).toBeVisible();
    expect(await temoin(page)).toBe("present");
    expect(documents).toEqual([]);

    // Et l'inverse : « Se connecter » de l'inscription, sans paramètre non plus.
    await page.getByRole("link", { name: BOUTON }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/connexion" && u.search === "");
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    expect(await temoin(page)).toBe("present");
    expect(documents).toEqual([]);
  });

  test("CA24, CA22 : connexion avec une adresse en majuscules, arrivée sur le tableau de bord, cookie sûr", async ({
    page,
    browser,
  }) => {
    const compte = await creerCompte(browser, { email: adresseUnique("prenom") });
    await ouvrirConnexion(page);
    const saisie = ` ${compte.email.toUpperCase()} `;
    await remplirEtSeConnecter(page, saisie, compte.motDePasse);
    await expect(page).toHaveURL((u) => u.pathname + u.search === "/tableau-de-bord");
    await expect(page.getByText(`Connecté en tant que ${compte.email}`)).toBeVisible();

    const cookie = await cookieDeSession(page);
    expect(cookie, "cookie de session").toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(["Lax", "Strict"]).toContain(cookie!.sameSite);
    const jours = (cookie!.expires - Date.now() / 1000) / 86_400;
    expect(jours).toBeGreaterThan(59);
    expect(jours).toBeLessThan(61);
    expect(decodeURIComponent(cookie!.value)).not.toContain("@");
    expect(await page.evaluate(() => document.cookie)).toBe("");
  });

  test("CA25 : adresse inconnue, mot de passe faux, adresse mal formée ou mot de passe démesuré donnent la même réponse E7", async ({
    page,
    browser,
    request,
  }) => {
    const compte = await creerCompte(browser);
    const cas = [
      { nom: "mot de passe faux", email: compte.email, mdp: "Mauvais-mot-de-passe-1" },
      { nom: "adresse inconnue", email: adresseUnique("inconnue"), mdp: MOT_DE_PASSE },
      { nom: "adresse mal formée", email: "marie@exemple", mdp: "quelconque" },
      { nom: "mot de passe démesuré", email: compte.email, mdp: "x".repeat(5000) },
    ];
    const signatures: unknown[] = [];
    for (const c of cas) {
      await ouvrirConnexion(page);
      await remplirEtSeConnecter(page, c.email, c.mdp);
      const alerte = page.locator("form").getByRole("alert");
      await expect(alerte, c.nom).toHaveText(E7);
      await expect(page, c.nom).toHaveURL((u) => u.pathname + u.search === "/connexion");
      await expect(alerte).toHaveCount(1);
      await expect(alerte, c.nom).toBeFocused();
      await expect(alerte).toHaveCSS("color", ROUGE_TEXTE);
      // Aucun message sous les champs, aucun champ marqué en erreur.
      await expect(page.locator("form [aria-invalid=true]")).toHaveCount(0);
      await expect(page.getByText(E1)).toHaveCount(0);
      await expect(page.getByText(E4)).toHaveCount(0);
      // L'adresse est conservée telle que saisie, le mot de passe est vidé.
      await expect(champEmail(page), c.nom).toHaveValue(c.email);
      await expect(champMotDePasse(page), c.nom).toHaveValue("");
      expect(await cookieDeSession(page), c.nom).toBeUndefined();
      const boite = (await alerte.boundingBox())!;
      signatures.push({
        texte: await alerte.innerText(),
        role: await alerte.getAttribute("role"),
        y: Math.round(boite.y),
        hauteur: Math.round(boite.height),
      });
      const protegee = await request.get("/tableau-de-bord", { maxRedirects: 0 });
      expect(protegee.status()).toBe(307);
    }
    for (const s of signatures) expect(s).toEqual(signatures[0]);

    // Même réponse HTTP : statut, en-têtes, contenu de la page (hors données internes de Next).
    await ouvrirConnexion(page);
    const cachés = await champsCaches(page);
    const reponses = [];
    for (const c of cas) {
      const r = await request.post("/connexion", {
        maxRedirects: 0,
        multipart: { ...cachés, email: c.email, password: c.mdp },
      });
      const corps = await r.text();
      reponses.push({
        nom: c.nom,
        statut: r.status(),
        entetes: Object.keys(r.headers())
          .filter((n) => !["date", "content-length", "etag"].includes(n))
          .sort(),
        cookies: r.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").length,
        page: (/<main[\s\S]*<\/main>/.exec(corps)?.[0] ?? "").split(c.email).join("EMAIL"),
        mdpRenvoye: corps.includes(c.mdp) && c.mdp.length > 12,
      });
    }
    for (const r of reponses) {
      expect(r.statut, r.nom).toBe(reponses[0].statut);
      expect(r.entetes, r.nom).toEqual(reponses[0].entetes);
      expect(r.cookies, r.nom).toBe(0);
      expect(r.page, r.nom).toContain(E7);
      expect(r.page, r.nom).toBe(reponses[0].page);
      expect(r.mdpRenvoye, r.nom).toBe(false);
    }

    // Formulaire vide : E1 et E4 sous les champs, pas de message de formulaire.
    await ouvrirConnexion(page);
    await envoyer(page);
    await expect(page.getByText(E1)).toBeVisible();
    await expect(page.getByText(E4)).toBeVisible();
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
    await expect(champEmail(page)).toBeFocused();
    await expect(champEmail(page)).toHaveAttribute("aria-invalid", "true");
    await expect(champMotDePasse(page)).toHaveAttribute("aria-invalid", "true");
    await expect(champEmail(page)).toHaveAccessibleDescription(E1);
    await expect(champMotDePasse(page)).toHaveAccessibleDescription(E4);
    await expect(page.getByText(E1)).toHaveCSS("color", ROUGE_TEXTE);
    // Adresse seule : E4 seul, focus sur le mot de passe.
    await champEmail(page).fill(compte.email);
    await envoyer(page);
    await expect(page.getByText(E1)).toHaveCount(0);
    await expect(page.getByText(E4)).toBeVisible();
    await expect(champMotDePasse(page)).toBeFocused();
    await expect(champEmail(page)).toHaveValue(compte.email);
  });

  test("CA26 : retour vers la page demandée, après un refus et avec une chaîne de requête", async ({
    page,
    browser,
  }) => {
    const compte = await creerCompte(browser);
    // CA17 : un visiteur qui demande la page protégée arrive sur le formulaire de connexion.
    await page.goto("/tableau-de-bord?exemple=1");
    await expect(page).toHaveURL((u) => u.pathname + u.search === RETOUR);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await expect(page.getByRole("button", { name: BOUTON })).toBeVisible();
    await expect(page.getByText("Connecté en tant que")).toHaveCount(0);

    await ouvrirConnexion(page, RETOUR);
    // Premier essai refusé : l'adresse de la page, donc `retour`, est conservée.
    await remplirEtSeConnecter(page, compte.email, "Mauvais-mot-de-passe-1");
    await expect(page.locator("form").getByRole("alert")).toHaveText(E7);
    await expect(page).toHaveURL((u) => u.pathname + u.search === RETOUR);
    // Second essai réussi : arrivée sur la page demandée, paramètre compris.
    await remplirEtSeConnecter(page, compte.email, compte.motDePasse);
    await expect(page).toHaveURL((u) => u.pathname + u.search === "/tableau-de-bord?exemple=1");
    await expect(page.getByText(`Connecté en tant que ${compte.email}`)).toBeVisible();

    // Une destination sûre avec ancre : chemin et ancre conservés.
    await deconnecter(page);
    await ouvrirConnexion(page, "/connexion?retour=%2Ftableau-de-bord%3Fa%3D1%26b%3D2%23fin");
    await remplirEtSeConnecter(page, compte.email, compte.motDePasse);
    await expect(page).toHaveURL((u) => u.pathname + u.search === "/tableau-de-bord?a=1&b=2");
  });

  test("CA26, R14 : une valeur hostile de retour ne mène jamais hors de l'application", async ({
    page,
    context,
    browser,
  }) => {
    const compte = await creerCompte(browser);
    const hotes = new Set<string>();
    page.on("request", (r) => hotes.add(new URL(r.url()).host));
    const hostiles = [
      "https%3A%2F%2Fexemple.test",
      "%2F%2Fexemple.test",
      "%2F%2F%2Fexemple.test",
      "%2F%5Cexemple.test",
      "%5C%2Fexemple.test",
      "javascript%3Aalert(1)",
      "%2F%09%2Fexemple.test",
      "%252F%252Fexemple.test",
      "%2Fconnexion",
      "%2Fconnexion%3Fretour%3D%2Fx",
      "%2Finscription",
      "tableau-de-bord",
      "",
      // Valeur répétée : aucune des deux n'est retenue.
      "%2Ftableau-de-bord%3Fa%3D1&retour=%2Ftableau-de-bord%3Fb%3D2",
    ];
    for (const valeur of hostiles) {
      await context.clearCookies();
      await ouvrirConnexion(page, `/connexion?retour=${valeur}`);
      await remplirEtSeConnecter(page, compte.email, compte.motDePasse);
      await expect(page, valeur).toHaveURL((u) => u.pathname + u.search === "/tableau-de-bord");
      await expect(page.getByText(`Connecté en tant que ${compte.email}`)).toBeVisible();
    }
    expect([...hotes].filter((h) => h !== new URL(page.url()).host)).toEqual([]);
  });

  // Redirection ouverte (recette T4, corrigée) : ces valeurs passaient la première règle de
  // R14. Le routeur client de Next normalisait « /./ » et « /a/../ » en « //exemple.test »,
  // une adresse relative au protocole, et le navigateur quittait l'application. La
  // destination doit être canonique (R14, précision après la recette de T4).
  test("CA26, R14 : segments « . » et « .. », « // » au milieu, encodages et caractères larges ne mènent jamais hors de l'application", async ({
    page,
    context,
    browser,
  }) => {
    const compte = await creerCompte(browser);
    const hotes = new Set<string>();
    page.on("request", (r) => hotes.add(new URL(r.url()).host));
    const origine = "http://localhost:3100";
    const arrivee = () => {
      const u = page.url();
      return u.startsWith(`${origine}/`) ? u.slice(origine.length) : `HORS DE L'APPLICATION : ${u}`;
    };
    const longue = `/${"a/".repeat(300)}..//exemple.test`;
    // Refusées : on arrive sur /tableau-de-bord.
    const refusees = [
      "/.//exemple.test",
      "/a/..//exemple.test",
      "/%2e//exemple.test",
      "/%2e%2e//exemple.test",
      "/%2E//exemple.test",
      "/.%2e//exemple.test",
      "/a//exemple.test",
      "/;//exemple.test",
      "/..;//exemple.test",
      "/%252e//exemple.test",
      "/%2f/exemple.test",
      "/%5cexemple.test",
      "/tableau-de-bord/..//exemple.test",
      "\uFF0F\uFF0Fexemple.test",
      "/\t/exemple.test",
      longue,
    ];
    // Acceptées : l'arrivée reste sur l'origine, à l'adresse que le navigateur normalise.
    const acceptees: [string, string | null][] = [
      ["/@exemple.test", "/@exemple.test"],
      ["/tableau-de-bord?x=//exemple.test", "/tableau-de-bord?x=//exemple.test"],
      ["/tableau-de-bord#//exemple.test", "/tableau-de-bord#//exemple.test"],
      ["/é", "/%C3%A9"],
      ["/tableau-de-bord?é=1", "/tableau-de-bord?%C3%A9=1"],
      // Le routeur client de Next ramène ces deux-là sur « / » ; sans JavaScript elles restent
      // telles quelles : seule la sortie de l'origine compte.
      ["/;/exemple.test", null],
      ["/..;/exemple.test", null],
    ];
    const cas: [string, string | null][] = [
      ...refusees.map((v): [string, string | null] => [v, "/tableau-de-bord"]),
      ...acceptees,
    ];
    for (const [valeur, attendu] of cas) {
      await context.clearCookies();
      await ouvrirConnexion(page, `/connexion?retour=${encodeURIComponent(valeur)}`);
      await remplirEtSeConnecter(page, compte.email, compte.motDePasse);
      // On attend que la navigation ait quitté /connexion, puis on regarde où elle est allée.
      await expect.poll(() => page.url(), valeur.slice(0, 40)).not.toContain("/connexion");
      const etiquette = `${valeur.slice(0, 40)} → ${arrivee()}`;
      expect(arrivee().startsWith("HORS"), etiquette).toBe(false);
      if (attendu !== null) await expect.poll(arrivee, etiquette).toBe(attendu);
    }
    expect([...hotes].filter((h) => h !== "localhost:3100")).toEqual([]);
  });

  test("R14 : l'en-tête Referer et les champs du formulaire ne choisissent pas la destination hors règle", async ({
    page,
    browser,
    request,
  }) => {
    const compte = await creerCompte(browser);
    await ouvrirConnexion(page);
    const cachés = await champsCaches(page);
    const origine = new URL(page.url()).origin;
    const connexion = async (referer: string | undefined, extra: Record<string, string> = {}) => {
      const r = await request.post("/connexion", {
        maxRedirects: 0,
        headers: referer === undefined ? {} : { Referer: referer },
        multipart: { ...cachés, email: compte.email, password: compte.motDePasse, ...extra },
      });
      return { statut: r.status(), lieu: r.headers()["location"] };
    };
    const retour = (v: string) => `${origine}/connexion?retour=${encodeURIComponent(v)}`;
    const cas: [string, string | undefined, Record<string, string>, string][] = [
      ["sans Referer", undefined, {}, "/tableau-de-bord"],
      ["Referer sûr", retour("/tableau-de-bord?x=1"), {}, "/tableau-de-bord?x=1"],
      ["Referer absolu", retour("https://exemple.test"), {}, "/tableau-de-bord"],
      ["Referer //", retour("//exemple.test"), {}, "/tableau-de-bord"],
      ["Referer illisible", "pas une adresse", {}, "/tableau-de-bord"],
      ["Referer d'une autre page", `${origine}/inscription?retour=%2Fa`, {}, "/tableau-de-bord"],
      ["Referer d'un autre site", "https://exemple.test/connexion?retour=%2Fa", {}, "/a"],
      [
        "Referer avec identifiants",
        `${origine.replace("://", "://x@")}/connexion?retour=%2Fa`,
        {},
        "/a",
      ],
      ["champ retour ajouté à la main", `${origine}/connexion`, { retour: "https://exemple.test" }, "/tableau-de-bord"],
      ["champ retour // ajouté", retour("/a"), { retour: "//exemple.test" }, "/a"],
    ];
    for (const [nom, referer, extra, attendu] of cas) {
      const r = await connexion(referer, extra);
      expect(r.statut, nom).toBe(303);
      expect(r.lieu, nom).toBe(attendu);
    }
  });

  test("CA27 : un propriétaire connecté n'atteint ni /connexion ni /inscription", async ({
    page,
    request,
  }) => {
    const { email } = await inscrire(page);
    const entete = await enteteCookie(page);
    for (const chemin of [
      "/connexion",
      RETOUR,
      "/connexion?retour=https%3A%2F%2Fexemple.test",
      "/connexion?retour=%2F%2Fexemple.test",
      "/inscription",
    ]) {
      // Réponse HTTP : une redirection, sans le formulaire.
      const brut = await request.get(chemin, { headers: { Cookie: entete }, maxRedirects: 0 });
      expect(brut.status(), chemin).toBe(307);
      expect(brut.headers().location, chemin).toBe("/tableau-de-bord");
      expect(await brut.text(), chemin).not.toContain("<form");
      // Dans le navigateur.
      await page.goto(chemin);
      await expect(page, chemin).toHaveURL((u) => u.pathname + u.search === "/tableau-de-bord");
      await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
      await expect(page.locator("input:not([type=hidden])")).toHaveCount(0);
    }
  });

  test("CA13 : après le refus E3, le compte existant se connecte avec son mot de passe d'origine seulement", async ({
    page,
    browser,
  }) => {
    const compte = await creerCompte(browser);
    await ouvrirInscription(page);
    await remplirEtEnvoyer(page, compte.email.toUpperCase(), "AutreMotDePasse-99");
    await expect(page.getByText(E3)).toBeVisible();
    await page.goto("/connexion");
    await ouvrirConnexion(page);
    await remplirEtSeConnecter(page, compte.email, "AutreMotDePasse-99");
    await expect(page.locator("form").getByRole("alert")).toHaveText(E7);
    await remplirEtSeConnecter(page, compte.email, compte.motDePasse);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByText(`Connecté en tant que ${compte.email}`)).toBeVisible();
  });

  test("CA15 : Afficher / Masquer le mot de passe sur la connexion, sans envoyer le formulaire", async ({
    page,
  }) => {
    await ouvrirConnexion(page);
    const mdp = champMotDePasse(page);
    await mdp.fill("UneSaisie-longue");
    let envois = 0;
    page.on("request", (r) => {
      if (r.method() === "POST") envois += 1;
    });
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await expect(mdp).toHaveAttribute("type", "text");
    await expect(mdp).toHaveValue("UneSaisie-longue");
    await page.getByRole("button", { name: "Masquer le mot de passe" }).click();
    await expect(mdp).toHaveAttribute("type", "password");
    await expect(mdp).toHaveValue("UneSaisie-longue");
    expect(envois).toBe(0);
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("R28 : double activation de « Se connecter », attente, une seule session", async ({
    page,
    browser,
  }) => {
    const compte = await creerCompte(browser);
    await page.route("**/connexion", async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    let envois = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/connexion")) envois += 1;
    });
    await ouvrirConnexion(page);
    await champEmail(page).fill(compte.email);
    await champMotDePasse(page).fill(compte.motDePasse);
    await page.getByRole("button", { name: BOUTON }).dblclick();
    await expect(page.getByRole("button", { name: "Connexion en cours" })).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Connexion en cours");
    await expect(champEmail(page)).toHaveValue(compte.email);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    expect(envois).toBe(1);
    expect(await nombreDeSessions(compte.email)).toBe(1);
  });
});

test.describe("Connexion : session précédente (R3), fixation de session", () => {
  test("R3 : onglet resté sur /connexion, connexion ailleurs, puis envoi : l'ancienne session est fermée", async ({
    page,
    context,
    browser,
    request,
  }) => {
    const compte = await creerCompte(browser);
    // Premier onglet : formulaire de connexion affiché, visiteur non connecté.
    await ouvrirConnexion(page);
    // Second onglet du même navigateur : connexion.
    const onglet = await context.newPage();
    await connecter(onglet, compte);
    const ancien = await enteteCookie(onglet);
    expect(await statutTableauDeBord(request, ancien)).toBe(200);
    expect(await nombreDeSessions(compte.email)).toBe(1);

    // Une session du même compte, dans un autre navigateur : elle ne doit pas être touchée.
    const autreNavigateur = await browser.newContext();
    try {
      const autrePage = await autreNavigateur.newPage();
      await connecter(autrePage, compte);
      const ailleurs = await enteteCookie(autrePage);
      expect(await nombreDeSessions(compte.email)).toBe(2);

      // Envoi du formulaire resté ouvert dans le premier onglet.
      await remplirEtSeConnecter(page, compte.email, compte.motDePasse);
      await expect(page).toHaveURL(/\/tableau-de-bord$/);
      const nouveau = await enteteCookie(page);
      expect(nouveau).not.toBe(ancien);
      expect(await statutTableauDeBord(request, ancien), "ancienne session refusée").toBe(307);
      expect(await statutTableauDeBord(request, nouveau), "nouvelle session valable").toBe(200);
      expect(await statutTableauDeBord(request, ailleurs), "autre navigateur épargné").toBe(200);
      expect(await nombreDeSessions(compte.email)).toBe(2);
    } finally {
      await autreNavigateur.close();
    }
  });

  test("R3 : connexion à un autre compte dans un navigateur déjà connecté, l'ancien compte est déconnecté", async ({
    page,
    context,
    browser,
    request,
  }) => {
    const [a, b] = [await creerCompte(browser), await creerCompte(browser)];
    await ouvrirConnexion(page);
    const onglet = await context.newPage();
    await connecter(onglet, a);
    const ancien = await enteteCookie(onglet);

    await remplirEtSeConnecter(page, b.email, b.motDePasse);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByText(`Connecté en tant que ${b.email}`)).toBeVisible();
    expect(await statutTableauDeBord(request, ancien)).toBe(307);
    expect(await statutTableauDeBord(request, await enteteCookie(page))).toBe(200);
    expect(await nombreDeSessions(a.email)).toBe(0);
    expect(await nombreDeSessions(b.email)).toBe(1);
  });

  test("R3 : une connexion refusée avec une session en cours ne ferme rien", async ({
    page,
    context,
    browser,
    request,
  }) => {
    const compte = await creerCompte(browser);
    await ouvrirConnexion(page);
    const onglet = await context.newPage();
    await connecter(onglet, compte);
    const entete = await enteteCookie(onglet);
    const expiration = await expirationSession(compte.email);

    await remplirEtSeConnecter(page, compte.email, "Mauvais-mot-de-passe-1");
    await expect(page.locator("form").getByRole("alert")).toHaveText(E7);
    await remplirEtSeConnecter(page, "inconnue-" + compte.email, compte.motDePasse);
    await expect(page.locator("form").getByRole("alert")).toHaveText(E7);
    expect(await statutTableauDeBord(request, entete)).toBe(200);
    expect(await nombreDeSessions(compte.email)).toBe(1);
    expect(await expirationSession(compte.email)).toBe(expiration);
    expect((await cookieDeSession(page))?.value).toBe(entete.slice(entete.indexOf("=") + 1));
  });

  test("Fixation de session : un cookie posé avant la connexion ne devient pas la session", async ({
    page,
    context,
    browser,
    request,
  }) => {
    const compte = await creerCompte(browser);
    await ouvrirConnexion(page);
    await context.addCookies([
      { name: "better-auth.session_token", value: "jeton-de-l-attaquant.abc", url: page.url() },
    ]);
    await remplirEtSeConnecter(page, compte.email, compte.motDePasse);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    const cookie = await cookieDeSession(page);
    expect(cookie!.value).not.toContain("jeton-de-l-attaquant");
    expect(
      await statutTableauDeBord(request, "better-auth.session_token=jeton-de-l-attaquant.abc"),
    ).toBe(307);
  });
});

test.describe("Connexion : aucun mot de passe dans le document", () => {
  test("R21 : après une connexion par navigation côté client, ni le document ni les champs ne contiennent le mot de passe", async ({
    page,
    browser,
  }) => {
    const motDePasse = "Residu-Unique-7391-zqpl";
    const compte = await creerCompte(browser, { motDePasse });
    const requetes: string[] = [];
    page.on("request", (r) => requetes.push(r.url()));

    // Cas le plus exposé : le mot de passe est affiché en clair dans le champ au moment de l'envoi.
    await ouvrirConnexion(page);
    await champMotDePasse(page).fill(motDePasse);
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await champEmail(page).fill(compte.email);
    await pose(page);
    await page.getByRole("button", { name: BOUTON }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    // Navigation côté client : le document n'a pas été rechargé.
    expect(await temoin(page)).toBe("present");

    const residus = () =>
      page.evaluate((secret) => {
        const trouves: string[] = [];
        if (document.documentElement.outerHTML.includes(secret)) trouves.push("outerHTML");
        if ((document.body.textContent ?? "").includes(secret)) trouves.push("texte");
        for (const champ of document.querySelectorAll("input, textarea")) {
          if ((champ as HTMLInputElement).value.includes(secret)) trouves.push("champ");
        }
        if (JSON.stringify({ ...localStorage, ...sessionStorage }).includes(secret)) {
          trouves.push("stockage");
        }
        if (location.href.includes(secret) || document.referrer.includes(secret)) {
          trouves.push("adresse");
        }
        return trouves;
      }, motDePasse);
    // État stable : on regarde plusieurs fois, après la transition.
    await expect.poll(residus).toEqual([]);
    await page.getByRole("link", { name: "Quittances, tableau de bord" }).click();
    await expect.poll(residus).toEqual([]);

    // Précédent : ni le formulaire d'origine rempli, ni le mot de passe.
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(residus).toEqual([]);
    expect(requetes.filter((u) => u.includes(motDePasse) || u.includes("Residu"))).toEqual([]);
  });
});

test.describe("Connexion : accessibilité, mise en page, console", () => {
  test("CA30 : axe sans violation à l'état vide, en E1 et E4, puis en E7", async ({
    page,
    browser,
  }) => {
    const compte = await creerCompte(browser);
    const analyser = () =>
      new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    await ouvrirConnexion(page);
    expect((await analyser()).violations).toEqual([]);
    await envoyer(page);
    await expect(page.getByText(E1)).toBeVisible();
    expect((await analyser()).violations).toEqual([]);
    await champEmail(page).fill(compte.email);
    await champMotDePasse(page).fill("Mauvais-mot-de-passe-1");
    await envoyer(page);
    await expect(page.locator("form").getByRole("alert")).toHaveText(E7);
    expect((await analyser()).violations).toEqual([]);
  });

  test("CA32 : au clavier seul, ordre de tabulation, focus visible, connexion par Entrée", async ({
    page,
    browser,
  }) => {
    const compte = await creerCompte(browser);
    await ouvrirConnexion(page);
    const attendu = [
      "Quittances, accueil",
      "Adresse e-mail",
      "Mot de passe",
      "Afficher le mot de passe",
      BOUTON,
      "Créer un compte",
    ];
    for (const nom of attendu) {
      await page.keyboard.press("Tab");
      const arret = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement;
        const c = getComputedStyle(e);
        const label = (e as HTMLInputElement).labels?.[0]?.textContent;
        return {
          nom: e.getAttribute("aria-label") ?? label ?? e.textContent?.trim() ?? "",
          contour: c.outlineStyle === "solid" && parseFloat(c.outlineWidth) >= 2,
          bordure: c.borderTopColor,
          anneau: c.boxShadow.includes("0.12"),
        };
      });
      expect(arret.nom).toBe(nom);
      if (nom === "Adresse e-mail" || nom === "Mot de passe") {
        expect(arret.bordure).toBe("rgb(79, 70, 229)");
        expect(arret.anneau).toBe(true);
      } else {
        expect(arret.contour, `contour de « ${nom} »`).toBe(true);
      }
    }
    // Parcours complet au clavier : saisie puis Entrée dans le champ du mot de passe.
    await champEmail(page).focus();
    await page.keyboard.type(compte.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type("Mauvais-mot-de-passe-1");
    await page.keyboard.press("Enter");
    await expect(page.locator("form").getByRole("alert")).toBeFocused();
    await expect(page.locator("form").getByRole("alert")).toHaveText(E7);
    await page.keyboard.press("Tab");
    await expect(champEmail(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.type(compte.motDePasse);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    // Après la soumission réussie, la première tabulation atteint le logo (R27).
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Quittances, tableau de bord" })).toBeFocused();
  });

  test("Mise en page de /connexion de 320 à 1280px : carte, champs, bouton, aucun débordement", async ({
    page,
  }) => {
    for (const largeur of [320, 412, 768, 1280, 1920]) {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirConnexion(page);
      const mesures = await page.evaluate(() => {
        const carte = document.querySelector("main > div")!.getBoundingClientRect();
        const h1 = document.querySelector("h1")!.getBoundingClientRect();
        return {
          defilement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          carteX: carte.x,
          carteLargeur: carte.width,
          h1DansCarte: h1.x >= carte.x && h1.right <= carte.right,
        };
      });
      expect(mesures.defilement, `défilement horizontal à ${largeur}px`).toBeLessThanOrEqual(0);
      expect(mesures.carteLargeur).toBeLessThanOrEqual(400);
      expect(mesures.carteLargeur).toBeLessThanOrEqual(largeur - 48);
      expect(mesures.carteX).toBeCloseTo((largeur - mesures.carteLargeur) / 2, 0);
      expect(mesures.h1DansCarte).toBe(true);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
        "font-size",
        largeur >= 768 ? "32px" : "24px",
      );
      const bouton = page.getByRole("button", { name: BOUTON });
      await expect(bouton).toHaveCSS("background-color", "rgb(79, 70, 229)");
      const [b, c] = [(await bouton.boundingBox())!, (await champEmail(page).boundingBox())!];
      expect(b.height).toBe(44);
      expect(b.width).toBeCloseTo(c.width, 0);
    }
    // Messages et adresse très longs : pas de débordement non plus.
    await page.setViewportSize({ width: 320, height: 900 });
    await ouvrirConnexion(page);
    await remplirEtSeConnecter(page, `${"a".repeat(120)}@${"b".repeat(100)}.test`, "x");
    await expect(page.locator("form").getByRole("alert")).toHaveText(E7);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });

  test("CA32 : console vide sur les parcours 1 à 4, erreurs comprises", async ({ page, browser }) => {
    const messages: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") {
        messages.push(`${m.type()}: ${m.text()} (${m.location().url})`);
      }
    });
    page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
    const compte = await creerCompte(browser);

    // Parcours 4 puis 2 : page protégée demandée, erreurs de connexion, retour.
    await page.goto("/tableau-de-bord?exemple=1");
    await expect(page).toHaveURL((u) => u.pathname + u.search === RETOUR);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await ouvrirConnexion(page, RETOUR);
    await envoyer(page);
    await expect(page.getByText(E1)).toBeVisible();
    await remplirEtSeConnecter(page, compte.email, "Mauvais-mot-de-passe-1");
    await expect(page.locator("form").getByRole("alert")).toHaveText(E7);
    await page.getByRole("link", { name: "Créer un compte" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Créer un compte" })).toBeVisible();
    await page.getByRole("link", { name: BOUTON }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await remplirEtSeConnecter(page, compte.email, compte.motDePasse);
    await expect(page).toHaveURL((u) => u.pathname + u.search === "/tableau-de-bord");

    // Parcours 3 : déconnexion, puis Précédent.
    await deconnecter(page);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Parcours 1 : inscription avec erreurs, puis réussie ; déjà connecté sur /inscription.
    await page.context().clearCookies();
    await ouvrirInscription(page);
    await remplirEtEnvoyer(page, "marie@exemple", "court");
    await expect(page.getByText("Le mot de passe doit contenir au moins 12 caractères.")).toBeVisible();
    await inscrire(page);
    await page.goto("/inscription");
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await page.goto("/connexion");
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    expect(messages).toEqual([]);
  });
});

test.describe("Parcours complet", () => {
  test("Parcours 1 à 4 de bout en bout : inscription, déconnexion, page protégée, connexion, retour, déconnexion", async ({
    page,
  }) => {
    // 1. Inscription : arrivée connectée.
    const { email, motDePasse } = await inscrire(page);
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
    // 3. Déconnexion : /connexion, formulaire vide, sans message.
    await deconnecter(page);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await expect(champEmail(page)).toHaveValue("");
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
    // 4. Page protégée demandée sans session.
    await page.goto("/tableau-de-bord?exemple=1");
    await expect(page).toHaveURL((u) => u.pathname + u.search === RETOUR);
    // 2. Connexion : arrivée sur la page demandée.
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await remplirEtSeConnecter(page, email, motDePasse);
    await expect(page).toHaveURL((u) => u.pathname + u.search === "/tableau-de-bord?exemple=1");
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
    // Recharger : toujours connecté (R16).
    await page.reload();
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
    // 3. Déconnexion finale : session supprimée, Précédent sans contenu protégé.
    await deconnecter(page);
    expect(await nombreDeSessions(email)).toBe(0);
    await page.goBack();
    expect(await page.content()).not.toContain(email);
    await expect(page.getByText("Connecté en tant que")).toHaveCount(0);
  });
});

test.describe("Connexion sans JavaScript (CA28, R29)", () => {
  test.use({ javaScriptEnabled: false });

  test("inscription vide, inscription, déconnexion, connexion refusée puis réussie, retour, déjà connecté", async ({
    page,
  }) => {
    const email = adresseUnique("nojs-t4");
    const urls = new Set<string>();
    page.on("request", (r) => urls.add(r.url()));

    await page.goto("/inscription");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText(E1)).toBeVisible();
    await expect(page.getByText(E4)).toBeVisible();
    await champEmail(page).fill(email);
    await champMotDePasse(page).fill(MOT_DE_PASSE);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();

    // Déjà connecté : /connexion et /inscription redirigent, sans le formulaire.
    await page.goto(RETOUR);
    await expect(page).toHaveURL((u) => u.pathname + u.search === "/tableau-de-bord");
    await page.goto("/inscription");
    await expect(page).toHaveURL(/\/tableau-de-bord$/);

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/connexion");

    // Connexion vide : E1 et E4, sans message de formulaire.
    await page.getByRole("button", { name: BOUTON }).click();
    await expect(page.getByText(E1)).toBeVisible();
    await expect(page.getByText(E4)).toBeVisible();
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);

    // Page protégée demandée, puis connexion refusée : E7, adresse conservée, mot de passe vidé.
    await page.goto("/tableau-de-bord?exemple=1");
    await expect(page).toHaveURL((u) => u.pathname + u.search === RETOUR);
    await champEmail(page).fill(email);
    await champMotDePasse(page).fill("Mauvais-mot-de-passe-1");
    await page.getByRole("button", { name: BOUTON }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(E7);
    await expect(champEmail(page)).toHaveValue(email);
    await expect(champMotDePasse(page)).toHaveValue("");
    await expect(page.getByText(E1)).toHaveCount(0);

    // Bon mot de passe : arrivée sur la page demandée, y compris après le refus.
    await champMotDePasse(page).fill(MOT_DE_PASSE);
    await page.getByRole("button", { name: BOUTON }).click();
    await expect(page).toHaveURL((u) => u.pathname + u.search === "/tableau-de-bord?exemple=1");
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();

    // À aucune étape le mot de passe n'apparaît dans une adresse.
    expect([...urls].filter((u) => u.includes(MOT_DE_PASSE) || u.includes("Mauvais"))).toEqual([]);
  });
});
