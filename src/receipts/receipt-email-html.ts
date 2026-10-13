// Le gabarit HTML du message qui porte une quittance (R23 de la spécification
// 05). Fonction pure : le contenu (receipt-email-content.ts) entre, une chaîne
// HTML sort. Aucun import serveur.
//
// Pourquoi une chaîne construite à la main et pas un composant React. La
// spécification prévoyait d'abord React Email, puis, en repli, un composant
// rendu par `react-dom/server`. Les deux échouent ici : Next 16 refuse, au
// build, tout import de `react-dom/server` dans le code serveur de l'App Router
// (« You're importing a component that imports react-dom/server »), et
// `@react-email/components` est déclaré abandonné (deprecated) sur npm. Un
// gabarit de cinq paragraphes ne justifie ni dépendance ni contournement du
// bundler.
//
// Contraintes d'un e-mail, qui ne sont pas celles d'une page :
// - les messageries ignorent les feuilles de style et Tailwind : tous les styles
//   sont en ligne, la mise en page est un tableau ;
// - aucun contenu distant (image, police, feuille de style, lien, pixel de
//   suivi) : la police est celle du système.
import type { ReceiptEmailContent } from "./receipt-email-content";

// Remplace les cinq caractères que le HTML interprète. TOUTE valeur insérée
// dans le gabarit passe par ici : un nom « <script> » ou « & » s'affiche tel
// quel, il n'est jamais interprété (R23, CA30).
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Valeurs de DESIGN.md. Un e-mail ne peut pas lire les jetons Tailwind : elles
// sont répétées ici, nommées.
const COLORS = {
  background: "#FAFAFA",
  surface: "#FFFFFF",
  textPrimary: "#0A0A0A",
  textSecondary: "#6B6B6B",
  border: "#E8E8EC",
};

const FONT_FAMILY = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const BODY_STYLE = `margin:0;padding:24px 12px;background-color:${COLORS.background};font-family:${FONT_FAMILY};font-size:16px;line-height:24px;color:${COLORS.textPrimary}`;
const CARD_STYLE = `max-width:560px;background-color:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:8px;padding:24px`;
const PARAGRAPH_STYLE = "margin:0 0 16px 0";
const SECONDARY_STYLE = `margin:0 0 16px 0;font-size:14px;line-height:20px;color:${COLORS.textSecondary}`;

export function buildReceiptEmailHtml(content: ReceiptEmailContent): string {
  const details = content.details.map(escapeHtml).join("<br>");
  return [
    "<!DOCTYPE html>",
    '<html lang="fr">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(content.subject)}</title>`,
    "</head>",
    `<body style="${BODY_STYLE}">`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tbody><tr><td align="center">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${CARD_STYLE}"><tbody><tr><td>`,
    `<p style="${PARAGRAPH_STYLE}">${escapeHtml(content.greeting)}</p>`,
    `<p style="${PARAGRAPH_STYLE}">${escapeHtml(content.introduction)}<br>${escapeHtml(content.attachmentNote)}</p>`,
    `<p style="${PARAGRAPH_STYLE}">${details}</p>`,
    `<p style="${PARAGRAPH_STYLE}">${escapeHtml(content.replyNote)}</p>`,
    `<p style="${SECONDARY_STYLE}">${escapeHtml(content.reason)}</p>`,
    "</td></tr></tbody></table>",
    "</td></tr></tbody></table>",
    "</body>",
    "</html>",
  ].join("\n");
}
