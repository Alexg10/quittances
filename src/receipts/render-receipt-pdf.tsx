// Production du fichier PDF d'une quittance (R28 à R31 de la spécification 04).
// Fonction serveur : elle ne relit rien, ni la location ni les informations du
// bailleur. Le fichier est reconstruit, à chaque appel, à partir des seules
// valeurs figées de la quittance.
import "server-only";

import { Font, renderToBuffer } from "@react-pdf/renderer";

import { buildReceiptContent, type ReceiptContent } from "./receipt-content";
import {
  BODY_FONT_SIZE,
  CONTENT_WIDTH,
  ReceiptDocument,
  TEXT_FONT,
} from "./receipt-document";
import type { ReceiptSnapshot } from "./receipt-snapshot";
import { breakLongWords, type MeasureCharacter } from "./receipt-text-layout";

// R28 : le document tient sur une seule page, même aux longueurs maximales. Si les
// textes sont trop longs pour le corps normal, on réduit les corps et les
// espacements d'un cran, jusqu'à ce que tout tienne. Le dernier cran est le
// plancher : au-dessous, le texte ne serait plus lisible une fois imprimé.
const SCALES = [1, 0.92, 0.84, 0.76, 0.68];

// Marge de sécurité sur la largeur d'une ligne : la somme des largeurs de
// caractères ignore le crénage et les ligatures.
const SAFETY_FACTOR = 0.97;

// Nombre de pages lu dans l'arbre des pages du fichier (`/Type /Pages`, puis
// `/Count`). Ces objets ne sont pas compressés dans les fichiers de la
// bibliothèque.
function countPages(pdf: Buffer): number {
  const match = /\/Type \/Pages\s+\/Count (\d+)/.exec(pdf.toString("latin1"));
  return match === null ? Number.POSITIVE_INFINITY : Number(match[1]);
}

// Largeur d'un caractère en DM Sans 400, mesurée dans le fichier de police
// incorporé : la même que celle que la bibliothèque utilisera pour dessiner.
async function createMeasure(scale: number): Promise<MeasureCharacter> {
  const descriptor = { fontFamily: TEXT_FONT, fontWeight: 400 } as const;
  await Font.load(descriptor);
  const font = Font.getFont(descriptor).data;
  if (font === null) {
    throw new Error("Police du document non chargée.");
  }
  const fontSize = BODY_FONT_SIZE * scale;
  return (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      (font.glyphForCodePoint(codePoint).advanceWidth / font.unitsPerEm) *
      fontSize
    );
  };
}

// R28 : coupe, sans trait d'union, les mots saisis qui ne tiennent pas sur une
// ligne. Seuls les textes saisis sont concernés ; titre, libellés et montants
// sont fixes ou courts.
function withBrokenLongWords(
  content: ReceiptContent,
  measure: MeasureCharacter,
): ReceiptContent {
  const maxWidth = CONTENT_WIDTH * SAFETY_FACTOR;
  const brk = (text: string) => breakLongWords(text, maxWidth, measure);
  return {
    ...content,
    landlord: { ...content.landlord, lines: content.landlord.lines.map(brk) },
    tenant: { ...content.tenant, lines: content.tenant.lines.map(brk) },
    rental: { ...content.rental, lines: content.rental.lines.map(brk) },
    attestation: brk(content.attestation),
    place: brk(content.place),
    signature: { ...content.signature, name: brk(content.signature.name) },
  };
}

// `producedAt` est l'instant de production de la quittance, enregistré avec elle :
// c'est la date de création du fichier. On ne lit jamais l'horloge ici, pour que
// deux téléchargements de la même quittance portent les mêmes métadonnées.
export async function renderReceiptPdf(
  receipt: ReceiptSnapshot,
  producedAt: Date,
): Promise<Buffer> {
  const content = buildReceiptContent(receipt);
  let pdf: Buffer | null = null;
  for (const scale of SCALES) {
    const measure = await createMeasure(scale);
    pdf = await renderToBuffer(
      <ReceiptDocument
        content={withBrokenLongWords(content, measure)}
        producedAt={producedAt}
        scale={scale}
      />,
    );
    if (countPages(pdf) === 1) {
      return pdf;
    }
  }
  // Même au plancher, plusieurs pages : on ne livre pas un document qui n'est pas
  // une quittance d'une page (R28).
  throw new Error("La quittance ne tient pas sur une page.");
}
