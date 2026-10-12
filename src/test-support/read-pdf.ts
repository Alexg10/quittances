// Lecture d'un fichier PDF dans un test : texte, nombre de pages, taille de page,
// métadonnées et polices. Aide de test, réutilisable pour vérifier un PDF
// téléchargé (tests Vitest comme tests e2e).
//
// Bibliothèque : `unpdf`, qui embarque pdf.js (le lecteur PDF de Firefox) dans
// une version prête pour Node. Elle sert ici de « lecteur indépendant » : le
// fichier est relu par un autre programme que celui qui l'a écrit.
import { getDocumentProxy } from "unpdf";

export type PdfFont = {
  // Nom de police tel qu'écrit dans le fichier (`/BaseFont`), préfixe de
  // sous-ensemble (`ABCDEF+`) retiré.
  name: string;
  // Vrai si les dessins des caractères sont dans le fichier (`/FontFile…`).
  embedded: boolean;
};

// Un élément de texte posé sur une page : son texte, la position de son coin
// inférieur gauche (origine en bas à gauche de la page, en points) et sa largeur.
export type PdfTextItem = {
  page: number;
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
};

export type PdfContent = {
  pageCount: number;
  // Largeur et hauteur de chaque page, en points (1 pt = 1/72 pouce).
  pageSizes: Array<{ width: number; height: number }>;
  // Texte de toutes les pages, un élément de texte par ligne, dans l'ordre du
  // flux de dessin. Les espaces insécables sont conservées : voir `normalizeSpaces`.
  text: string;
  items: PdfTextItem[];
  info: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
  };
  // Langue du document (`/Lang` du catalogue), absente si non renseignée.
  language: string | null;
  // Date de création lue dans le fichier (`/CreationDate`), sans fuseau ambigu.
  creationDate: Date | null;
  fonts: PdfFont[];
};

// Remplace toute espace (insécable, fine insécable…) par une espace ordinaire et
// réduit les suites d'espaces et de sauts de ligne à une seule espace. C'est la
// forme que comparent les critères de la spécification pour les montants.
export function normalizeSpaces(text: string): string {
  return text.replace(/[\s  ]+/g, " ").trim();
}

// Retire toutes les espaces et tous les sauts de ligne (CA16 : un mot plus long
// que la ligne est coupé par une espace, qui n'est pas dans le texte figé).
export function stripSpaces(text: string): string {
  return text.replace(/[\s  ]+/g, "");
}

// `/CreationDate (D:20260112103000Z)` ou `D:20260112113000+01'00'`.
function parsePdfDate(raw: string | undefined): Date | null {
  if (raw === undefined) return null;
  const m = /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:(Z)|([+-])(\d{2})'?(\d{2})?'?)?/.exec(raw);
  if (m === null) return null;
  const [, y, mo, d, h, mi, s, z, sign, oh, om] = m;
  let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (z === undefined && sign !== undefined) {
    const offset = (Number(oh) * 60 + Number(om ?? 0)) * 60_000;
    ms -= sign === "+" ? offset : -offset;
  }
  return new Date(ms);
}

// Les polices, lues dans les objets du fichier. Les objets de la bibliothèque de
// production ne sont pas compressés ; un fichier dont les objets le seraient ne
// serait pas lisible ici, et la fonction échoue alors plutôt que de répondre
// « aucune police » (ce qui ferait passer un test à tort).
function readFonts(bytes: Uint8Array): PdfFont[] {
  const raw = Buffer.from(bytes).toString("latin1");
  if (/\/Type\s*\/ObjStm/.test(raw)) {
    throw new Error("Objets compressés : lecture des polices non prise en charge.");
  }
  const fonts = new Map<string, PdfFont>();
  // Descripteurs de police : /FontName et présence d'un fichier de police.
  const descriptors = raw.match(/<<(?:(?!>>\s*endobj)[\s\S])*?\/Type\s*\/FontDescriptor[\s\S]*?>>\s*endobj/g) ?? [];
  for (const block of descriptors) {
    const name = /\/FontName\s*\/([^\s/<>[\]()]+)/.exec(block)?.[1];
    if (name === undefined) continue;
    const clean = name.replace(/^[A-Z]{6}\+/, "");
    fonts.set(clean, { name: clean, embedded: /\/FontFile[23]?\s/.test(block) });
  }
  // Polices déclarées sans descripteur (police standard non incorporée).
  for (const m of raw.matchAll(/\/Type\s*\/Font\b[^>]*?\/BaseFont\s*\/([^\s/<>[\]()]+)/g)) {
    const clean = m[1].replace(/^[A-Z]{6}\+/, "");
    if (!fonts.has(clean) && !/Type0|CIDFont/.test(m[0])) {
      fonts.set(clean, { name: clean, embedded: false });
    }
  }
  return [...fonts.values()];
}

export async function readPdf(file: Uint8Array): Promise<PdfContent> {
  // pdf.js prend possession du tampon : on lui donne une copie.
  const pdf = await getDocumentProxy(new Uint8Array(file));
  const pageSizes: PdfContent["pageSizes"] = [];
  const lines: string[] = [];
  const items: PdfTextItem[] = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const [x0, y0, x1, y1] = page.view;
    pageSizes.push({ width: x1 - x0, height: y1 - y0 });
    // `disableNormalization` : sans lui, pdf.js transforme certains caractères
    // (« µ » devient « μ », les ligatures sont décomposées).
    const content = await page.getTextContent({ disableNormalization: true });
    for (const item of content.items) {
      if ("str" in item && item.str !== "") {
        lines.push(item.str);
        items.push({
          page: n,
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          fontSize: Math.abs(item.transform[3]),
        });
      }
    }
  }
  const meta = await pdf.getMetadata();
  const info = (meta.info ?? {}) as Record<string, unknown>;
  const str = (key: string) => (typeof info[key] === "string" ? (info[key] as string) : undefined);
  const result: PdfContent = {
    pageCount: pdf.numPages,
    pageSizes,
    text: lines.join("\n"),
    items,
    info: {
      title: str("Title"),
      author: str("Author"),
      subject: str("Subject"),
      keywords: str("Keywords"),
      creator: str("Creator"),
      producer: str("Producer"),
    },
    language: typeof info.Language === "string" ? (info.Language as string) : null,
    creationDate: parsePdfDate(str("CreationDate")),
    fonts: readFonts(file),
  };
  return result;
}
