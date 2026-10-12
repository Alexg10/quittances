import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { inscrire } from "./aide-comptes";
import { creerLocationArchivee } from "./aide-archives";
import { creerLocation } from "./aide-locations";
import { bailleurEnBase, creerQuittanceEnBase, surveillerConsole, valeursBailleur, WCAG } from "./aide-quittances";

// Accessibilité, rendu et clavier des pages de T4 et de T5 (CA41, CA42, CA43 ;
// R36). Les dates sont fixes et passées (R38).

const BAIL = { startDate: "2026-01-15", endDate: "2026-03-20" } as const;

async function analyser(page: Page, nom: string) {
  const r = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.nodes.length})`), nom).toEqual([]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  const niveaux = await page.getByRole("heading").evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
  niveaux.forEach((n, i) => {
    if (i > 0) expect(n - niveaux[i - 1], `${nom} : niveau de titre sauté`).toBeLessThanOrEqual(1);
  });
}

test.describe("Archivage : accessibilité, rendu, clavier", () => {
  test("CA41 : axe (WCAG 2.1 A et AA) sur /archives, le détail archivé, l'archivage, les deux suppressions et les quatre cas du détail actif", async ({
    page,
  }) => {
    const console_ = surveillerConsole(page);
    const { email } = await inscrire(page);
    await bailleurEnBase(email, valeursBailleur("ax"));
    await page.goto("/archives");
    await analyser(page, "archives vide");

    const enCours = await creerLocation(email, { startDate: "2026-01-15", endDate: null });
    const enCoursQ = await creerLocation(email, { startDate: "2026-01-15", endDate: null });
    const term = await creerLocation(email, BAIL);
    const termQ = await creerLocation(email, BAIL);
    await creerQuittanceEnBase(email, enCoursQ.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await creerQuittanceEnBase(email, termQ.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await creerQuittanceEnBase(email, termQ.id, { month: "2026-02" });
    for (const [nom, L] of [["en cours sans quittance", enCours], ["en cours avec quittance", enCoursQ], ["terminée sans quittance", term], ["terminée avec quittances", termQ]] as const) {
      await page.goto(`/locations/${L.id}`);
      await analyser(page, `détail actif ${nom}`);
    }
    await page.goto(`/locations/${termQ.id}/archiver`);
    await analyser(page, "archivage");
    await page.goto(`/locations/${term.id}/supprimer`);
    await analyser(page, "suppression d'une location active sans quittance");

    const a0 = await creerLocationArchivee(email);
    const a2 = await creerLocationArchivee(email, { addressComplement: "Bât. B" });
    await creerQuittanceEnBase(email, a2.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    await creerQuittanceEnBase(email, a2.id, { month: "2026-02" });
    await page.goto("/archives");
    await analyser(page, "archives remplie");
    await page.goto(`/locations/${a2.id}`);
    await analyser(page, "détail archivé");
    await page.goto(`/locations/${a2.id}/supprimer`);
    await analyser(page, "suppression d'une location archivée avec quittances");
    await page.goto(`/locations/${a0.id}/supprimer`);
    await analyser(page, "suppression d'une location archivée sans quittance");
    expect(console_).toEqual([]);
  });

  test("CA42 : valeurs au maximum de 320 à 1280px, aucun défilement horizontal, un seul bouton primaire, bouton destructif de la suppression", async ({
    page,
  }) => {
    const { email } = await inscrire(page);
    const longues = {
      address: "A".repeat(200),
      addressComplement: "C".repeat(100),
      city: "V".repeat(100),
      tenantName: "N".repeat(100),
      rentInCents: 9999999,
      chargesInCents: 9999999,
    };
    const active = await creerLocation(email, { ...BAIL, ...longues });
    const archivee = await creerLocationArchivee(email, longues);
    for (const L of [active, archivee]) {
      await creerQuittanceEnBase(email, L.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31", rentInCents: 9999999, chargesInCents: 9999999, tenantName: "N".repeat(100), rentalAddress: "A".repeat(200) });
    }
    const pages: [string, number][] = [
      [`/locations/${active.id}`, 1],
      [`/locations/${active.id}/archiver`, 1],
      [`/locations/${archivee.id}`, 0],
      [`/locations/${archivee.id}/supprimer`, 0],
      ["/archives", 0],
    ];
    for (const largeur of [320, 412, 768, 1280]) {
      await page.setViewportSize({ width: largeur, height: 900 });
      for (const [chemin, primaires] of pages) {
        await page.goto(chemin);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const [defilement, fenetre] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        expect(defilement, `${chemin} à ${largeur}px`).toBeLessThanOrEqual(fenetre);
        const n = await page.getByRole("main").locator("a, button").evaluateAll(
          (els) => els.filter((e) => getComputedStyle(e).backgroundColor === "rgb(79, 70, 229)").length,
        );
        expect(n, `${chemin} à ${largeur}px`).toBe(primaires);
        const form = page.locator("main form");
        if ((await form.count()) > 0) {
          expect(await form.first().evaluate((f) => f.getBoundingClientRect().width)).toBeLessThanOrEqual(640);
        }
      }
      await page.goto(`/locations/${archivee.id}/supprimer`);
      const supprimer = page.getByRole("button", { name: "Supprimer définitivement" });
      await expect(supprimer).toHaveCSS("border-top-color", "rgb(239, 68, 68)");
      await expect(supprimer).toHaveCSS("color", "rgb(185, 28, 28)");
      expect((await supprimer.boundingBox())!.height).toBe(44);
      // Les montants des quittances ne sont pas coupés.
      await page.goto(`/locations/${archivee.id}`);
      const montant = page.getByRole("listitem").getByText(/199.999,98.€/).first();
      await expect(montant).toBeVisible();
      const lignes = await montant.evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
      expect(lignes, `montant à ${largeur}px`).toBe(1);
    }
  });

  test("CA43 : parcours au clavier seul des pages de T4 et de T5, première tabulation sur le logo, indicateur de focus visible à chaque arrêt", async ({
    page,
  }) => {
    const { email } = await inscrire(page);
    await bailleurEnBase(email, valeursBailleur("kb"));
    const term = await creerLocation(email, BAIL);
    const q = await creerQuittanceEnBase(email, term.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });
    const archivee = await creerLocationArchivee(email);
    await creerQuittanceEnBase(email, archivee.id, { month: "2026-01", periodStart: "2026-01-15", periodEnd: "2026-01-31" });

    // Pour chaque page, les noms accessibles attendus dans l'ordre de tabulation (hors « Se déconnecter »).
    const parcours: [string, string[]][] = [
      ["/mes-informations", ["Quittances, tableau de bord", "Nom du bailleur", "Adresse", "Complément d'adresse (facultatif)", "Code postal", "Ville", "Enregistrer mes informations", "Annuler"]],
      [`/locations/${term.id}/quittances/nouvelle`, ["Quittances, tableau de bord", "Mois", "Loyer hors charges", "Charges", "Date du paiement", "Je confirme avoir reçu en totalité le loyer et les charges indiqués ci-dessus pour ce mois.", "Produire la quittance", "Annuler"]],
      [`/quittances/${q}/supprimer`, ["Quittances, tableau de bord", "Supprimer définitivement", "Annuler"]],
      [`/locations/${term.id}`, ["Quittances, tableau de bord", "Retour au tableau de bord", "Produire une quittance", "Télécharger la quittance, janvier 2026", "Supprimer la quittance, janvier 2026", "Modifier", "Modifier la fin de la location", "Archiver"]],
      [`/locations/${term.id}/archiver`, ["Quittances, tableau de bord", "Archiver la location", "Annuler"]],
      ["/archives", ["Quittances, tableau de bord", "Retour au tableau de bord", archivee.valeurs.address]],
      [`/locations/${archivee.id}`, ["Quittances, tableau de bord", "Retour aux archives", "Télécharger la quittance, janvier 2026", "Restaurer la location", "Supprimer définitivement"]],
      [`/locations/${archivee.id}/supprimer`, ["Quittances, tableau de bord", "Supprimer définitivement", "Annuler"]],
    ];
    for (const [chemin, attendus] of parcours) {
      await page.goto(chemin);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const vus: string[] = [];
      for (let i = 0; i < 30 && vus.length < attendus.length; i += 1) {
        await page.keyboard.press("Tab");
        const arret = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const s = getComputedStyle(el);
          const label = el.getAttribute("aria-label") ?? (el as HTMLInputElement).labels?.[0]?.textContent ?? el.textContent ?? "";
          return {
            nom: label.trim(),
            contour: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2,
            ombre: s.boxShadow !== "none",
            bordure: s.borderTopColor,
          };
        });
        // Un champ de date a plusieurs arrêts au clavier (jour, mois, année, calendrier) : un seul compte.
        if (arret.nom === "Se déconnecter" || arret.nom === vus[vus.length - 1]) continue;
        vus.push(arret.nom);
        expect(arret.contour || (arret.ombre && arret.bordure === "rgb(79, 70, 229)"), `${chemin} : focus visible sur « ${arret.nom} »`).toBe(true);
      }
      expect(vus.slice(0, attendus.length), chemin).toEqual(attendus);
    }
  });
});
