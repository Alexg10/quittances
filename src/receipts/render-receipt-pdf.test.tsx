// @vitest-environment node
//
// Sous jsdom (l'environnement par défaut du projet), @react-pdf/renderer ne lève
// aucune erreur mais produit une page SANS AUCUN TEXTE. Ces tests tournent donc
// dans l'environnement `node`, et le premier test (« témoin ») échoue clairement
// si le texte extrait est vide, au lieu de laisser passer des assertions faites
// sur une chaîne vide.
import { beforeAll, describe, expect, it, vi } from "vitest";

// `server-only` lève une erreur à l'import hors d'un composant serveur de Next ;
// sous Vitest on le remplace par un module vide.
vi.mock("server-only", () => ({}));

import {
  QUITTANCE_TYPE,
  TEXTES_CA14,
  quittanceMaximale,
  sansEspace,
} from "../test-support/receipt-snapshots";
import { normalizeSpaces, readPdf, stripSpaces, type PdfContent } from "../test-support/read-pdf";
import { renderReceiptPdf } from "./render-receipt-pdf";
import type { ReceiptSnapshot } from "./receipt-snapshot";

// Instant de production fourni (avec des secondes, pour que la date de création
// ne se confonde pas avec une date arrondie), et horloges de la machine, toutes
// deux différentes de lui : la date de création ne doit venir que du premier.
const PRODUIT_LE = new Date("2026-01-12T10:30:45Z");
const HORLOGE_1 = new Date("2031-06-15T08:00:00Z");
const HORLOGE_2 = new Date("2044-12-31T23:59:59Z");

// Rend un PDF en ne figeant que `Date` : les temporisations de la bibliothèque
// continuent de tourner (un `vi.useFakeTimers()` complet bloquerait le rendu).
async function rendre(snapshot: ReceiptSnapshot, producedAt: Date, horloge: Date): Promise<PdfContent> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(horloge);
  try {
    return await readPdf(await renderReceiptPdf(snapshot, producedAt));
  } finally {
    vi.useRealTimers();
  }
}

// 20 mm et 25 mm en points (1 pt = 1/72 pouce) ; A4 = 210 × 297 mm.
const MARGE = (20 / 25.4) * 72;
const ESPACE_SIGNATURE = (25 / 25.4) * 72;
const A4 = { width: (210 / 25.4) * 72, height: (297 / 25.4) * 72 };

const RESERVE =
  "La présente quittance ne libère le locataire que pour la période indiquée. Elle ne vaut pas quittance des loyers et des charges des périodes antérieures.";

// Les textes d'une quittance aux montants maximaux et à la période de la quittance
// type, dans l'ordre du document, écrits d'après R27 (et non lus dans le code).
function textesAttendusMaximaux(s: ReceiptSnapshot): string[] {
  return [
    "Quittance de loyer",
    "Janvier 2026",
    "Référence 2026-01-3F9A1C2E",
    "Bailleur",
    s.landlordName,
    s.landlordAddress,
    s.landlordAddressComplement ?? "",
    `75002 ${s.landlordCity}`,
    "Locataire",
    s.tenantName,
    "Logement loué",
    s.rentalAddress,
    s.rentalAddressComplement ?? "",
    `69003 ${s.rentalCity}`,
    "Période",
    "Du 15/01/2026 au 31/01/2026",
    "Loyer hors charges",
    "99 999,99 €",
    "Provisions pour charges",
    "99 999,99 €",
    "Total",
    "199 999,98 €",
    `Reçu de ${s.tenantName} la somme de 199 999,98 € au titre du loyer et des charges du logement désigné ci-dessus, pour la période du 15/01/2026 au 31/01/2026. Le bailleur en donne quittance au locataire.`,
    "Paiement reçu le 20/01/2026",
    `Fait à ${s.landlordCity}, le 12/10/2026`,
    "Le bailleur",
    s.landlordName,
    RESERVE,
  ];
}

// Les éléments de texte d'une page tiennent dans les marges de 20 mm (à un point
// près : la largeur mesurée par pdf.js n'est pas celle de la mise en page).
function verifierDansLesMarges(pdf: PdfContent) {
  for (const item of pdf.items) {
    expect(item.x, `« ${item.str.slice(0, 20)} » déborde à gauche`).toBeGreaterThanOrEqual(MARGE - 1);
    expect(item.x + item.width, `« ${item.str.slice(0, 20)} » déborde à droite`).toBeLessThanOrEqual(
      A4.width - MARGE + 1,
    );
    expect(item.y, `« ${item.str.slice(0, 20)} » déborde en bas`).toBeGreaterThanOrEqual(MARGE - 1);
    expect(item.y, `« ${item.str.slice(0, 20)} » déborde en haut`).toBeLessThanOrEqual(A4.height - MARGE + 1);
  }
}

// R27 bloc 11 : au moins 25 mm entre le nom du bailleur (bloc 11) et la mention de
// réserve qui le suit.
function verifierEspaceDeSignature(pdf: PdfContent) {
  const reserve = pdf.items.findIndex((i) => i.str.startsWith("La présente quittance"));
  expect(reserve).toBeGreaterThan(0);
  const nom = pdf.items[reserve - 1];
  const hautDeLaReserve = pdf.items[reserve].y + pdf.items[reserve].fontSize;
  expect(nom.y - hautDeLaReserve).toBeGreaterThanOrEqual(ESPACE_SIGNATURE - 1);
}

describe("renderReceiptPdf — la quittance type (CA15, CA18)", () => {
  let type: PdfContent;
  let secondRendu: PdfContent;

  beforeAll(async () => {
    type = await rendre(QUITTANCE_TYPE, PRODUIT_LE, HORLOGE_1);
    secondRendu = await rendre(QUITTANCE_TYPE, PRODUIT_LE, HORLOGE_2);
  });

  it("témoin 1 — l'environnement des tests est `node`, pas jsdom", () => {
    expect(typeof window, "environnement jsdom : déclarer l'environnement node en tête de fichier").toBe("undefined");
  });

  it("témoin 2 — le PDF rendu contient du texte (sous jsdom, il n'en contiendrait aucun)", () => {
    expect(
      normalizeSpaces(type.text).length,
      "Le PDF ne contient aucun texte : le rendu a eu lieu sous jsdom",
    ).toBeGreaterThan(200);
  });

  it("CA15 — une seule page, au format A4 portrait", () => {
    expect(type.pageCount).toBe(1);
    expect(type.pageSizes[0].width).toBeCloseTo(A4.width, 0);
    expect(type.pageSizes[0].height).toBeCloseTo(A4.height, 0);
    expect(type.pageSizes[0].height).toBeGreaterThan(type.pageSizes[0].width);
  });

  it("CA15 — le texte extrait contient tous les textes de CA14, dans l'ordre, la mention de réserve en dernier", () => {
    const texte = normalizeSpaces(type.text);
    let position = 0;
    for (const attendu of TEXTES_CA14) {
      const trouve = texte.indexOf(normalizeSpaces(attendu), position);
      expect(trouve, `« ${attendu.slice(0, 40)} » introuvable après la position ${position}`).toBeGreaterThanOrEqual(0);
      position = trouve + normalizeSpaces(attendu).length;
    }
    expect(texte.endsWith(normalizeSpaces(RESERVE))).toBe(true);
  });

  it("CA15 — le document ne contient rien d'autre que les textes de CA14", () => {
    expect(normalizeSpaces(type.text)).toBe(normalizeSpaces(TEXTES_CA14.join(" ")));
  });

  it("R27 — les montants sont lus avec une espace et le symbole €, y compris le total", () => {
    expect(normalizeSpaces(type.text)).toContain("Loyer hors charges 425,50 € Provisions pour charges 0,00 € Total 425,50 €");
  });

  it("CA15 — les métadonnées : titre, auteur, application, langue, date de création", () => {
    expect(type.info.title).toBe("Quittance de loyer, janvier 2026");
    expect(type.info.author).toBe("Marie Durand");
    expect(type.info.creator).toBe("Quittances");
    expect(type.language).toBe("fr-FR");
    expect(type.creationDate?.toISOString()).toBe(PRODUIT_LE.toISOString());
  });

  it("R30 — la date de création est l'instant fourni, jamais l'horloge de la machine", () => {
    expect(type.creationDate?.getUTCFullYear()).toBe(2026);
    expect(type.creationDate?.getTime()).not.toBe(HORLOGE_1.getTime());
  });

  it("R30 — la date de création suit l'instant fourni quand il change (témoin)", () => {
    return rendre(QUITTANCE_TYPE, new Date("2026-02-01T00:00:00Z"), HORLOGE_1).then((autre) => {
      expect(autre.creationDate?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    });
  });

  it("R30 — ni sujet ni mots-clés", () => {
    expect(type.info.subject ?? "").toBe("");
    expect(type.info.keywords ?? "").toBe("");
  });

  it("R30 — le nom du locataire ne figure dans aucune métadonnée", () => {
    const metadonnees = [type.info.title, type.info.author, type.info.subject, type.info.keywords, type.info.creator, type.info.producer, type.language];
    expect(metadonnees.join("\n")).not.toContain("Paul Martin");
    expect(metadonnees.join("\n")).not.toContain("Martin");
  });

  it("CA15 — ni adresse e-mail ni « quittances.test » dans le texte", () => {
    expect(type.text).not.toContain("quittances.test");
    expect(type.text).not.toMatch(/\S+@\S+/);
  });

  it("R29 — toutes les polices sont incorporées, et ce sont celles du design system", () => {
    expect(type.fonts.length).toBeGreaterThan(0);
    expect(type.fonts.filter((f) => !f.embedded).map((f) => f.name)).toEqual([]);
    const noms = type.fonts.map((f) => f.name).sort();
    expect(noms).toEqual(["DMSans-Medium", "DMSans-Regular", "PlusJakartaSans-Bold"]);
  });

  it("R29 — aucune police standard (Helvetica, Times, Courier) dans le fichier", () => {
    expect(type.fonts.map((f) => f.name).join(" ")).not.toMatch(/Helvetica|Times|Courier|Arial/);
  });

  it("R28 — tout le texte est dans les marges de 20 mm", () => {
    verifierDansLesMarges(type);
  });

  it("R27 — la mention de réserve est le dernier bloc, au pied de la page, dans un corps plus petit que le texte courant", () => {
    const reserve = type.items.filter((i) => i.str.startsWith("La présente") || i.str.startsWith("périodes antérieures"));
    const courant = type.items.find((i) => i.str === "Paiement reçu le 20/01/2026");
    expect(reserve.length).toBeGreaterThan(0);
    expect(courant).toBeDefined();
    for (const ligne of reserve) {
      expect(ligne.fontSize).toBeLessThan(courant!.fontSize);
    }
    const plusBas = Math.min(...type.items.map((i) => i.y));
    expect(Math.min(...reserve.map((i) => i.y))).toBe(plusBas);
  });

  it("R27 — au moins 25 mm d'espace entre le nom du bailleur (signature) et la mention de réserve", () => {
    verifierEspaceDeSignature(type);
  });

  it("R28 — le mois sous le titre est dessiné dans un corps plus petit que le titre", () => {
    const titre = type.items.find((i) => i.str === "Quittance de loyer");
    const mois = type.items.find((i) => i.str === "Janvier 2026");
    expect(titre!.fontSize).toBeGreaterThan(mois!.fontSize);
    expect(titre!.y).toBeGreaterThan(mois!.y);
  });

  it("CA18 — deux rendus à des horloges différentes, au même instant de production : même texte, même nombre de pages, mêmes métadonnées, même date de création", () => {
    expect(secondRendu.text).toBe(type.text);
    expect(secondRendu.pageCount).toBe(type.pageCount);
    expect(secondRendu.info).toEqual(type.info);
    expect(secondRendu.language).toBe(type.language);
    expect(secondRendu.creationDate?.toISOString()).toBe(type.creationDate?.toISOString());
  });

  it("CA18 — témoin : deux quittances différentes donnent des textes différents", async () => {
    const autre = await rendre(
      { ...QUITTANCE_TYPE, tenantName: "Julie Petit", month: "2026-02", periodStart: "2026-02-01", periodEnd: "2026-02-28" },
      PRODUIT_LE,
      HORLOGE_1,
    );
    expect(autre.text).not.toBe(type.text);
    expect(autre.text).toContain("Julie Petit");
    expect(autre.info.title).toBe("Quittance de loyer, février 2026");
  });

  it("R27 — le complément du bailleur apparaît quand il existe (et la ligne reste absente sinon)", async () => {
    const avec = await rendre({ ...QUITTANCE_TYPE, landlordAddressComplement: "Escalier 2" }, PRODUIT_LE, HORLOGE_1);
    const lignes = avec.items.map((i) => i.str);
    const adresse = lignes.indexOf("3 rue de la Paix");
    expect(lignes.slice(adresse, adresse + 3)).toEqual(["3 rue de la Paix", "Escalier 2", "75002 Paris"]);
    expect(type.items.map((i) => i.str)).not.toContain("Escalier 2");
  });

  it("R27 — « Provisions pour charges » figure sur une quittance à 1 250,50 € de loyer et 50,00 € de charges, avec les montants à droite", async () => {
    const pdf = await rendre({ ...QUITTANCE_TYPE, rentInCents: 125050, chargesInCents: 5000 }, PRODUIT_LE, HORLOGE_1);
    expect(normalizeSpaces(pdf.text)).toContain("Loyer hors charges 1 250,50 € Provisions pour charges 50,00 € Total 1 300,50 €");
    const montant = pdf.items.find((i) => normalizeSpaces(i.str) === "1 250,50 €");
    expect(montant!.x + montant!.width).toBeCloseTo(A4.width - MARGE, 0);
  });
});

describe("renderReceiptPdf — longueurs maximales (CA16, R28)", () => {
  // Caractères larges et étroits ; « Œ » est hors ASCII.
  it.each(["W", "Œ", "i", "x"])(
    "CA16 — tous les textes à leur longueur maximale en « %s », sans espace : une page, tout est retrouvé, aucun trait d'union",
    async (lettre) => {
      const base = quittanceMaximale(lettre);
      // Le nom du locataire contient des caractères que l'on ne doit pas interpréter.
      const snapshot: ReceiptSnapshot = { ...base, tenantName: `<b>&(x)\\%${sansEspace(lettre, 91)}` };
      expect([...snapshot.tenantName]).toHaveLength(100);

      const pdf = await rendre(snapshot, PRODUIT_LE, HORLOGE_1);
      expect(pdf.pageCount).toBe(1);

      const sansEspaces = stripSpaces(pdf.text);
      // Chaque texte figé en entier.
      for (const texte of [
        snapshot.landlordName,
        snapshot.landlordAddress,
        snapshot.landlordAddressComplement!,
        snapshot.landlordCity,
        snapshot.tenantName,
        snapshot.rentalAddress,
        snapshot.rentalAddressComplement!,
        snapshot.rentalCity,
      ]) {
        expect(sansEspaces, `texte de ${texte.length} caractères en « ${lettre} »`).toContain(texte);
      }
      expect(sansEspaces).toContain("<b>&(x)\\%");
      expect(sansEspaces.split("99999,99€")).toHaveLength(3); // exactement deux occurrences
      expect(sansEspaces).toContain("199999,98€");
      expect(sansEspaces).toContain(stripSpaces(RESERVE));

      // Rien de plus, rien de moins : le texte entier, une fois les espaces retirées,
      // est celui de la spécification. Un trait d'union ajouté ferait échouer ceci.
      expect(sansEspaces).toBe(stripSpaces(textesAttendusMaximaux(snapshot).join(" ")));
      expect(pdf.text).not.toMatch(/[A-Za-zŒ]-\s*\n\s*[A-Za-zŒ]/);

      verifierDansLesMarges(pdf);
      verifierEspaceDeSignature(pdf);
    },
    60_000,
  );

  it("CA16 — les montants maximaux ne sont jamais coupés : chacun tient sur une seule ligne", async () => {
    const pdf = await rendre(quittanceMaximale("W"), PRODUIT_LE, HORLOGE_1);
    const lignes = pdf.items.map((i) => normalizeSpaces(i.str));
    expect(lignes.filter((l) => l === "99 999,99 €")).toHaveLength(2);
    expect(lignes).toContain("199 999,98 €");
  });

  it("R28 — le titre et les libellés fixes ne sont pas altérés aux longueurs maximales", async () => {
    const pdf = await rendre(quittanceMaximale("x"), PRODUIT_LE, HORLOGE_1);
    const lignes = pdf.items.map((i) => i.str);
    for (const fixe of ["Quittance de loyer", "Janvier 2026", "Bailleur", "Locataire", "Logement loué", "Période", "Le bailleur"]) {
      expect(lignes).toContain(fixe);
    }
  });
});

describe("renderReceiptPdf — caractères affichables (CA17, R17)", () => {
  // L'ensemble garanti par R17, moins les quinze caractères exclus par la précision
  // de tête, sans l'espace (qui n'a pas de trace dans le texte extrait).
  const EXCLUS = new Set([..."ĈĉĜĝĤĥĴĵĸŉŜŝŦŧſ"]);
  const garantis: string[] = [];
  const ajouter = (premier: number, dernier: number, sauf: number[] = []) => {
    for (let cp = premier; cp <= dernier; cp += 1) {
      const c = String.fromCodePoint(cp);
      if (!sauf.includes(cp) && !EXCLUS.has(c)) garantis.push(c);
    }
  };
  ajouter(0x21, 0x7e);
  ajouter(0xa1, 0xff, [0xad]);
  ajouter(0x100, 0x17f);
  garantis.push(..."‘’“”–—…€");

  it("CA17 — l'ensemble à tester compte 94 + 94 + 113 + 8 caractères", () => {
    expect(garantis).toHaveLength(309);
  });

  it("CA17 — un PDF qui contient chaque caractère garanti les retrouve tous dans son texte extrait", async () => {
    // Quatre morceaux de 100 caractères au plus, répartis dans quatre textes
    // figés dont la borne est de 100 caractères (R1 et spécification 03).
    const morceaux = [0, 1, 2, 3].map((i) => garantis.slice(i * 100, i * 100 + 100).join(""));
    const snapshot: ReceiptSnapshot = {
      ...QUITTANCE_TYPE,
      landlordName: morceaux[0],
      landlordCity: morceaux[1],
      tenantName: morceaux[2],
      rentalCity: morceaux[3],
    };
    const pdf = await rendre(snapshot, PRODUIT_LE, HORLOGE_1);
    expect(pdf.pageCount).toBe(1);
    const extrait = stripSpaces(pdf.text);
    const manquants = garantis.filter((c) => !extrait.includes(c));
    expect(manquants.map((c) => `${c} U+${c.codePointAt(0)!.toString(16)}`)).toEqual([]);
    // Et dans l'ordre, morceau par morceau.
    for (const morceau of morceaux) {
      expect(extrait).toContain(morceau);
    }
  }, 60_000);

  it("CA17 — « µ » et « œ » ne sont pas transformés à l'extraction", async () => {
    const pdf = await rendre({ ...QUITTANCE_TYPE, tenantName: "Zoé µ Œuvre œuf Ÿ" }, PRODUIT_LE, HORLOGE_1);
    expect(normalizeSpaces(pdf.text)).toContain("Reçu de Zoé µ Œuvre œuf Ÿ la somme");
  });
});
