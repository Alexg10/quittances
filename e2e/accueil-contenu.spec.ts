import { expect, test, type Browser, type Page } from "@playwright/test";

// Page d'accueil (spec 01, T2) : CA23 (adresse et visibilité du titre), CA30 à CA34, CA36.
// Les sélecteurs passent par le rôle et le nom pour rester valables quand T3 ajoutera
// l'en-tête fixe et ses liens de navigation.

const BOUTON = "Voir comment ça marche";

async function ouvrir(page: Page, largeur?: number) {
  if (largeur) await page.setViewportSize({ width: largeur, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

// Le survol n'existe pas sur un écran tactile : Tailwind réserve `hover:` à (hover: hover).
// Les tests de survol ouvrent donc un contexte avec souris, quel que soit le projet.
async function pageAvecSouris(browser: Browser, extra: object = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    isMobile: false,
    hasTouch: false,
    ...extra,
  });
  const page = await context.newPage();
  await page.goto("/");
  return { context, page };
}

const colonnes = (page: Page, region: string) =>
  page
    .getByRole("region", { name: region })
    .getByRole("list")
    .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);

test.describe("Page d'accueil, contenu", () => {
  test("CA23 : « Voir comment ça marche » amène le titre de la section dans la fenêtre", async ({
    page,
  }) => {
    await ouvrir(page);
    await page.getByRole("link", { name: BOUTON }).click();
    await expect(page).toHaveURL(/#fonctionnement$/);
    const titre = page.getByRole("heading", { level: 2, name: "Comment ça marche" });
    // Tolérance de 1px : le défilement s'arrête parfois à une fraction de pixel.
    await expect
      .poll(async () => {
        const b = (await titre.boundingBox())!;
        const vh = page.viewportSize()!.height;
        return b.y >= -1 && b.y + b.height <= vh;
      })
      .toBe(true);
  });

  for (const largeur of [320, 412, 768, 1024, 1280]) {
    test(`CA30 : pas de défilement horizontal à ${largeur}px`, async ({ page }) => {
      await ouvrir(page, largeur);
      const m = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        fenetre: document.documentElement.clientWidth,
      }));
      expect(m.fenetre).toBe(largeur);
      expect(m.doc).toBeLessThanOrEqual(largeur);
    });
  }

  for (const [largeur, h1, h2, etapes, cartes, espace] of [
    [412, 40, 24, 1, 1, 32],
    [768, 56, 32, 3, 2, 48],
    [1280, 72, 32, 3, 2, 64],
  ] as const) {
    test(`CA31 : mise en page à ${largeur}px (titre, colonnes, espacement)`, async ({ page }) => {
      await ouvrir(page, largeur);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", `${h1}px`);
      await expect(
        page.getByRole("heading", { level: 2, name: "Comment ça marche" }),
      ).toHaveCSS("font-size", `${h2}px`);
      expect(await colonnes(page, "Comment ça marche")).toBe(etapes);
      expect(await colonnes(page, "Ce que fait Quittances")).toBe(cartes);
      // Espacement vertical entre deux sections consécutives.
      const ecart = await page.evaluate(() => {
        const a = document.getElementById("fonctionnement")!.getBoundingClientRect();
        const b = document.getElementById("fonctionnalites")!.getBoundingClientRect();
        return b.top - a.bottom;
      });
      expect(ecart).toBe(espace);
    });
  }

  test("CA32 : style du bouton primaire, seul élément à fond primaire", async ({ page }) => {
    await ouvrir(page);
    const lien = page.getByRole("link", { name: BOUTON });
    await expect(lien).toHaveCSS("background-color", "rgb(79, 70, 229)");
    await expect(lien).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(lien).toHaveCSS("border-radius", "6px");
    await expect(lien).toHaveCSS("font-weight", "500");
    expect((await lien.boundingBox())!.height).toBe(44);

    const fonds = await page.evaluate(
      () =>
        [...document.querySelectorAll("body *")].filter(
          (e) => getComputedStyle(e).backgroundColor === "rgb(79, 70, 229)",
        ).length,
    );
    expect(fonds).toBe(1);
  });

  test("CA32, R26 : survol du bouton primaire (fond, ombre, décalage de 1px)", async ({
    browser,
  }) => {
    const { context, page } = await pageAvecSouris(browser);
    const lien = page.getByRole("link", { name: BOUTON });
    const avant = (await lien.boundingBox())!.y;
    await lien.hover();
    await expect(lien).toHaveCSS("background-color", "rgb(67, 56, 202)");
    await expect(lien).toHaveCSS("box-shadow", /rgba\(79, 70, 229, 0\.35\) 0px 4px 12px 0px/);
    await expect.poll(async () => avant - (await lien.boundingBox())!.y).toBeCloseTo(1, 1);
    await context.close();
  });

  test("CA33 : style d'une carte, sans ombre", async ({ page }) => {
    await ouvrir(page);
    const cartes = page
      .getByRole("region", { name: "Ce que fait Quittances" })
      .getByRole("listitem");
    await expect(cartes).toHaveCount(4);
    const carte = cartes.first();
    await expect(carte).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(carte).toHaveCSS("border-top-width", "1px");
    await expect(carte).toHaveCSS("border-top-style", "solid");
    await expect(carte).toHaveCSS("border-top-color", "rgb(232, 232, 236)");
    await expect(carte).toHaveCSS("border-top-left-radius", "12px");
    await expect(carte).toHaveCSS("box-shadow", "none");
  });

  test("CA33 : une carte survolée n'a ni ombre ni soulèvement", async ({ browser }) => {
    const { context, page } = await pageAvecSouris(browser);
    const carte = page
      .getByRole("region", { name: "Ce que fait Quittances" })
      .getByRole("listitem")
      .first();
    const haut = () => carte.evaluate((e) => e.getBoundingClientRect().top + scrollY);
    const avant = await haut();
    await carte.hover();
    await expect(carte).toHaveCSS("box-shadow", "none");
    expect(await haut()).toBe(avant);
    await context.close();
  });

  test("CA34 : JavaScript désactivé, contenu visible et ancre fonctionnelle", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 412, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(3);
    for (const h2 of await page.getByRole("heading", { level: 2 }).all()) {
      await expect(h2).toBeVisible();
    }
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await page.getByRole("link", { name: BOUTON }).click();
    await expect(page).toHaveURL(/#fonctionnement$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "Comment ça marche" }),
    ).toBeInViewport();
    await context.close();
  });

  test("CA36 : mouvement réduit, le bouton ne bouge pas et sa transition est nulle", async ({
    browser,
  }) => {
    const { context, page } = await pageAvecSouris(browser, { reducedMotion: "reduce" });
    const lien = page.getByRole("link", { name: BOUTON });
    const avant = (await lien.boundingBox())!.y;
    await lien.hover();
    await expect(lien).toHaveCSS("background-color", "rgb(67, 56, 202)");
    await expect(lien).toHaveCSS("transition-duration", "0s");
    expect((await lien.boundingBox())!.y).toBe(avant);
    await context.close();
  });
});
