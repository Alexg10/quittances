// Écriture d'un message au format .eml (RFC 5322 et MIME), pour l'ouvrir dans un
// client de messagerie (R19 de la spécification 05). Fonction pure : la date et
// la frontière MIME sont passées en paramètre. Aucun import serveur.
import type { EmailAddress, EmailMessage } from "./email-message";

const LINE_BREAK = "\r\n";

type EmlOptions = {
  date: Date;
  // Texte qui sépare les parties MIME : il ne doit apparaître dans aucune.
  boundary: string;
};

// Un texte d'en-tête non ASCII s'écrit en « mots encodés » (RFC 2047) :
// =?UTF-8?B?…?=. Chaque mot est limité à 75 caractères, on coupe donc le texte
// en morceaux, sans jamais couper un caractère en deux.
function encodeHeaderText(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value;
  }
  const chunks: string[] = [];
  let current = "";
  for (const character of value) {
    if (Buffer.byteLength(current + character) > 36) {
      chunks.push(current);
      current = "";
    }
    current += character;
  }
  chunks.push(current);
  return chunks
    .map((chunk) => `=?UTF-8?B?${Buffer.from(chunk).toString("base64")}?=`)
    .join(LINE_BREAK + " ");
}

// « Nom <adresse> ». Le nom ASCII est entre guillemets (avec \ devant " et \),
// le nom non ASCII est encodé.
function formatAddress({ address, name }: EmailAddress): string {
  const isAscii = /^[\x20-\x7E]*$/.test(name);
  const displayName = isAscii
    ? `"${name.replace(/[\\"]/g, "\\$&")}"`
    : encodeHeaderText(name);
  return `${displayName} <${address}>`;
}

// Base64 coupé en lignes de 76 caractères, comme MIME l'exige.
function toBase64Lines(content: Uint8Array): string {
  const encoded = Buffer.from(content).toString("base64");
  return (encoded.match(/.{1,76}/g) ?? []).join(LINE_BREAK);
}

export function buildEml(message: EmailMessage, options: EmlOptions): string {
  const { date, boundary } = options;
  const alternativeBoundary = `${boundary}-alt`;
  const lines: string[] = [
    `Date: ${date.toUTCString()}`,
    `From: ${formatAddress(message.from)}`,
    `To: ${message.to}`,
    `Reply-To: ${formatAddress(message.replyTo)}`,
    `Subject: ${encodeHeaderText(message.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    toBase64Lines(Buffer.from(message.text)),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    toBase64Lines(Buffer.from(message.html)),
    `--${alternativeBoundary}--`,
  ];
  for (const attachment of message.attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.fileName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.fileName}"`,
      "",
      toBase64Lines(attachment.content),
    );
  }
  lines.push(`--${boundary}--`, "");
  return lines.join(LINE_BREAK);
}
