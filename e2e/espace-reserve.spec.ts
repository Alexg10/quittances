import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  adresseUnique,
  connecter,
  cookieDeSession,
  deconnecter,
  enteteCookie,
  expirationSession,
  expirerSession,
  inscrire,
  MOT_DE_PASSE,
  nombreDeSessions,
  ouvrirTableauDeBord,
  reculerSession,
} from "./aide-comptes";

// Espace réservé, protection et déconnexion (spec 02, T3) : CA16 à CA22, CA28
// (partie tableau de bord et déconnexion), CA36 (vu par axe et la console),
// renouvellement de la session (R16), absence de résidu après déconnexion (R18).
// Non couvert ici : la panne de base (CA29, manipulation manuelle : elle exige un
// second serveur dont la base est injoignable). La connexion est dans connexion.spec.ts.
// Chaque test crée ses propres comptes (R40).

const DEPART = "/tableau-de-bord?exemple=1";
const ARRIVEE = "/connexion?retour=%2Ftableau-de-bord%3Fexemple%3D1";
const INTERDITS = ["Connecté en tant que", "Se déconnecter", "Aucune location pour l'instant"];

/** Les marqueurs que le serveur ne doit jamais envoyer à un visiteur non connecté. */
function verifierSansContenuProtege(corps: string, email?: string) {
  for (const interdit of INTERDITS) expect(corps).not.toContain(interdit);
  expect(corps).not.toMatch(/<title>Tableau de bord/);
  if (email) expect(corps).not.toContain(email);
}

/** Pose un témoin dans le document : il disparaît si le document est rechargé. */
async function poserTemoin(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __temoin: string }).__temoin = "present";
  });
}
const lireTemoin = (page: Page) =>
  page.evaluate(() => (window as unknown as { __temoin?: string }).__temoin);

test.describe("Espace réservé", () => {
  test("CA16 : contenus, un seul lien (le logo) et un seul bouton", async ({ page }) => {
    const { email } = await inscrire(page);
    await ouvrirTableauDeBord(page);
    await expect(page).toHaveTitle("Tableau de bord — Quittances");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tableau de bord");
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(
      "Aucune location pour l'instant",
    );
    await expect(
      page.getByText("L'ajout de locations arrivera dans une prochaine version."),
    ).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    const liens = page.getByRole("link");
    await expect(liens).toHaveCount(1);
    await expect(liens).toHaveAccessibleName("Quittances, tableau de bord");
    await expect(liens).toHaveAttribute("href", "/tableau-de-bord");
    await expect(page.getByRole("button")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
    // Pas d'état de chargement : la page arrive d'un bloc.
    await expect(page.getByText("Chargement en cours")).toHaveCount(0);
  });

  test("CA16, R36 : le logo laisse sur la page, en haut, sans recharger le document", async ({
    page,
  }) => {
    await inscrire(page);
    await ouvrirTableauDeBord(page);
    await page.evaluate(() => {
      document.body.style.minHeight = "3000px";
      window.scrollTo(0, 800);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await poserTemoin(page);
    const documents: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "document") documents.push(r.url());
    });
    await page.getByRole("link", { name: "Quittances, tableau de bord" }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    expect(await lireTemoin(page)).toBe("present");
    expect(documents).toEqual([]);
  });

  test("CA36, CA30 : axe sans violation, console propre, mise en page sans débordement", async ({
    page,
  }) => {
    const messages: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") {
        messages.push(`${m.type()}: ${m.text()}`);
      }
    });
    page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
    // Une adresse très longue ne doit créer aucun défilement horizontal.
    const longue = adresseUnique(`${"a".repeat(60)}.${"b".repeat(60)}`);
    await inscrire(page, { email: longue });
    await ouvrirTableauDeBord(page);
    const resultats = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(resultats.violations).toEqual([]);
    for (const largeur of [320, 412, 768, 1280]) {
      await page.setViewportSize({ width: largeur, height: 800 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
        `défilement horizontal à ${largeur}px`,
      ).toBe(false);
    }
    expect(messages).toEqual([]);
  });

  test("CA36 : au clavier seul, le logo puis le bouton ont un focus visible, et Entrée déconnecte", async ({
    page,
  }) => {
    await inscrire(page);
    await ouvrirTableauDeBord(page);
    const contour = () =>
      page.evaluate(() => {
        const s = getComputedStyle(document.activeElement!);
        return { style: s.outlineStyle, largeur: s.outlineWidth, couleur: s.outlineColor };
      });
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Quittances, tableau de bord" })).toBeFocused();
    expect(await contour()).toEqual({ style: "solid", largeur: "2px", couleur: "rgb(79, 70, 229)" });
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeFocused();
    expect(await contour()).toEqual({ style: "solid", largeur: "2px", couleur: "rgb(79, 70, 229)" });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL((u) => u.pathname === "/connexion");
  });

  test("CA17 : sans session, avec un jeton inventé ou une session expirée, redirection sans contenu", async ({
    page,
    request,
  }) => {
    const { email } = await inscrire(page);
    const cookie = await cookieDeSession(page);
    const valide = `${cookie!.name}=${cookie!.value}`;
    await expirerSession(email);

    const cas: Record<string, Record<string, string>> = {
      "sans cookie": {},
      "jeton inventé": { Cookie: "better-auth.session_token=inventé.abc" },
      "session expirée": { Cookie: valide },
    };
    for (const [nom, headers] of Object.entries(cas)) {
      for (const [variante, enPlus] of Object.entries<Record<string, string>>({
        document: {},
        RSC: { RSC: "1" },
        "préchargement": { RSC: "1", "Next-Router-Prefetch": "1" },
      })) {
        const reponse = await request.get(DEPART, {
          headers: { ...headers, ...enPlus },
          maxRedirects: 0,
        });
        const etiquette = `${nom}, ${variante}`;
        expect(reponse.status(), etiquette).toBe(307);
        expect(reponse.headers().location, etiquette).toBe(ARRIVEE);
        verifierSansContenuProtege(await reponse.text(), email);
      }
    }

    // Dans un navigateur, avec ce même cookie périmé : adresse d'arrivée exacte,
    // et rien de protégé dans aucune réponse reçue pendant le trajet.
    const corps: string[] = [];
    page.on("response", async (r) => {
      if (r.request().resourceType() === "document" || r.url().includes("_rsc")) {
        corps.push(await r.text().catch(() => ""));
      }
    });
    await page.goto(DEPART);
    await expect(page).toHaveURL((u) => u.pathname + u.search === ARRIVEE);
    for (const c of corps) verifierSansContenuProtege(c, email);
  });

  test("CA17 : une adresse d'origine hostile ou bizarre est conservée, encodée, dans retour", async ({
    request,
  }) => {
    const reponse = await request.get("/tableau-de-bord?retour=https://exemple.test&a=é", {
      maxRedirects: 0,
    });
    expect(reponse.status()).toBe(307);
    const arrivee = new URL(reponse.headers().location, "http://localhost");
    expect(arrivee.pathname).toBe("/connexion");
    expect(arrivee.searchParams.get("retour")).toBe(
      "/tableau-de-bord?retour=https%3A%2F%2Fexemple.test&a=%C3%A9",
    );
    // Aucune redirection vers un autre site.
    expect(reponse.headers().location.startsWith("/connexion?")).toBe(true);
  });

  test("CA18, R18, R23 : déconnexion, session supprimée, jeton rejoué refusé, document rechargé, aucun résidu", async ({
    page,
    browser,
    request,
  }) => {
    const { email } = await inscrire(page);
    await ouvrirTableauDeBord(page);
    const entete = await enteteCookie(page);
    expect(await expirationSession(email)).not.toBeNull();
    await poserTemoin(page);

    await deconnecter(page);
    // Le formulaire de connexion s'affiche, vide, sans message (parcours 3, étape 3).
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await expect(page.getByLabel("Adresse e-mail")).toHaveValue("");
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);

    // La session n'existe plus sur le serveur et le cookie est effacé.
    expect(await expirationSession(email)).toBeNull();
    expect((await cookieDeSession(page))?.value ?? "").toBe("");
    // La seule exception à « pas de rechargement » : le document est neuf.
    expect(await lireTemoin(page)).toBeUndefined();
    // Rien du propriétaire ne subsiste dans le document, même masqué.
    const contenu = await page.content();
    expect(contenu).not.toContain(email);
    expect(contenu).not.toContain("Tableau de bord");
    expect(contenu).not.toContain("Se déconnecter");

    await page.goto("/tableau-de-bord");
    await expect(page).toHaveURL((u) => u.pathname === "/connexion");
    expect(new URL(page.url()).searchParams.get("retour")).toBe("/tableau-de-bord");
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();

    // Le jeton relevé avant la déconnexion, rejoué : refusé.
    const rejoue = await request.get("/tableau-de-bord", {
      headers: { Cookie: entete },
      maxRedirects: 0,
    });
    expect(rejoue.status()).toBe(307);
    verifierSansContenuProtege(await rejoue.text(), email);
    const contexte = await browser.newContext();
    try {
      const [nom, valeur] = [entete.split("=")[0], entete.slice(entete.indexOf("=") + 1)];
      await contexte.addCookies([{ name: nom, value: valeur, url: "http://localhost:3100" }]);
      const autre = await contexte.newPage();
      await autre.goto("/tableau-de-bord");
      await expect(autre).toHaveURL((u) => u.pathname === "/connexion");
      await expect(autre.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    } finally {
      await contexte.close();
    }
  });

  test("CA18 : un double clic n'envoie qu'une déconnexion, et une session déjà fermée ailleurs ne produit aucune erreur", async ({
    page,
    context,
  }) => {
    await inscrire(page);
    await ouvrirTableauDeBord(page);
    const autreOnglet = await context.newPage();
    await autreOnglet.goto("/tableau-de-bord");
    await expect(autreOnglet.getByRole("button", { name: "Se déconnecter" })).toBeVisible();

    const envois: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") envois.push(r.url());
    });
    await page.getByRole("button", { name: "Se déconnecter" }).dblclick();
    await expect(page).toHaveURL((u) => u.pathname === "/connexion");
    expect(envois).toHaveLength(1);

    // Dans l'autre onglet, resté ouvert sur une session déjà fermée : même résultat, sans erreur.
    await autreOnglet.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(autreOnglet).toHaveURL((u) => u.pathname === "/connexion");
    await expect(autreOnglet.getByText("Internal Server Error")).toHaveCount(0);
    await expect(autreOnglet.getByText("Service momentanément indisponible")).toHaveCount(0);
  });

  test("CA19, R19 : Précédent après la déconnexion ne montre jamais le contenu protégé", async ({
    page,
  }) => {
    const { email } = await inscrire(page);
    await ouvrirTableauDeBord(page);
    await deconnecter(page);
    for (let i = 0; i < 3; i++) {
      await page.goBack();
      await page.waitForLoadState("domcontentloaded");
      // Tant que le dernier retour n'est pas arrivé sur une page publique, on ne
      // lit rien : seules l'adresse d'arrivée et l'absence de contenu comptent.
      const texte = await page.locator("body").innerText();
      expect(texte).not.toContain(email);
      expect(texte).not.toContain("Tableau de bord");
      expect(await page.content()).not.toContain(email);
      expect(new URL(page.url()).pathname).not.toBe("/tableau-de-bord");
    }
    await page.reload();
    expect(await page.content()).not.toContain(email);
  });

  test("CA19 : revenir directement sur l'entrée du tableau de bord mène à /connexion", async ({
    page,
  }) => {
    const { email } = await inscrire(page);
    await ouvrirTableauDeBord(page);
    await deconnecter(page);
    await page.goBack();
    await expect(page).toHaveURL((u) => u.pathname === "/connexion");
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    expect(await page.content()).not.toContain(email);
  });

  test("CA20 : deux comptes dans deux contextes ne voient que leur adresse, la déconnexion de A épargne B", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [pageA, pageB] = [await ctxA.newPage(), await ctxB.newPage()];
      const [a, b] = [await inscrire(pageA), await inscrire(pageB)];
      for (const [page, soi, autre] of [
        [pageA, a.email, b.email],
        [pageB, b.email, a.email],
      ] as const) {
        await ouvrirTableauDeBord(page);
        await expect(page.getByText(`Connecté en tant que ${soi}`)).toBeVisible();
        expect(await page.content()).not.toContain(autre);
        const brut = await (await page.context().request.get("/tableau-de-bord")).text();
        expect(brut).toContain(soi);
        expect(brut).not.toContain(autre);
      }
      await deconnecter(pageA);
      await pageB.reload();
      await expect(pageB.getByText(`Connecté en tant que ${b.email}`)).toBeVisible();
      expect(await expirationSession(b.email)).not.toBeNull();
      expect(await expirationSession(a.email)).toBeNull();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  // Une seconde session du même compte ne s'ouvre que par la page de connexion :
  // copier le cookie dans un second contexte réutiliserait le même jeton, donc la
  // même session, et ce ne serait pas CA21.
  test("CA21 : deux sessions du même compte, la déconnexion de l'une épargne l'autre", async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    try {
      const page1 = await ctx1.newPage();
      const page2 = await ctx2.newPage();
      const compte = await inscrire(page1);
      await connecter(page2, compte);
      expect(await nombreDeSessions(compte.email)).toBe(2);
      expect(await enteteCookie(page2)).not.toBe(await enteteCookie(page1));
      await deconnecter(page1);
      expect(await nombreDeSessions(compte.email)).toBe(1);
      await page2.reload();
      await expect(page2.getByText(`Connecté en tant que ${compte.email}`)).toBeVisible();
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

  test("CA22, R17 : cookie de session HttpOnly, SameSite, 60 jours, sans adresse, invisible du script", async ({
    page,
  }) => {
    const { email } = await inscrire(page);
    const cookie = await cookieDeSession(page);
    expect(cookie, "cookie de session").toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(["Lax", "Strict"]).toContain(cookie!.sameSite);
    expect(cookie!.path).toBe("/");
    const jours = (cookie!.expires - Date.now() / 1000) / 86_400;
    expect(jours).toBeGreaterThan(59);
    expect(jours).toBeLessThan(61);
    expect(decodeURIComponent(cookie!.value)).not.toContain(email);
    expect(decodeURIComponent(cookie!.value)).not.toContain("@");
    expect(await page.evaluate(() => document.cookie)).toBe("");
    const expiration = await expirationSession(email);
    expect((expiration! - Date.now()) / 86_400_000).toBeGreaterThan(59);
  });

  test("R16 : une session ancienne est prolongée une fois, en base et dans le cookie, jamais par l'accueil", async ({
    page,
    request,
  }) => {
    const { email } = await inscrire(page);
    const entete = await enteteCookie(page);
    const lire = (chemin: string) =>
      request.get(chemin, { headers: { Cookie: entete }, maxRedirects: 0 });
    const cookiesDeSession = (r: Awaited<ReturnType<typeof lire>>) =>
      r
        .headersArray()
        .filter((h) => h.name.toLowerCase() === "set-cookie" && h.value.includes("session_token"))
        .map((h) => h.value);

    // Session toute neuve : rien à prolonger.
    expect(cookiesDeSession(await lire("/tableau-de-bord"))).toEqual([]);

    await reculerSession(email);
    const avant = await expirationSession(email);
    expect((avant! - Date.now()) / 86_400_000).toBeLessThan(11);

    // L'accueil ne lit ni session ni base, même pour une session à prolonger.
    expect(cookiesDeSession(await lire("/"))).toEqual([]);
    expect(await expirationSession(email)).toBe(avant);

    // Le tableau de bord la prolonge : nouveau cookie de 60 jours, expiration repoussée.
    const reponse = await lire("/tableau-de-bord");
    expect(reponse.status()).toBe(200);
    const poses = cookiesDeSession(reponse);
    expect(poses).toHaveLength(1);
    expect(poses[0]).toMatch(/HttpOnly/i);
    expect(poses[0]).toMatch(/SameSite=lax/i);
    const maxAge = Number(poses[0].match(/Max-Age=(\d+)/i)?.[1]);
    expect(maxAge / 86_400).toBeGreaterThan(59);
    expect(maxAge / 86_400).toBeLessThan(61);
    const apres = await expirationSession(email);
    expect((apres! - Date.now()) / 86_400_000).toBeGreaterThan(59);

    // La lecture suivante n'émet plus rien.
    expect(cookiesDeSession(await lire("/tableau-de-bord"))).toEqual([]);
  });

  test("R23 : la page protégée n'est jamais mise en cache partagé", async ({ page }) => {
    await inscrire(page);
    const reponse = await page.context().request.get("/tableau-de-bord");
    expect(reponse.headers()["cache-control"]).toMatch(/private|no-store/);
  });

  test("Chemins voisins : aucun contenu protégé sans session", async ({ request }) => {
    for (const chemin of [
      "/tableau-de-bord/x",
      "/tableau-de-bord%2F",
      "/tableau-de-bord?a=1&a=2",
    ]) {
      const reponse = await request.get(chemin, { maxRedirects: 0 });
      expect(reponse.status(), chemin).toBe(307);
      expect(reponse.headers().location, chemin).toMatch(/^\/connexion\?retour=/);
      verifierSansContenuProtege(await reponse.text());
    }
    for (const chemin of ["/Tableau-de-bord", "/tableau-de-bord/"]) {
      const reponse = await request.get(chemin, { maxRedirects: 0 });
      verifierSansContenuProtege(await reponse.text());
    }
  });
});

test.describe("Espace réservé sans JavaScript (CA28, R29)", () => {
  test.use({ javaScriptEnabled: false });

  test("redirection d'un visiteur, tableau de bord entier, déconnexion", async ({ page }) => {
    await page.goto(DEPART);
    await expect(page).toHaveURL((u) => u.pathname + u.search === ARRIVEE);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();

    const email = adresseUnique("nojs-t3");
    await page.goto("/inscription");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);

    // Tout est affiché d'un bloc, rien n'attend un script.
    await expect(page).toHaveTitle("Tableau de bord — Quittances");
    await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/connexion");
    expect(await page.content()).not.toContain(email);
    expect(await expirationSession(email)).toBeNull();

    await page.goto("/tableau-de-bord");
    await expect(page).toHaveURL((u) => u.pathname === "/connexion");
  });
});
