import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  adresseUnique,
  champEmail,
  champMotDePasse,
  cookieDeSession,
  inscrire,
  MOT_DE_PASSE,
  ouvrirInscription,
  remplirEtEnvoyer,
} from "./aide-comptes";

// Inscription (spec 02, T2) : CA10 à CA15, CA31, fonctionnement sans JavaScript (R29),
// protection de /tableau-de-bord et isolation entre comptes (R2).
// Non couverts ici : E8 (panne de base, manipulation manuelle, CA29) et la connexion
// du compte existant après E3 (CA13, dernière partie : T4).

const E1 = "Saisissez votre adresse e-mail.";
const E2 = "Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.";
const E3 = "Un compte existe déjà avec cette adresse e-mail.";
const E4 = "Saisissez votre mot de passe.";
const E5 = "Le mot de passe doit contenir au moins 12 caractères.";
const E6 = "Le mot de passe ne peut pas dépasser 128 caractères.";
const ROUGE_TEXTE = "rgb(185, 28, 28)";
const ROUGE_BORDURE = "rgb(239, 68, 68)";
const BOUTON = "Créer mon compte";

/** Attend la réponse du serveur à un envoi de formulaire. */
async function envoyer(page: Page) {
  const reponse = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name: BOUTON }).click();
  await reponse;
}

test.describe("Inscription", () => {
  test("CA10 : contenus, titre, attributs des champs et état initial", async ({ page }) => {
    await ouvrirInscription(page);
    await expect(page).toHaveTitle("Créer un compte — Quittances");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Créer un compte");
    await expect(
      page.getByText("Un compte par propriétaire, pour toutes vos locations."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "12 caractères au minimum. Conservez-le précieusement, un mot de passe oublié ne peut pas encore être réinitialisé.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: BOUTON })).toBeVisible();
    await expect(page.getByText("Vous avez déjà un compte.")).toBeVisible();

    const email = champEmail(page);
    const mdp = champMotDePasse(page);
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "username");
    await expect(mdp).toHaveAttribute("type", "password");
    await expect(mdp).toHaveAttribute("autocomplete", "new-password");
    for (const champ of [email, mdp]) {
      await expect(champ).toHaveValue("");
      await expect(champ).toHaveJSProperty("required", true);
      await expect(champ).not.toHaveAttribute("placeholder", /.+/);
      await expect(champ).not.toBeFocused();
      await expect(champ).not.toHaveAttribute("aria-invalid", "true");
    }
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
    await expect(page.locator("form")).toHaveAttribute("novalidate", "");
    await expect(page.getByRole("link", { name: "Se connecter" })).toHaveAttribute(
      "href",
      "/connexion",
    );
  });

  test("CA10 : le logo ramène à l'accueil sans recharger le document", async ({ page }) => {
    await ouvrirInscription(page);
    await page.evaluate(() => {
      (window as unknown as { __temoin: string }).__temoin = "present";
    });
    const documents: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "document") documents.push(r.url());
    });
    await page.getByRole("link", { name: "Quittances, accueil" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/");
    expect(await page.evaluate(() => (window as unknown as { __temoin?: string }).__temoin)).toBe(
      "present",
    );
    expect(documents).toEqual([]);
  });

  // À activer avec T4 : tant que /connexion répond 404, Next recharge le document.
  test.fixme("CA10 : « Se connecter » mène à /connexion sans recharger le document (après T4)", async ({
    page,
  }) => {
    await ouvrirInscription(page);
    await page.evaluate(() => {
      (window as unknown as { __temoin: string }).__temoin = "present";
    });
    await page.getByRole("link", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    expect(await page.evaluate(() => (window as unknown as { __temoin?: string }).__temoin)).toBe(
      "present",
    );
  });

  test("CA11 : inscription réussie, adresse normalisée, cookie de session sûr", async ({
    page,
  }) => {
    const unique = adresseUnique("Prenom.Nom");
    // Majuscules dans la saisie : le serveur enregistre et affiche la forme normalisée.
    const saisie = unique.replace("quittances.test", "Quittances.TEST");
    await ouvrirInscription(page);
    await remplirEtEnvoyer(page, saisie, MOT_DE_PASSE);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByText(`Connecté en tant que ${unique}`)).toBeVisible();

    const cookie = await cookieDeSession(page);
    expect(cookie, "cookie de session").toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(["Lax", "Strict"]).toContain(cookie!.sameSite);
    const jours = (cookie!.expires - Date.now() / 1000) / 86400;
    expect(jours).toBeGreaterThan(59);
    expect(jours).toBeLessThan(61);
    expect(decodeURIComponent(cookie!.value).toLowerCase()).not.toContain("quittances");
    expect(await page.evaluate(() => document.cookie)).not.toContain("session");
  });

  test("CA11, R4 : le serveur retire les espaces autour de l'adresse (envoi direct)", async ({
    page,
  }) => {
    // Le champ type=email retire lui-même les espaces : seul un envoi direct les montre au serveur.
    const email = adresseUnique("Espaces");
    await ouvrirInscription(page);
    const champsCaches = await page.locator("form input[type=hidden]").evaluateAll((els) =>
      els.map((e) => [(e as HTMLInputElement).name, (e as HTMLInputElement).value]),
    );
    const reponse = await page.request.post("/inscription", {
      maxRedirects: 0,
      multipart: {
        ...Object.fromEntries(champsCaches),
        email: `  ${email.toUpperCase()}  `,
        password: MOT_DE_PASSE,
      },
    });
    expect(reponse.status()).toBe(303);
    expect(new URL(reponse.headers()["location"], "http://x").pathname).toBe("/tableau-de-bord");
    await page.goto("/tableau-de-bord");
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
  });

  test("CA12 : messages d'erreur, focus, adresse conservée, mot de passe vidé", async ({
    page,
  }) => {
    await ouvrirInscription(page);
    const email = champEmail(page);
    const mdp = champMotDePasse(page);

    // Formulaire vide : E1 et E4, focus sur l'adresse.
    await envoyer(page);
    await expect(page.getByText(E1)).toBeVisible();
    await expect(page.getByText(E4)).toBeVisible();
    await expect(page).toHaveURL(/\/inscription$/);
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(mdp).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription(E1);
    await expect(mdp).toHaveAccessibleDescription(new RegExp(`^${E4}`));
    await expect(page.getByText(E1)).toHaveCSS("color", ROUGE_TEXTE);
    await expect(page.getByText(E4)).toHaveCSS("color", ROUGE_TEXTE);
    // Le champ qui n'a pas le focus montre la bordure d'erreur.
    await expect(mdp).toHaveCSS("border-top-color", ROUGE_BORDURE);

    // E2 et E5 remplacent E1 et E4 ; l'adresse est conservée, le mot de passe vidé.
    await email.fill("marie@exemple");
    await mdp.fill("12345678901");
    await envoyer(page);
    await expect(page.getByText(E2)).toBeVisible();
    await expect(page.getByText(E5)).toBeVisible();
    await expect(page.getByText(E1)).toHaveCount(0);
    await expect(page.getByText(E4)).toHaveCount(0);
    await expect(email).toHaveValue("marie@exemple");
    await expect(mdp).toHaveValue("");
    await expect(email).toBeFocused();

    // Adresse valide, mot de passe trop court : seul E5, focus sur le mot de passe.
    await email.fill("marie@exemple.fr");
    await mdp.fill("12345678901");
    await envoyer(page);
    await expect(page.getByText(E2)).toHaveCount(0);
    await expect(page.getByText(E5)).toBeVisible();
    await expect(mdp).toBeFocused();
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveCSS("border-top-color", "rgb(232, 232, 236)");

    // E6 au-delà de 128 caractères.
    await mdp.fill("a".repeat(129));
    await envoyer(page);
    await expect(page.getByText(E6)).toBeVisible();
    await expect(page.getByText(E6)).toHaveCSS("color", ROUGE_TEXTE);
  });

  test("CA12, R5, R7 : valeurs limites du mot de passe et adresses refusées par la bibliothèque", async ({
    page,
  }) => {
    // Une adresse avec points consécutifs ou accent est refusée par Better Auth : E2, pas une panne.
    await ouvrirInscription(page);
    for (const refusee of ["a..b@exemple.fr", "é@exemple.fr"]) {
      await remplirEtEnvoyer(page, refusee, MOT_DE_PASSE);
      await expect(page.getByText(E2)).toBeVisible();
      await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
      await expect(champEmail(page)).toHaveValue(refusee);
    }
    // 12 espaces, puis 128 caractères : acceptés.
    for (const motDePasse of [" ".repeat(12), "a".repeat(128)]) {
      await page.goto("/inscription");
      await inscrire(page, { motDePasse });
      await page.context().clearCookies();
    }
  });

  test("CA13 : adresse déjà utilisée, casse différente, aucune session ouverte", async ({
    page,
    browser,
  }) => {
    const { email } = await inscrire(page);
    const autre = await browser.newContext();
    try {
      const p2 = await autre.newPage();
      await ouvrirInscription(p2);
      await remplirEtEnvoyer(p2, email.toUpperCase(), "AutreMotDePasse-99");
      await expect(p2.getByText(E3)).toBeVisible();
      await expect(p2).toHaveURL(/\/inscription$/);
      await expect(champEmail(p2)).toBeFocused();
      await expect(champEmail(p2)).toHaveAccessibleDescription(E3);
      await expect(champMotDePasse(p2)).toHaveValue("");
      expect(await cookieDeSession(p2)).toBeUndefined();
      await p2.goto("/tableau-de-bord");
      await expect(p2).toHaveURL(/\/connexion/);
    } finally {
      await autre.close();
    }
  });

  test("CA14 : double activation, attente, un seul compte créé", async ({ page, browser }) => {
    // Le test retarde la réponse du serveur pour observer l'attente.
    await page.route("**/inscription", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((r) => setTimeout(r, 1500));
      }
      await route.continue();
    });
    const email = adresseUnique("double");
    let envois = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/inscription")) envois += 1;
    });
    await ouvrirInscription(page);
    await champEmail(page).fill(email);
    await champMotDePasse(page).fill(MOT_DE_PASSE);
    await page.getByRole("button", { name: BOUTON }).dblclick();
    const attente = page.getByRole("button", { name: "Création en cours" });
    await expect(attente).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Création en cours");
    await expect(champEmail(page)).toHaveValue(email);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    expect(envois).toBe(1);

    // Un seul compte : une nouvelle inscription donne E3, pas une panne.
    const autre = await browser.newContext();
    try {
      const p2 = await autre.newPage();
      await ouvrirInscription(p2);
      await remplirEtEnvoyer(p2, email, MOT_DE_PASSE);
      await expect(p2.getByText(E3)).toBeVisible();
      await expect(p2.locator("form").getByRole("alert")).toHaveCount(0);
    } finally {
      await autre.close();
    }
  });

  test("CA15 : Afficher / Masquer le mot de passe, sans envoyer le formulaire", async ({
    page,
  }) => {
    await ouvrirInscription(page);
    const mdp = champMotDePasse(page);
    await mdp.fill("UneSaisie-longue");
    let envois = 0;
    page.on("request", (r) => {
      if (r.method() === "POST") envois += 1;
    });
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await expect(mdp).toHaveAttribute("type", "text");
    await expect(mdp).toHaveValue("UneSaisie-longue");
    const masquer = page.getByRole("button", { name: "Masquer le mot de passe" });
    await expect(masquer).toHaveText("Masquer");
    await masquer.click();
    await expect(mdp).toHaveAttribute("type", "password");
    await expect(mdp).toHaveValue("UneSaisie-longue");
    await expect(page.getByRole("button", { name: "Afficher le mot de passe" })).toHaveText(
      "Afficher",
    );
    expect(envois).toBe(0);
    await expect(page).toHaveURL(/\/inscription$/);
  });

  test("CA31 : mise en page de 320 à 1280px, carte, champs et bouton", async ({ page }) => {
    for (const largeur of [320, 412, 768, 1280]) {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirInscription(page);
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
      const email = champEmail(page);
      await expect(email).toHaveCSS("border-top-width", "1px");
      await expect(email).toHaveCSS("border-top-color", "rgb(232, 232, 236)");
      await expect(email).toHaveCSS("border-top-left-radius", "6px");
      await expect(email).toHaveCSS("background-color", "rgb(255, 255, 255)");
      const bouton = page.getByRole("button", { name: BOUTON });
      await expect(bouton).toHaveCSS("background-color", "rgb(79, 70, 229)");
      const [b, c] = [(await bouton.boundingBox())!, (await email.boundingBox())!];
      expect(b.height).toBe(44);
      expect(b.width).toBeCloseTo(c.width, 0);
    }
    // Bordures au focus et en erreur.
    await page.setViewportSize({ width: 1280, height: 900 });
    await ouvrirInscription(page);
    await champEmail(page).focus();
    await expect(champEmail(page)).toHaveCSS("border-top-color", "rgb(79, 70, 229)");
    await envoyer(page);
    await expect(champMotDePasse(page)).toHaveCSS("border-top-color", ROUGE_BORDURE);
  });

  test("CA30 (inscription) : axe sans violation à l'état initial et à l'état d'erreur", async ({
    page,
  }) => {
    const analyser = () =>
      new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    await ouvrirInscription(page);
    expect((await analyser()).violations).toEqual([]);
    await envoyer(page);
    await expect(page.getByText(E1)).toBeVisible();
    expect((await analyser()).violations).toEqual([]);
  });

  test("CA32 (inscription) : au clavier seul, ordre de tabulation, focus visible, soumission", async ({
    page,
  }) => {
    await ouvrirInscription(page);
    const attendu = [
      "Quittances, accueil",
      "Adresse e-mail",
      "Mot de passe",
      "Afficher le mot de passe",
      BOUTON,
      "Se connecter",
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
      // Boutons et lien : contour plein de 2px ; champs : bordure primaire et anneau.
      if (nom === "Adresse e-mail" || nom === "Mot de passe") {
        expect(arret.bordure).toBe("rgb(79, 70, 229)");
        expect(arret.anneau).toBe(true);
      } else {
        expect(arret.contour, `contour de « ${nom} »`).toBe(true);
      }
    }
    // Retour au bouton d'envoi, Entrée : erreurs annoncées, focus sur l'adresse.
    await page.getByRole("button", { name: BOUTON }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(E1)).toBeVisible();
    await expect(champEmail(page)).toBeFocused();
  });

  test("Console : aucune erreur ni avertissement pendant l'inscription", async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (m) => {
      if (m.type() !== "error" && m.type() !== "warning") return;
      // /connexion n'existe pas avant T4 : son préchargement répond 404.
      if (/404/.test(m.text())) return;
      messages.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
    await ouvrirInscription(page);
    await envoyer(page);
    await expect(page.getByText(E1)).toBeVisible();
    await page.reload();
    await inscrire(page);
    expect(messages).toEqual([]);
  });
});

test.describe("Inscription sans JavaScript (R29)", () => {
  test.use({ javaScriptEnabled: false });

  test("erreurs, adresse conservée, mot de passe vidé, puis inscription réussie", async ({
    page,
  }) => {
    await page.goto("/inscription");
    await page.getByRole("button", { name: BOUTON }).click();
    await expect(page.getByText(E1)).toBeVisible();
    await expect(page.getByText(E4)).toBeVisible();

    const url = new Set<string>();
    page.on("request", (r) => url.add(r.url()));
    await champEmail(page).fill("marie@exemple");
    await champMotDePasse(page).fill("court");
    await page.getByRole("button", { name: BOUTON }).click();
    await expect(page.getByText(E2)).toBeVisible();
    await expect(page.getByText(E5)).toBeVisible();
    await expect(champEmail(page)).toHaveValue("marie@exemple");
    await expect(champMotDePasse(page)).toHaveValue("");
    expect([...url].some((u) => u.includes("court"))).toBe(false);

    // Le bouton Afficher ne fait rien et n'envoie pas le formulaire.
    const avant = url.size;
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    expect(url.size).toBe(avant);
    await expect(page).toHaveURL(/\/inscription$/);

    const email = adresseUnique("nojs");
    await champEmail(page).fill(email);
    await champMotDePasse(page).fill(MOT_DE_PASSE);
    await page.getByRole("button", { name: BOUTON }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    // Rendu d'un bloc sur le serveur : tout est visible sans script.
    await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByText(`Connecté en tant que ${email}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
  });
});

test.describe("Protection de /tableau-de-bord et isolation", () => {
  test("/tableau-de-bord sans session : redirection, aucune adresse dans ce que reçoit le visiteur", async ({
    page,
    request,
  }) => {
    for (const cookie of [undefined, "better-auth.session_token=inventé.abc"]) {
      const reponse = await request.get("/tableau-de-bord?exemple=1", {
        headers: cookie ? { Cookie: cookie } : {},
        maxRedirects: 0,
      });
      const html = await reponse.text();
      expect(reponse.status()).toBe(307);
      expect(reponse.headers().location).toBe(
        "/connexion?retour=%2Ftableau-de-bord%3Fexemple%3D1",
      );
      expect(html).not.toContain("Connecté en tant que");
      expect(html).not.toContain("Se déconnecter");
      expect(html).not.toMatch(/<title>Tableau de bord/);
    }
    const corps: string[] = [];
    page.on("response", async (r) => {
      if (r.request().resourceType() === "document" || r.url().includes("_rsc")) {
        corps.push(await r.text().catch(() => ""));
      }
    });
    await page.goto("/tableau-de-bord?exemple=1");
    await expect(page).toHaveURL(
      (u) => u.pathname + u.search === "/connexion?retour=%2Ftableau-de-bord%3Fexemple%3D1",
    );
    expect(corps.join("")).not.toContain("Connecté en tant que");
  });

  test("Isolation : chaque propriétaire ne voit que sa propre adresse", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [pageA, pageB] = [await ctxA.newPage(), await ctxB.newPage()];
      const [a, b] = [await inscrire(pageA), await inscrire(pageB)];
      for (const [page, soi, autre] of [
        [pageA, a.email, b.email],
        [pageB, b.email, a.email],
      ] as const) {
        await expect(page.getByText(`Connecté en tant que ${soi}`)).toBeVisible();
        await page.reload();
        await expect(page.getByText(`Connecté en tant que ${soi}`)).toBeVisible();
        expect(await page.content()).not.toContain(autre);
        const brut = await page.context().request.get("/tableau-de-bord");
        const html = await brut.text();
        expect(html).toContain(soi);
        expect(html).not.toContain(autre);
      }
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
