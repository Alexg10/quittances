import { expect, test, type Browser, type Page } from "@playwright/test";

// Page d'accueil (spec 01, T2) : CA30 à CA34, CA36 et la précision de R31 sur le h1.
// CA23 (ancre et titre sous l'en-tête) est couvert en entier dans accueil-entete.spec.ts.
// Depuis la spec 02 (R38), le bouton primaire est « Créer mon compte » (vers /inscription) et
// la page n'a plus que deux h2 ; ses nouveaux liens sont testés dans accueil-connexion.spec.ts.

const BOUTON = "Créer mon compte";

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

  for (const largeur of [768, 1024, 1280]) {
    test(`R31 : le h1 tient sur deux lignes à ${largeur}px, accroche limitée à 640px`, async ({
      page,
    }) => {
      await ouvrir(page, largeur);
      const m = await page.evaluate(() => {
        const h1 = document.querySelector("h1")!;
        const cs = getComputedStyle(h1);
        const accroche = h1.nextElementSibling as HTMLElement;
        return {
          lignes: Math.round(h1.getBoundingClientRect().height / parseFloat(cs.lineHeight)),
          largeur: h1.getBoundingClientRect().width,
          equilibre: cs.textWrapStyle,
          accroche: accroche.getBoundingClientRect().width,
        };
      });
      expect(m.lignes).toBe(2);
      expect(m.largeur).toBeLessThanOrEqual(960);
      expect(m.equilibre).toBe("balance");
      expect(m.accroche).toBeLessThanOrEqual(640);
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
    // Deux h2 depuis la suppression de la section « Les inscriptions ouvrent bientôt » (R38).
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(2);
    for (const h2 of await page.getByRole("heading", { level: 2 }).all()) {
      await expect(h2).toBeVisible();
    }
    await expect(page.getByRole("contentinfo")).toBeVisible();
    // Le bouton mène désormais à /inscription : l'ancre se vérifie par l'arrivée directe.
    await expect(page.getByRole("link", { name: BOUTON })).toHaveAttribute("href", "/inscription");
    await page.goto("/#fonctionnement");
    await expect(
      page.getByRole("heading", { level: 2, name: "Comment ça marche" }),
    ).toBeInViewport();
    // R25 : le titre n'est pas recouvert par l'en-tête fixe (même sans JavaScript).
    const t = (await page.getByRole("heading", { level: 2, name: "Comment ça marche" }).boundingBox())!;
    const e = (await page.getByRole("banner").boundingBox())!;
    expect(t.y).toBeGreaterThanOrEqual(e.y + e.height);
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
