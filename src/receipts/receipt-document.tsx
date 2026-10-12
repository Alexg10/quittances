// Le document PDF d'une quittance (R27 à R30 de la spécification 04).
//
// Les composants de @react-pdf/renderer ressemblent à ceux de React (Document,
// Page, View, Text) mais ne produisent pas du HTML : ils décrivent un fichier PDF.
// Ce module ne doit être importé que par du code serveur : la bibliothèque pèse
// lourd et n'a rien à faire dans le JavaScript envoyé au navigateur.
import "server-only";

import path from "node:path";

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { ReceiptContent, ReceiptLabeledBlock } from "./receipt-content";

// Polices incorporées au fichier (R29), lues dans le dépôt : produire un PDF ne
// dépend d'aucun service extérieur. Licence SIL OFL 1.1, voir ./fonts.
const FONTS_DIRECTORY = path.join(process.cwd(), "src", "receipts", "fonts");

export const TITLE_FONT = "Plus Jakarta Sans";
export const TEXT_FONT = "DM Sans";

Font.register({
  family: TITLE_FONT,
  fonts: [
    {
      src: path.join(FONTS_DIRECTORY, "PlusJakartaSans-Bold.ttf"),
      fontWeight: 700,
    },
  ],
});
Font.register({
  family: TEXT_FONT,
  fonts: [
    { src: path.join(FONTS_DIRECTORY, "DMSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS_DIRECTORY, "DMSans-Medium.ttf"), fontWeight: 500 },
  ],
});

// Plus aucune césure automatique : les mots trop longs sont coupés avant, par
// receipt-text-layout, sans trait d'union (R28).
function keepWordsWhole(word: string): string[] {
  return [word];
}

// R28 : A4 de 595,28pt de large, marges de 20mm (56,69pt) de chaque côté. Largeur
// d'une ligne de texte, en points. Sert à couper les mots trop longs.
export const CONTENT_WIDTH = 595.28 - 2 * 56.69;

// Corps du texte courant, en points, à l'échelle 1.
export const BODY_FONT_SIZE = 10;

// R28 : A4 portrait, marges de 20mm, noir sur blanc, aucune couleur. `scale`
// réduit tous les corps et tous les espacements quand les textes sont si longs
// qu'ils ne tiendraient pas sur une page (voir render-receipt-pdf). L'espace de
// signature ne se réduit jamais : R27 en exige 25mm au moins.
function createStyles(scale: number) {
  const size = (points: number) => points * scale;
  return StyleSheet.create({
    page: {
      paddingTop: "20mm",
      paddingBottom: "20mm",
      paddingHorizontal: "20mm",
      fontFamily: TEXT_FONT,
      fontWeight: 400,
      fontSize: size(BODY_FONT_SIZE),
      lineHeight: 1.3,
    },
    title: {
      fontFamily: TITLE_FONT,
      fontWeight: 700,
      fontSize: size(22),
      lineHeight: 1.2,
    },
    month: { fontWeight: 500, fontSize: size(13), marginTop: size(2) },
    reference: { fontSize: size(9), marginTop: size(6) },
    block: { marginTop: size(10) },
    label: { fontWeight: 500, fontSize: size(9), marginBottom: size(2) },
    detail: { marginTop: size(10) },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: size(2),
    },
    // `flexShrink: 0` : le montant garde sa largeur, il ne se coupe jamais ;
    // c'est le libellé qui cède la place.
    amount: { flexShrink: 0, marginLeft: size(12) },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: size(3),
      marginTop: size(2),
      borderTopWidth: 0.75,
      borderTopStyle: "solid",
      borderTopColor: "#000000",
      fontWeight: 500,
    },
    paragraph: { marginTop: size(10) },
    signature: { marginTop: size(10) },
    // R27 : un espace vide d'au moins 25mm pour signer à la main.
    signatureSpace: { height: "25mm" },
    // Pousse la mention de réserve en pied de page.
    filler: { flexGrow: 1, minHeight: size(8) },
    reserve: { fontSize: size(8), lineHeight: 1.3 },
  });
}

type Styles = ReturnType<typeof createStyles>;

function LabeledBlock({
  block,
  styles,
}: {
  block: ReceiptLabeledBlock;
  styles: Styles;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{block.label}</Text>
      {block.lines.map((line, index) => (
        <Text key={index} hyphenationCallback={keepWordsWhole}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function ReceiptDocument({
  content,
  producedAt,
  scale = 1,
}: {
  content: ReceiptContent;
  // Instant de production : la date de création du fichier (R30). Jamais
  // l'instant du téléchargement.
  producedAt: Date;
  // Échelle des corps et des espacements, de 1 (normal) à moins.
  scale?: number;
}) {
  const { metadata } = content;
  const styles = createStyles(scale);
  return (
    <Document
      title={metadata.title}
      author={metadata.author}
      creator={metadata.application}
      producer={metadata.application}
      language={metadata.language}
      creationDate={producedAt}
    >
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.month}>{content.month}</Text>
        </View>
        <Text style={styles.reference}>{content.reference}</Text>

        <LabeledBlock block={content.landlord} styles={styles} />
        <LabeledBlock block={content.tenant} styles={styles} />
        <LabeledBlock block={content.rental} styles={styles} />
        <LabeledBlock block={content.period} styles={styles} />

        <View style={styles.detail}>
          {content.details.map((row, index) => {
            const isTotal = index === content.details.length - 1;
            return (
              <View key={row.label} style={isTotal ? styles.totalRow : styles.row}>
                <Text hyphenationCallback={keepWordsWhole}>{row.label}</Text>
                <Text style={styles.amount}>{row.amount}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.paragraph} hyphenationCallback={keepWordsWhole}>
          {content.attestation}
        </Text>
        <Text style={styles.paragraph}>{content.payment}</Text>
        <Text style={styles.paragraph} hyphenationCallback={keepWordsWhole}>
          {content.place}
        </Text>

        <View style={styles.signature}>
          <Text style={styles.label}>{content.signature.label}</Text>
          <Text hyphenationCallback={keepWordsWhole}>
            {content.signature.name}
          </Text>
          <View style={styles.signatureSpace} />
        </View>

        <View style={styles.filler} />
        <Text style={styles.reserve}>{content.reserve}</Text>
      </Page>
    </Document>
  );
}
