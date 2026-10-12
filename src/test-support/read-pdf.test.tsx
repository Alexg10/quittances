// @vitest-environment node
//
// Le lecteur de PDF des tests est lui-même vérifié : un lecteur qui répondrait
// toujours « aucune police non incorporée » ferait passer à tort les tests du
// document. On lui donne donc un PDF qui utilise une police standard.
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { normalizeSpaces, readPdf, stripSpaces } from "./read-pdf";

async function pdfHelvetica(texte: string): Promise<Buffer> {
  return renderToBuffer(
    <Document title="Titre de test" author="Auteur de test" language="fr-FR">
      <Page size="A4">
        <Text>{texte}</Text>
      </Page>
    </Document>,
  );
}

describe("readPdf (aide de test)", () => {
  it("lit le texte, le nombre de pages et la taille de la page", async () => {
    const pdf = await readPdf(await pdfHelvetica("Bonjour le monde"));
    expect(pdf.text).toContain("Bonjour le monde");
    expect(pdf.pageCount).toBe(1);
    expect(pdf.pageSizes[0].width).toBeCloseTo(595.28, 0);
    expect(pdf.pageSizes[0].height).toBeCloseTo(841.89, 0);
  });

  it("lit les métadonnées", async () => {
    const pdf = await readPdf(await pdfHelvetica("x"));
    expect(pdf.info.title).toBe("Titre de test");
    expect(pdf.info.author).toBe("Auteur de test");
    expect(pdf.language).toBe("fr-FR");
    expect(pdf.creationDate).toBeInstanceOf(Date);
  });

  it("repère une police standard non incorporée (Helvetica)", async () => {
    const pdf = await readPdf(await pdfHelvetica("Bonjour"));
    expect(pdf.fonts.length).toBeGreaterThan(0);
    expect(pdf.fonts.some((f) => !f.embedded && /Helvetica/.test(f.name))).toBe(true);
  });

  it("ne transforme pas « µ » à l'extraction", async () => {
    const pdf = await readPdf(await pdfHelvetica("5 µm"));
    expect(pdf.text).toContain("µ");
  });

  it("compte les pages d'un document de plusieurs pages", async () => {
    const buffer = await renderToBuffer(
      <Document>
        <Page size="A4"><Text>Un</Text></Page>
        <Page size="A4"><Text>Deux</Text></Page>
      </Document>,
    );
    expect((await readPdf(buffer)).pageCount).toBe(2);
  });

  it("normalizeSpaces et stripSpaces traitent les espaces insécables", () => {
    expect(normalizeSpaces("1 250,50 €\n  fin")).toBe("1 250,50 € fin");
    expect(stripSpaces("1 250,50  €\nfin")).toBe("1250,50€fin");
  });
});
