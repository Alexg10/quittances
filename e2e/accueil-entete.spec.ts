import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Page d'accueil (spec 01, T3) : en-tête fixe, lien d'évitement, ancres, focus.
// CA23 (complet), CA24, CA25 (et R24), CA26, CA27, CA28, CA29, CA35, et le parcours
// « clic sur le logo » (étape 4 du parcours utilisateur).
// Adapté à la spec 02 (R38) : le bouton primaire est « Créer mon compte » (vers /inscription),
// l'en-tête a un lien « Se connecter », la section « inscriptions » n'existe plus.

const BOUTON = "Créer mon compte";
const CONNEXION = "Se connecter";
const HAUTEUR_ENTETE = 56;

async function ouvrir(page: Page, chemin = "/") {
  await page.goto(chemin);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

const enTete = (page: Page) => page.getByRole("banner");

/** Le titre est entièrement dans la fenêtre et son bord haut est sous le bord bas de l'en-tête. */
async function titreSousEnTete(page: Page, titre: string) {
  const h2 = page.getByRole("heading", { level: 2, name: titre });
  await expect
    .poll(async () => {
      const t = (await h2.boundingBox())!;
      const e = (await enTete(page).boundingBox())!;
      const vh = page.viewportSize()!.height;
      return t.y >= e.y + e.height && t.y + t.height <= vh;
    })
    .toBe(true);
}

test.describe("Page d'accueil, en-tête et navigation", () => {
  test("CA23 : « Fonctionnement » (bureau) ou l'arrivée directe (mobile) amène le titre sous l'en-tête", async ({
    page,
    isMobile,
  }) => {
    if (isMobile) {
      // Sous 768px la navigation n'existe pas : on arrive directement sur l'ancre.
      await ouvrir(page, "/#fonctionnement");
    } else {
      await ouvrir(page);
      await page.getByRole("link", { name: "Fonctionnement", exact: true }).click();
    }
    await expect(page).toHaveURL(/#fonctionnement$/);
    await titreSousEnTete(page, "Comment ça marche");
  });

  test("CA23, R25 : arrivée directe sur une ancre, le titre n'est pas sous l'en-tête", async ({
    page,
  }) => {
    for (const [ancre, titre] of [
      ["#fonctionnement", "Comment ça marche"],
      ["#fonctionnalites", "Ce que fait Quittances"],
    ]) {
      await ouvrir(page, `/${ancre}`);
      await titreSousEnTete(page, titre);
    }
    // R38 : l'ancre #inscriptions n'existe plus.
    await expect(page.locator("#inscriptions")).toHaveCount(0);
  });

  test("CA24, R24 : « Fonctionnalités » mène au titre, liens de navigation en 14px 500", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "bureau", "navigation visible à partir de 768px");
    await ouvrir(page);
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    const lien = nav.getByRole("link", { name: "Fonctionnalités" });
    await expect(lien).toHaveCSS("font-size", "14px");
    await expect(lien).toHaveCSS("font-weight", "500");
    await lien.click();
    await expect(page).toHaveURL(/#fonctionnalites$/);
    await titreSousEnTete(page, "Ce que fait Quittances");
  });

  test("CA25, R24 : l'en-tête reste visible en bas de page, 56px, flou, filet, sans ombre", async ({
    page,
  }) => {
    await ouvrir(page);
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const entete = enTete(page);
    await expect(entete).toBeInViewport({ ratio: 1 });
    const boite = (await entete.boundingBox())!;
    expect(boite.y).toBe(0);
    expect(boite.height).toBe(HAUTEUR_ENTETE);
    await expect(entete).toHaveCSS("position", "fixed");
    await expect(entete).toHaveCSS("backdrop-filter", /blur\(/);
    await expect(entete).toHaveCSS("border-bottom-width", "1px");
    await expect(entete).toHaveCSS("border-bottom-color", "rgb(232, 232, 236)");
    await expect(entete).toHaveCSS("box-shadow", "none");
    // Fond translucide : canal alpha inférieur à 1.
    const alpha = await entete.evaluate((e) => {
      const c = getComputedStyle(e).backgroundColor;
      return c.includes("/") ? Number(c.split("/")[1].replace(")", "")) : 1;
    });
    expect(alpha).toBeLessThan(1);
    const logo = entete.getByRole("link", { name: "Quittances, accueil" });
    await expect(logo).toHaveCSS("font-weight", "700");
    await expect(logo).toHaveCSS("font-family", /Plus Jakarta Sans/);
    await expect(logo).toHaveCSS("color", "rgb(10, 10, 10)");
  });

  test("CA26 : navigation absente et non atteignable à 767px, présente à 768px", async ({
    page,
  }) => {
    const liens = ["Fonctionnement", "Fonctionnalités"];
    await page.setViewportSize({ width: 767, height: 800 });
    await ouvrir(page);
    for (const nom of liens) {
      await expect(page.getByRole("link", { name: nom, exact: true })).toBeHidden();
    }
    const arrets: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      arrets.push(
        (await page.evaluate(() => document.activeElement?.textContent?.trim())) ?? "",
      );
    }
    for (const nom of liens) expect(arrets).not.toContain(nom);

    await page.setViewportSize({ width: 768, height: 800 });
    for (const nom of liens) {
      await expect(page.getByRole("link", { name: nom, exact: true })).toBeVisible();
    }
    await page.getByRole("link", { name: "Fonctionnement", exact: true }).focus();
    await expect(page.getByRole("link", { name: "Fonctionnement", exact: true })).toBeFocused();
  });

  test("CA27 : le lien d'évitement apparaît au premier Tab et mène au contenu", async ({
    page,
  }) => {
    await ouvrir(page);
    const evitement = page.getByRole("link", { name: "Aller au contenu" });
    await expect(evitement).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(evitement).toBeFocused();
    await expect(evitement).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contenu$/);
    // Le haut du contenu n'est pas sous l'en-tête.
    const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(h1.y).toBeGreaterThanOrEqual(HAUTEUR_ENTETE);
    // La tabulation repart du contenu, pas du haut de la page.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: BOUTON })).toBeFocused();
  });

  test("CA28 : ordre de tabulation et contour plein d'au moins 2px à chaque arrêt", async ({
    page,
    isMobile,
  }) => {
    await ouvrir(page);
    const attendu = [
      "Aller au contenu",
      "Quittances, accueil",
      ...(isMobile ? [] : ["Fonctionnement", "Fonctionnalités"]),
      CONNEXION,
      BOUTON,
    ];
    const vus: string[] = [];
    for (let i = 0; i < attendu.length; i++) {
      await page.keyboard.press("Tab");
      const arret = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement;
        const c = getComputedStyle(e);
        return {
          nom: e.getAttribute("aria-label") ?? e.textContent?.trim() ?? "",
          style: c.outlineStyle,
          largeur: parseFloat(c.outlineWidth),
        };
      });
      vus.push(arret.nom);
      expect(arret.style, `contour de « ${arret.nom} »`).toBe("solid");
      expect(arret.largeur, `largeur du contour de « ${arret.nom} »`).toBeGreaterThanOrEqual(2);
    }
    expect(vus).toEqual(attendu);
    // Un Tab de plus sort de la page : plus aucun élément focalisable dans le document.
    await page.keyboard.press("Tab");
    const encoreUnLien = await page.evaluate(() => document.activeElement?.tagName === "A");
    expect(encoreUnLien).toBe(false);
  });

  test("CA29 : analyse axe WCAG 2.1 A et AA sans violation, y compris sous l'en-tête translucide", async ({
    page,
  }) => {
    await ouvrir(page);
    const analyser = () =>
      new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
    const haut = await analyser();
    expect(haut.violations).toEqual([]);
    // Le bouton indigo passe sous la barre floutée : le contraste du logo ne doit pas devenir indécidable.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("a")].find((a) =>
        a.textContent?.includes("Créer mon compte"),
      )!;
      window.scrollTo(0, b.getBoundingClientRect().top + scrollY - 20);
    });
    const defile = await analyser();
    expect(defile.violations).toEqual([]);
    // Axe ne sait pas décider du contraste du logo sur un fond translucide (« incomplete »).
    // On le tranche donc ici : texte du logo sur le pire fond possible, le bouton indigo vu à travers l'en-tête.
    const ratio = await page.evaluate(() => {
      // Le canevas convertit n'importe quelle couleur CSS (oklab compris) en RGBA.
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      const rgba = (css: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data];
      };
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const racine = getComputedStyle(document.documentElement);
      const primaire = rgba(racine.getPropertyValue("--color-primary").trim());
      const fond = rgba(getComputedStyle(document.querySelector("header")!).backgroundColor);
      const a = fond[3] / 255;
      const melange = [0, 1, 2].map((i) => fond[i] * a + primaire[i] * (1 - a));
      const texte = rgba(getComputedStyle(document.querySelector("header a")!).color);
      const [l1, l2] = [lum(melange), lum(texte)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test("CA35 : aucune erreur ni avertissement en console pendant le parcours", async ({
    page,
    isMobile,
  }) => {
    const messages: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") messages.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
    await ouvrir(page, "/#fonctionnement");
    if (!isMobile) {
      for (const nom of ["Fonctionnalités", "Fonctionnement"]) {
        await page.getByRole("link", { name: nom, exact: true }).click();
      }
    }
    await page.getByRole("link", { name: "Quittances, accueil" }).click();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(messages).toEqual([]);
  });

  // Le logo est un Link de next/link : jamais de rechargement du document (décision de l'utilisateur, R24).
  async function logoHydrate(page: Page) {
    const logo = page.getByRole("link", { name: "Quittances, accueil" });
    // Tant que React n'a pas attaché ses gestionnaires, un clic ferait une navigation native.
    await expect
      .poll(() =>
        logo.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))),
      )
      .toBe(true);
    return logo;
  }

  /** Pose un témoin sur window et compte les requêtes de document à partir de maintenant. */
  async function surveillerRechargement(page: Page) {
    await page.evaluate(() => {
      (window as unknown as { __temoin: string }).__temoin = "present";
    });
    const documents: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "document") documents.push(r.url());
    });
    return {
      async verifier() {
        // Signal 1 : le témoin posé avant le clic a survécu (même document).
        await expect
          .poll(() => page.evaluate(() => (window as unknown as { __temoin?: string }).__temoin))
          .toBe("present");
        // Signal 2 : aucune requête de type document n'est partie.
        expect(documents).toEqual([]);
      },
    };
  }

  for (const depart of ["/", "/#fonctionnalites"]) {
    test(`Parcours étape 4, R24 : le logo ramène en haut de page sans recharger le document, depuis ${depart}`, async ({
      page,
    }) => {
      await ouvrir(page, depart);
      const logo = await logoHydrate(page);
      if (depart === "/") {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      }
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      const surveillance = await surveillerRechargement(page);
      await logo.click();
      await expect(page).toHaveURL((u) => u.pathname === "/" && u.hash === "");
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await surveillance.verifier();
    });
  }

  test("Parcours étape 4 : Entrée sur le logo focalisé ramène en haut sans recharger", async ({
    page,
  }) => {
    await ouvrir(page);
    const logo = await logoHydrate(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await logo.focus();
    await expect(logo).toBeFocused();
    const surveillance = await surveillerRechargement(page);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL((u) => u.pathname === "/" && u.hash === "");
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await surveillance.verifier();
  });

  test("Parcours étape 4 : Ctrl/Cmd + clic sur le logo ne fait pas défiler la page courante", async ({
    page,
  }) => {
    await ouvrir(page);
    const logo = await logoHydrate(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const avant = await page.evaluate(() => scrollY);
    const surveillance = await surveillerRechargement(page);
    await logo.click({ modifiers: ["ControlOrMeta"] });
    // Le navigateur ouvre un nouvel onglet : la page courante ne bouge pas.
    await expect(page).toHaveURL((u) => u.pathname === "/" && u.hash === "");
    expect(await page.evaluate(() => scrollY)).toBe(avant);
    await surveillance.verifier();
  });

  test("Parcours étape 2 : Précédent après l'ancre ramène en haut de page", async ({
    page,
    isMobile,
  }) => {
    await ouvrir(page);
    if (isMobile) {
      // Pas de navigation sous 768px : on arrive sur l'ancre par l'adresse.
      await page.goto("/#fonctionnement");
    } else {
      await page.getByRole("link", { name: "Fonctionnement", exact: true }).click();
    }
    await expect(page).toHaveURL(/#fonctionnement$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  });
});
