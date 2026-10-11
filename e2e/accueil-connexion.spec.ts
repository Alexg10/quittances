import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  adresseUnique,
  champEmail,
  champMotDePasse,
  cookieDeSession,
  creerCompte,
  deconnecter,
  enteteCookie,
  inscrire,
  MOT_DE_PASSE,
  nombreDeSessions,
  ouvrirConnexion,
  ouvrirInscription,
  remplirEtEnvoyer,
  remplirEtSeConnecter,
  reculerSession,
} from "./aide-comptes";

// Page d'accueil, modifications de la spec 02 (T5) : CA33 à CA35 de la spec 02, R38, R39,
// parcours 5. Les « CA33 à CA35 » cités ici sont ceux de la spec 02 (les tests historiques
// de la spec 01 sont dans accueil-contenu.spec.ts et accueil-entete.spec.ts).

const CREER = "Créer mon compte";
const CONNEXION = "Se connecter";

async function ouvrir(page: Page, largeur?: number) {
  if (largeur) await page.setViewportSize({ width: largeur, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** Un `Link` de next/link est hydraté quand React a posé ses propriétés sur l'élément. */
async function lienHydrate(page: Page, nom: string) {
  const lien = page.getByRole("link", { name: nom, exact: true });
  await expect
    .poll(() => lien.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))))
    .toBe(true);
  return lien;
}

const pose = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __temoin: string }).__temoin = "present";
  });
const temoin = (page: Page) =>
  page.evaluate(() => (window as unknown as { __temoin?: string }).__temoin);

/** Noms des liens de la page dans l'ordre du document, avec leur adresse. */
const liens = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("a")].map((a) => [
      a.getAttribute("aria-label") ?? a.textContent?.trim(),
      a.getAttribute("href"),
    ]),
  );

test.describe("Accueil : contenu et liens (CA33)", () => {
  test("CA33 : deux h2, liens dans l'ordre, « Se connecter » dans l'en-tête hors navigation, aucun bouton ni champ", async ({
    page,
  }) => {
    await ouvrir(page);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Comment ça marche",
      "Ce que fait Quittances",
    ]);
    await expect(page.locator("#inscriptions")).toHaveCount(0);
    for (const absent of [
      "Voir comment ça marche",
      "Les inscriptions ouvrent bientôt",
      "La création de compte n'est pas encore disponible.",
    ]) {
      await expect(page.getByText(absent)).toHaveCount(0);
    }
    expect(await liens(page)).toEqual([
      ["Aller au contenu", "#contenu"],
      ["Quittances, accueil", "/"],
      ["Fonctionnement", "#fonctionnement"],
      ["Fonctionnalités", "#fonctionnalites"],
      [CONNEXION, "/connexion"],
      [CREER, "/inscription"],
    ]);
    // « Se connecter » : dans le repère banner, hors de « Navigation principale ».
    await expect(page.getByRole("banner").getByRole("link", { name: CONNEXION })).toHaveCount(1);
    // Sous 768px la navigation est masquée : on compte dans le DOM, pas dans l'arbre d'accessibilité.
    const nav = page.locator('nav[aria-label="Navigation principale"]');
    await expect(nav).toHaveCount(1);
    await expect(nav.locator("a")).toHaveText(["Fonctionnement", "Fonctionnalités"]);
    await expect(nav.locator("a", { hasText: CONNEXION })).toHaveCount(0);
    // Le bouton d'appel à l'action est dans le contenu, pas dans l'en-tête.
    await expect(page.getByRole("main").getByRole("link", { name: CREER })).toHaveCount(1);
    // Toujours aucun button, form ni champ.
    await expect(page.locator("button, form, input, textarea, select")).toHaveCount(0);
  });

  test("CA33, R26, DESIGN : « Se connecter » est un bouton secondaire, « Créer mon compte » le seul bouton primaire", async ({
    page,
  }) => {
    await ouvrir(page);
    const connexion = page.getByRole("link", { name: CONNEXION });
    await expect(connexion).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(connexion).toHaveCSS("border-top-color", "rgb(232, 232, 236)");
    await expect(connexion).toHaveCSS("border-top-width", "1px");
    await expect(connexion).toHaveCSS("border-top-left-radius", "6px");
    await expect(connexion).toHaveCSS("font-size", "14px");
    expect((await connexion.boundingBox())!.height).toBe(32);
    const creer = page.getByRole("link", { name: CREER });
    await expect(creer).toHaveCSS("background-color", "rgb(79, 70, 229)");
    expect((await creer.boundingBox())!.height).toBe(44);
    const fonds = await page.evaluate(
      () =>
        [...document.querySelectorAll("body *")].filter(
          (e) => getComputedStyle(e).backgroundColor === "rgb(79, 70, 229)",
        ).length,
    );
    expect(fonds).toBe(1);
  });
});

test.describe("Accueil : en-tête, tabulation, liens sans rechargement (CA34)", () => {
  for (const largeur of [320, 1280]) {
    test(`CA34 : à ${largeur}px, « Se connecter » visible, sans chevauchement du logo, ordre de tabulation du parcours 5`, async ({
      page,
    }) => {
      await ouvrir(page, largeur);
      const connexion = page.getByRole("link", { name: CONNEXION });
      await expect(connexion).toBeVisible();
      await expect(connexion).toBeInViewport({ ratio: 1 });
      const [logo, bouton] = [
        (await page.getByRole("link", { name: "Quittances, accueil" }).boundingBox())!,
        (await connexion.boundingBox())!,
      ];
      expect(logo.x + logo.width, "le logo ne chevauche pas « Se connecter »").toBeLessThanOrEqual(
        bouton.x,
      );
      expect(bouton.x + bouton.width).toBeLessThanOrEqual(largeur);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        `défilement horizontal à ${largeur}px`,
      ).toBeLessThanOrEqual(0);

      const attendu = [
        "Aller au contenu",
        "Quittances, accueil",
        ...(largeur >= 768 ? ["Fonctionnement", "Fonctionnalités"] : []),
        CONNEXION,
        CREER,
      ];
      const vus: string[] = [];
      for (let i = 0; i < attendu.length; i++) {
        await page.keyboard.press("Tab");
        const arret = await page.evaluate(() => {
          const e = document.activeElement as HTMLElement;
          const c = getComputedStyle(e);
          return {
            nom: e.getAttribute("aria-label") ?? e.textContent?.trim() ?? "",
            contour: c.outlineStyle === "solid" && parseFloat(c.outlineWidth) >= 2,
          };
        });
        vus.push(arret.nom);
        expect(arret.contour, `contour de « ${arret.nom} »`).toBe(true);
      }
      expect(vus).toEqual(attendu);
    });
  }

  for (const [nom, adresse, titre] of [
    [CREER, "/inscription", "Créer un compte"],
    [CONNEXION, "/connexion", "Connexion"],
  ] as const) {
    test(`CA34 : « ${nom} » mène à ${adresse} par next/link, sans requête de document`, async ({
      page,
    }) => {
      await ouvrir(page);
      const lien = await lienHydrate(page, nom);
      await expect(lien).toHaveAttribute("href", adresse);
      await pose(page);
      const documents: string[] = [];
      page.on("request", (r) => {
        if (r.resourceType() === "document") documents.push(r.url());
      });
      await lien.click();
      await expect(page).toHaveURL((u) => u.pathname === adresse && u.search === "");
      await expect(page.getByRole("heading", { level: 1, name: titre })).toBeVisible();
      expect(await temoin(page), "le document n'a pas été rechargé").toBe("present");
      expect(documents).toEqual([]);

      // Précédent : retour à l'accueil, toujours sans rechargement du document.
      await page.goBack();
      await expect(page).toHaveURL((u) => u.pathname === "/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("quittances de loyer");
      expect(await temoin(page)).toBe("present");
      expect(documents).toEqual([]);
    });
  }

  test("CA34 : le logo et les ancres fonctionnent encore après un aller-retour vers /inscription", async ({
    page,
    isMobile,
  }) => {
    await ouvrir(page);
    await (await lienHydrate(page, CREER)).click();
    await expect(page.getByRole("heading", { level: 1, name: "Créer un compte" })).toBeVisible();
    await page.getByRole("link", { name: "Quittances, accueil" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("quittances de loyer");
    await pose(page);
    if (!isMobile) {
      await page.getByRole("link", { name: "Fonctionnalités", exact: true }).click();
      await expect(page).toHaveURL(/#fonctionnalites$/);
      await expect(
        page.getByRole("heading", { level: 2, name: "Ce que fait Quittances" }),
      ).toBeInViewport();
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole("link", { name: "Quittances, accueil" }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    expect(await temoin(page)).toBe("present");
  });

  test("CA34, CA30 : axe sans violation sur l'accueil, en-tête avec « Se connecter » compris", async ({
    page,
  }) => {
    await ouvrir(page);
    const analyser = () =>
      new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect((await analyser()).violations).toEqual([]);
    await page.getByRole("link", { name: CONNEXION }).focus();
    expect((await analyser()).violations).toEqual([]);
  });
});

test.describe("Accueil : propriétaire connecté (CA35, R39)", () => {
  test("CA35 : la page est identique à celle d'un visiteur, sans adresse e-mail, et les deux liens mènent au tableau de bord", async ({
    page,
    browser,
  }) => {
    // Le visiteur (contexte neuf) et le propriétaire voient la même page.
    const visiteur = await browser.newContext();
    let htmlVisiteur: string;
    let lienVisiteur: unknown;
    try {
      const p = await visiteur.newPage();
      await ouvrir(p);
      htmlVisiteur = await (await visiteur.request.get("/")).text();
      lienVisiteur = await liens(p);
    } finally {
      await visiteur.close();
    }

    const { email } = await inscrire(page);
    const brut = await page.context().request.get("/");
    const htmlProprietaire = await brut.text();
    expect(brut.status()).toBe(200);
    expect(htmlProprietaire).not.toContain(email);
    expect(htmlProprietaire).not.toContain("Connecté en tant que");
    expect(htmlProprietaire).not.toContain("Se déconnecter");
    // Même document, octet pour octet : la page est pré-rendue.
    expect(htmlProprietaire).toBe(htmlVisiteur);

    await ouvrir(page);
    expect(await liens(page)).toEqual(lienVisiteur);
    expect(await page.content()).not.toContain(email);
    await expect(page.locator("button, form, input")).toHaveCount(0);

    // « Se connecter » puis « Créer mon compte » aboutissent sur /tableau-de-bord.
    for (const nom of [CONNEXION, CREER]) {
      await ouvrir(page);
      await (await lienHydrate(page, nom)).click();
      await expect(page).toHaveURL((u) => u.pathname === "/tableau-de-bord" && u.search === "");
      await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
      await expect(page.locator("input:not([type=hidden])")).toHaveCount(0);
    }
  });

  test("R39 : une visite de / ne pose ni ne prolonge aucun cookie de session, même pour une session à prolonger", async ({
    page,
    request,
  }) => {
    const { email } = await inscrire(page);
    const entete = await enteteCookie(page);
    await reculerSession(email);
    const posesPar = async (chemin: string, headers: Record<string, string>) =>
      (await request.get(chemin, { headers, maxRedirects: 0 }))
        .headersArray()
        .filter((h) => h.name.toLowerCase() === "set-cookie").length;
    // Visiteur, puis propriétaire à session ancienne : jamais de Set-Cookie sur /.
    expect(await posesPar("/", {})).toBe(0);
    expect(await posesPar("/", { Cookie: entete })).toBe(0);
    expect((await request.get("/", { headers: { Cookie: entete } })).headers()["cache-control"]).toMatch(
      /s-maxage|public|max-age=\d/,
    );
    // Navigation dans le navigateur : toujours aucun cookie de session posé par /.
    const avant = await cookieDeSession(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect((await cookieDeSession(page))?.expires).toBe(avant?.expires);
    expect(await nombreDeSessions(email)).toBe(1);
  });

  test("CA35, console : aucune erreur ni avertissement pour un propriétaire connecté (défilement, survol, préchargement)", async ({
    page,
    browser,
  }) => {
    const messages: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") {
        messages.push(`${m.type()}: ${m.text()} (${m.location().url})`);
      }
    });
    page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
    const compte = await creerCompte(browser);
    await ouvrirConnexion(page);
    await remplirEtSeConnecter(page, compte.email, compte.motDePasse);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await ouvrir(page);
    await lienHydrate(page, CONNEXION);
    // Les liens passent dans le viewport (préchargement), sont survolés, puis activés.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("link", { name: CONNEXION }).hover();
    await page.getByRole("link", { name: CREER }).hover();
    await page.getByRole("link", { name: CREER }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await ouvrir(page);
    await page.getByRole("link", { name: CONNEXION }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    expect(messages).toEqual([]);
  });

  test("CA35 : un onglet de l'accueil resté ouvert pendant une déconnexion ailleurs mène ensuite à /connexion", async ({
    page,
    context,
  }) => {
    await inscrire(page);
    const accueil = await context.newPage();
    await ouvrir(accueil);
    await lienHydrate(accueil, CONNEXION);
    // Déconnexion dans le premier onglet.
    await deconnecter(page);
    // Le second onglet affiche encore l'accueil, qui est identique pour tous ; son lien
    // « Se connecter » mène maintenant au formulaire de connexion, sans erreur.
    await accueil.getByRole("link", { name: CONNEXION }).click();
    await expect(accueil).toHaveURL((u) => u.pathname === "/connexion");
    await expect(accueil.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await expect(accueil.getByText("Internal Server Error")).toHaveCount(0);
  });
});

test.describe("Parcours 5 de bout en bout", () => {
  test("accueil, « Créer mon compte », inscription, déconnexion, accueil, « Se connecter », connexion, console vide", async ({
    page,
  }) => {
    const messages: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") messages.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
    const email = adresseUnique("parcours5");

    await ouvrir(page);
    await (await lienHydrate(page, CREER)).click();
    await expect(page.getByRole("heading", { level: 1, name: "Créer un compte" })).toBeVisible();
    await ouvrirInscription(page);
    await remplirEtEnvoyer(page, email, MOT_DE_PASSE);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
    await deconnecter(page);

    // De /connexion, le logo ramène à l'accueil ; « Se connecter » y mène à la connexion.
    await page.getByRole("link", { name: "Quittances, accueil" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/");
    await (await lienHydrate(page, CONNEXION)).click();
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await ouvrirConnexion(page);
    await remplirEtSeConnecter(page, email, MOT_DE_PASSE);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
    expect(messages).toEqual([]);
  });

  test.describe("sans JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("accueil, « Créer mon compte », inscription, déconnexion, accueil, « Se connecter », connexion", async ({
      page,
    }) => {
      const email = adresseUnique("parcours5-nojs");
      await page.goto("/");
      await page.getByRole("link", { name: CREER }).click();
      await expect(page).toHaveURL((u) => u.pathname === "/inscription");
      await champEmail(page).fill(email);
      await champMotDePasse(page).fill(MOT_DE_PASSE);
      await page.getByRole("button", { name: CREER }).click();
      await expect(page).toHaveURL(/\/tableau-de-bord$/);
      await page.getByRole("button", { name: "Se déconnecter" }).click();
      await expect(page).toHaveURL((u) => u.pathname === "/connexion");
      await page.getByRole("link", { name: "Quittances, accueil" }).click();
      await expect(page).toHaveURL((u) => u.pathname === "/");
      await page.getByRole("link", { name: CONNEXION }).click();
      await expect(page).toHaveURL((u) => u.pathname === "/connexion");
      await champEmail(page).fill(email);
      await champMotDePasse(page).fill(MOT_DE_PASSE);
      await page.getByRole("button", { name: CONNEXION }).click();
      await expect(page).toHaveURL(/\/tableau-de-bord$/);
      await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
    });
  });
});
