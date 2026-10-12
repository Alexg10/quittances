import { describe, expect, it, vi } from "vitest";

import {
  QUITTANCE_TYPE,
  TEXTES_CA14,
  quittanceMaximale,
} from "../test-support/receipt-snapshots";
import { buildReceiptContent, type ReceiptContent } from "./receipt-content";
import type { ReceiptSnapshot } from "./receipt-snapshot";

const RESERVE =
  "La présente quittance ne libère le locataire que pour la période indiquée. Elle ne vaut pas quittance des loyers et des charges des périodes antérieures.";

// Toute espace (insécable, fine insécable) devient une espace ordinaire : c'est la
// comparaison que la spécification demande pour les montants.
const espaces = (texte: string) => texte.replace(/[\s  ]/g, " ");

// Tous les textes affichés du document, hors métadonnées.
function tousLesTextes(c: ReceiptContent): string[] {
  return [
    c.title,
    c.month,
    c.reference,
    c.landlord.label,
    ...c.landlord.lines,
    c.tenant.label,
    ...c.tenant.lines,
    c.rental.label,
    ...c.rental.lines,
    c.period.label,
    ...c.period.lines,
    ...c.details.flatMap((d) => [d.label, d.amount]),
    c.attestation,
    c.payment,
    c.place,
    c.signature.label,
    c.signature.name,
    c.reserve,
  ].map(espaces);
}

describe("buildReceiptContent — la quittance type (CA14)", () => {
  const contenu = buildReceiptContent(QUITTANCE_TYPE);

  it("CA14 — bloc 1 : le titre, puis le mois sous le titre avec sa majuscule", () => {
    expect(contenu.title).toBe("Quittance de loyer");
    expect(contenu.month).toBe("Janvier 2026");
  });

  it("CA14 — bloc 2 : la référence", () => {
    expect(contenu.reference).toBe("Référence 2026-01-3F9A1C2E");
  });

  it("CA14 — bloc 3 : le bailleur, sans ligne de complément quand il n'y en a pas", () => {
    expect(contenu.landlord).toEqual({
      label: "Bailleur",
      lines: ["Marie Durand", "3 rue de la Paix", "75002 Paris"],
    });
  });

  it("R27 — bloc 3 : le complément du bailleur, quand il existe, vient entre l'adresse et le code postal", () => {
    const avec = buildReceiptContent({ ...QUITTANCE_TYPE, landlordAddressComplement: "Escalier 2" });
    expect(avec.landlord.lines).toEqual(["Marie Durand", "3 rue de la Paix", "Escalier 2", "75002 Paris"]);
  });

  it("CA14 — bloc 4 : le locataire", () => {
    expect(contenu.tenant).toEqual({ label: "Locataire", lines: ["Paul Martin"] });
  });

  it("CA14 — bloc 5 : le logement, avec son complément", () => {
    expect(contenu.rental).toEqual({
      label: "Logement loué",
      lines: ["12 rue des Lilas", "Bât. B", "69003 Lyon"],
    });
  });

  it("R27 — bloc 5 : le logement sans complément n'a pas de ligne vide", () => {
    const sans = buildReceiptContent({ ...QUITTANCE_TYPE, rentalAddressComplement: null });
    expect(sans.rental.lines).toEqual(["12 rue des Lilas", "69003 Lyon"]);
  });

  it("CA14 — bloc 6 : la période", () => {
    expect(contenu.period).toEqual({ label: "Période", lines: ["Du 15/01/2026 au 31/01/2026"] });
  });

  it("CA14 — bloc 7 : trois lignes, avec « Provisions pour charges » à 0,00 € et le total", () => {
    expect(contenu.details.map((d) => [d.label, espaces(d.amount)])).toEqual([
      ["Loyer hors charges", "425,50 €"],
      ["Provisions pour charges", "0,00 €"],
      ["Total", "425,50 €"],
    ]);
  });

  it("CA14 — bloc 8 : la phrase d'attestation, mot pour mot", () => {
    expect(espaces(contenu.attestation)).toBe(
      "Reçu de Paul Martin la somme de 425,50 € au titre du loyer et des charges du logement désigné ci-dessus, pour la période du 15/01/2026 au 31/01/2026. Le bailleur en donne quittance au locataire.",
    );
  });

  it("CA14 — bloc 9 : le paiement", () => {
    expect(contenu.payment).toBe("Paiement reçu le 20/01/2026");
  });

  it("CA14 — bloc 10 : le lieu (ville du bailleur) et la date d'émission", () => {
    expect(contenu.place).toBe("Fait à Paris, le 12/10/2026");
  });

  it("CA14 — bloc 11 : « Le bailleur » puis son nom", () => {
    expect(contenu.signature).toEqual({ label: "Le bailleur", name: "Marie Durand" });
  });

  it("CA14 — bloc 12 : la mention de réserve, mot pour mot", () => {
    expect(contenu.reserve).toBe(RESERVE);
  });

  it("CA14 — les métadonnées : titre en minuscules, auteur, application, langue", () => {
    expect(contenu.metadata).toEqual({
      title: "Quittance de loyer, janvier 2026",
      author: "Marie Durand",
      application: "Quittances",
      language: "fr-FR",
    });
  });

  it("CA14 — les textes de la spécification se retrouvent un à un, dans l'ordre", () => {
    const attendus = [...TEXTES_CA14];
    const obtenus = tousLesTextes(contenu);
    expect(obtenus).toEqual(attendus);
  });
});

describe("buildReceiptContent — ce que le document ne contient pas (R27)", () => {
  const instantane = {
    ...QUITTANCE_TYPE,
    // Ce que la location ou le compte savent, mais que la quittance ne copie pas (R6).
    tenantEmail: "paul.martin@quittances.test",
    ownerEmail: "marie@quittances.test",
    dueDay: 5,
    startDate: "2026-01-15",
    endDate: "2026-03-20",
  } as ReceiptSnapshot;
  const textes = tousLesTextes(buildReceiptContent(instantane));
  const tout = textes.join("\n");

  it("CA14 — aucune adresse e-mail", () => {
    expect(tout).not.toMatch(/@/);
    expect(tout).not.toContain("quittances.test");
  });

  it("CA14 — pas de jour d'échéance", () => {
    expect(tout).not.toMatch(/[ée]ch[ée]ance/i);
  });

  it("CA14 — aucun bloc ne contient le libellé « Charges » seul", () => {
    expect(textes).not.toContain("Charges");
    expect(tout).not.toMatch(/(^|\s)Charges(\s|$)/);
  });

  it("CA14 — pas de mention de l'application dans le texte affiché", () => {
    expect(tout).not.toMatch(/Quittances\b/);
  });

  it("CA14 — pas de numéro de page", () => {
    expect(tout).not.toMatch(/\bpage\b/i);
    expect(tout).not.toMatch(/\b1\s*\/\s*1\b/);
  });

  it("R27 — ni « Paiement locataire » ni « Solde à payer »", () => {
    expect(tout).not.toMatch(/Paiement locataire|Solde/);
  });

  it("R30 — le nom du locataire ne figure dans aucune métadonnée", () => {
    const meta = buildReceiptContent(instantane).metadata;
    expect(Object.values(meta).join("\n")).not.toContain("Paul Martin");
  });
});

describe("buildReceiptContent — montants (R16 de la spécification 03)", () => {
  it("R27 — sépare les milliers et garde deux décimales : 1 250,50 € et 50,00 €", () => {
    const c = buildReceiptContent({ ...QUITTANCE_TYPE, rentInCents: 125050, chargesInCents: 5000 });
    expect(c.details.map((d) => espaces(d.amount))).toEqual(["1 250,50 €", "50,00 €", "1 300,50 €"]);
  });

  it("R28 — aux maximums : 99 999,99 € deux fois et 199 999,98 € au total", () => {
    const c = buildReceiptContent(quittanceMaximale("a"));
    expect(c.details.map((d) => espaces(d.amount))).toEqual(["99 999,99 €", "99 999,99 €", "199 999,98 €"]);
    expect(espaces(c.attestation)).toContain("la somme de 199 999,98 € au titre");
  });

  it("R27 — « Provisions pour charges » figure même à zéro, et le total vaut alors le loyer", () => {
    const c = buildReceiptContent({ ...QUITTANCE_TYPE, rentInCents: 100, chargesInCents: 0 });
    expect(c.details.map((d) => d.label)).toContain("Provisions pour charges");
    expect(espaces(c.details[2].amount)).toBe("1,00 €");
  });

  it("R28 — un montant ne se coupe jamais : l'espace des milliers est insécable (aucune espace ordinaire dans le montant)", () => {
    const c = buildReceiptContent({ ...QUITTANCE_TYPE, rentInCents: 9_999_999 });
    expect(c.details[0].amount).not.toContain(" ");
    expect(c.details[0].amount).not.toContain(" ");
  });
});

describe("buildReceiptContent — le document ne dépend que de l'instantané (R6, R31)", () => {
  it("R31 — deux appels à des horloges différentes donnent le même contenu", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2030-05-05T10:00:00Z"));
      const premier = buildReceiptContent(QUITTANCE_TYPE);
      vi.setSystemTime(new Date("2041-11-30T23:59:59Z"));
      const second = buildReceiptContent(QUITTANCE_TYPE);
      expect(second).toEqual(premier);
    } finally {
      vi.useRealTimers();
    }
  });

  it("R6 — la période affichée vient des valeurs figées, pas du mois ni du bail", () => {
    const c = buildReceiptContent({ ...QUITTANCE_TYPE, periodStart: "2026-01-10", periodEnd: "2026-01-20" });
    expect(c.period.lines).toEqual(["Du 10/01/2026 au 20/01/2026"]);
    expect(espaces(c.attestation)).toContain("pour la période du 10/01/2026 au 20/01/2026.");
  });

  it("R6 — la date d'émission affichée est celle de l'instantané", () => {
    expect(buildReceiptContent({ ...QUITTANCE_TYPE, issueDate: "2027-02-28" }).place).toBe("Fait à Paris, le 28/02/2027");
  });

  it("R27 — « Fait à » reprend la ville du bailleur, pas celle du logement", () => {
    expect(buildReceiptContent({ ...QUITTANCE_TYPE, landlordCity: "Nantes" }).place).toBe("Fait à Nantes, le 12/10/2026");
  });

  it("R30 — deux quittances différentes donnent des contenus différents (témoin)", () => {
    const autre = buildReceiptContent({ ...QUITTANCE_TYPE, tenantName: "Julie Petit", month: "2026-02" });
    expect(autre).not.toEqual(buildReceiptContent(QUITTANCE_TYPE));
    expect(autre.month).toBe("Février 2026");
  });

  it("R11 — le titre des métadonnées reprend le mois de rattachement en minuscules, même pour une période incomplète", () => {
    expect(buildReceiptContent(QUITTANCE_TYPE).metadata.title).toBe("Quittance de loyer, janvier 2026");
    expect(buildReceiptContent({ ...QUITTANCE_TYPE, month: "2026-08" }).metadata.title).toBe("Quittance de loyer, août 2026");
  });

  it("R27 — les textes saisis sont repris tels quels, <, &, parenthèses, barre oblique et % compris", () => {
    const c = buildReceiptContent({ ...QUITTANCE_TYPE, tenantName: "<b>&(x)\\%" });
    expect(c.tenant.lines).toEqual(["<b>&(x)\\%"]);
    expect(espaces(c.attestation)).toContain("Reçu de <b>&(x)\\% la somme");
  });
});
