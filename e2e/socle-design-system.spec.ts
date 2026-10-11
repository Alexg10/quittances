import { expect, test, type Page } from "@playwright/test";

// Socle du design system (spec 01, T1) : CA1 à CA7.
// Aucune assertion sur le contenu de la page, qui changera en T2 et T3.

const TITRE = "Quittances — quittances de loyer et relances par e-mail";
const DESCRIPTION =
  "Un e-mail le jour de l'échéance, vous confirmez le loyer reçu, et la quittance PDF ou la relance part chez votre locataire.";

type Rgba = [number, number, number, number];

/** Normalise #rgb, #rrggbb, #rrggbbaa et rgb()/rgba() en [r, g, b, a], l'alpha arrondi à 2 décimales. */
function versRgba(valeur: string): Rgba {
  const v = valeur.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    const a = h.length === 8 ? n(6) / 255 : 1;
    return [n(0), n(2), n(4), Math.round(a * 100) / 100];
  }
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], Math.round((p[3] ?? 1) * 100) / 100];
  }
  throw new Error(`Couleur non reconnue : ${valeur}`);
}

/** Normalise une ombre : couleurs en rgba, espaces et casse neutralisés. */
function normaliserOmbre(valeur: string): string {
  const couleur = valeur.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/i)?.[0] ?? "";
  const longueurs = valeur.replace(couleur, "").trim().split(/\s+/).join(" ");
  return `${longueurs} ${versRgba(couleur).join(",")}`;
}

/** Convertit "1.5rem" ou "24px" en pixels (base 16px). */
function enPixels(valeur: string): number {
  const v = valeur.trim().toLowerCase();
  return v.endsWith("rem") ? parseFloat(v) * 16 : parseFloat(v);
}

async function variable(page: Page, nom: string): Promise<string> {
  return page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n),
    nom,
  );
}

test.describe("Socle du design system", () => {
  test("CA1, CA2 : langue, titre et description du document", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page).toHaveTitle(TITRE);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      DESCRIPTION,
    );
  });

  test("CA3 : polices de body, du h1 et de --font-mono", async ({ page }) => {
    await page.goto("/");
    const polices = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector("h1")!).fontFamily,
    }));
    expect(polices.body).toMatch(/^"?DM Sans"?/);
    expect(polices.h1).toMatch(/^"?Plus Jakarta Sans"?/);
    expect(await variable(page, "--font-mono")).toMatch(/^\s*"?JetBrains Mono"?/);
  });

  test("CA3 : les polices affichées sont réellement chargées", async ({ page }) => {
    await page.goto("/");
    const chargees = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((f) => f.status === "loaded")
        .map((f) => f.family);
    });
    expect(chargees).toContain("Plus Jakarta Sans");
    expect(chargees).toContain("DM Sans");
  });

  test("CA4 : aucune requête vers les serveurs de Google Fonts", async ({ page }) => {
    const externes: string[] = [];
    page.on("request", (r) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) externes.push(r.url());
    });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    expect(externes).toEqual([]);
  });

  test("CA5 : couleurs, tailles de texte, ombres et familles exposées sur la racine", async ({
    page,
  }) => {
    await page.goto("/");

    const couleurs: Record<string, string> = {
      primary: "#4F46E5",
      "primary-hover": "#4338CA",
      neutral: "#9C9C9C",
      background: "#FAFAFA",
      surface: "#FFFFFF",
      "text-primary": "#0A0A0A",
      "text-secondary": "#6B6B6B",
      border: "#E8E8EC",
      success: "#10B981",
      warning: "#F59E0B",
      error: "#EF4444",
      "error-text": "#B91C1C",
    };
    for (const [nom, attendu] of Object.entries(couleurs)) {
      const lue = await variable(page, `--color-${nom}`);
      expect(lue, `--color-${nom}`).not.toBe("");
      expect(versRgba(lue), `--color-${nom}`).toEqual(versRgba(attendu));
    }

    const tailles: Record<string, number> = {
      display: 72,
      "display-md": 56,
      "display-sm": 40,
      headline: 60,
      title: 32,
      subtitle: 24,
      body: 15,
      small: 13,
      caption: 12,
      overline: 11,
    };
    for (const [nom, attendu] of Object.entries(tailles)) {
      const lue = await variable(page, `--text-${nom}`);
      expect(lue, `--text-${nom}`).not.toBe("");
      expect(enPixels(lue), `--text-${nom}`).toBe(attendu);
    }

    const ombres: Record<string, string> = {
      "card-hover": "0 8px 30px rgba(0,0,0,0.08)",
      "primary-glow": "0 4px 12px rgba(79,70,229,0.35)",
      focus: "0 0 0 3px rgba(79,70,229,0.12)",
    };
    for (const [nom, attendu] of Object.entries(ombres)) {
      const lue = await variable(page, `--shadow-${nom}`);
      expect(lue, `--shadow-${nom}`).not.toBe("");
      expect(normaliserOmbre(lue), `--shadow-${nom}`).toBe(normaliserOmbre(attendu));
    }
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`CA6, CA7 : fond, couleur et taille de body avec prefers-color-scheme ${scheme}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ colorScheme: scheme });
      const page = await context.newPage();
      await page.goto("/");
      const body = page.locator("body");
      await expect(body).toHaveCSS("background-color", "rgb(250, 250, 250)");
      await expect(body).toHaveCSS("color", "rgb(10, 10, 10)");
      await expect(body).toHaveCSS("font-size", "15px");
      await context.close();
    });
  }
});
