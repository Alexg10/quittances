// La fonction du domaine « envoyer cette quittance » (R3 à R10 de la
// spécification 05). Elle ne dépend ni d'une page, ni d'un cookie, ni d'une
// requête : elle reçoit le propriétaire, l'identifiant de la quittance et
// l'instant présent. Une Server Action, ou plus tard une échéance, l'appelle.
//
// Un envoi est un effet extérieur qu'aucune annulation de transaction ne
// reprend. Il se fait donc en trois temps, jamais dans une seule transaction :
//
// 1. RÉSERVER (transaction, verrou de la location) : relire, vérifier les
//    conditions, marquer la quittance « en cours », valider. Le verrou est
//    relâché.
// 2. ENVOYER (aucune transaction, aucun verrou) : produire le PDF, composer le
//    message, appeler le transport. C'est long (jusqu'à 15 secondes) : tenir un
//    verrou ce temps-là bloquerait toute modification de la location.
// 3. ENREGISTRER (nouvelle transaction) : « envoyée » ou « échec ».
//
// Aucun résultat ne contient de donnée personnelle, et le journal ne reçoit que
// le nom du résultat et sa durée (R27).
import "server-only";

import type { Owner } from "../auth/current-owner";
import { requireInstant } from "../db/require-instant";
import { requireOwnerId } from "../db/require-owner-id";
import type { EmailMessage } from "../email/email-message";
import {
  getEmailConfiguration,
  sendEmail,
  type EmailConfiguration,
} from "../email/send-email";
import {
  recordReceiptSendFailed,
  recordReceiptSent,
  reserveReceiptSending,
  type Receipt,
} from "./receipt-store";
import { getReceiptFileName } from "./receipt-reference";
import {
  buildReceiptEmailContent,
  buildReceiptEmailText,
  getReplyToName,
  SENDER_DISPLAY_NAME,
} from "./receipt-email-content";
import { buildReceiptEmailHtml } from "./receipt-email-html";
import { renderReceiptPdf } from "./render-receipt-pdf";

// R5 : les résultats, et seulement ceux-là.
export type SendReceiptResult =
  | "envoyée"
  // Autre compte, inexistante, supprimée, identifiant mal formé (R22 de la 04).
  | "quittance-introuvable"
  | "location-archivée"
  | "accord-manquant"
  | "envoi-en-cours"
  | "non-configuré"
  // Adresse refusée par R4, ou refus permanent du transport.
  | "destinataire-refusé"
  // Délai dépassé ou refus temporaire.
  | "échec-transport"
  // Le message est parti mais la trace n'a pas pu être écrite (R10).
  | "envoyée-non-enregistrée";

// Pour les tests : remplacer la configuration lue dans l'environnement par un
// transport de remplacement. `null` : envoi non configuré.
export type SendReceiptOptions = {
  configuration?: EmailConfiguration | null;
  // Délai du transport, en millisecondes (15 000 par défaut).
  transportTimeoutInMs?: number;
};

// Erreur levée quand le rendu du message échoue. Ni le message d'origine ni
// `cause` : ils pourraient contenir des données du message (R27).
export class ReceiptSendingError extends Error {
  constructor(originalError: unknown) {
    const kind =
      originalError instanceof Error ? originalError.name : typeof originalError;
    super(`Envoi de quittance : échec de la composition du message (${kind})`);
    this.name = "ReceiptSendingError";
  }
}

export async function sendReceipt(
  owner: Owner,
  receiptId: string,
  now: Date,
  options: SendReceiptOptions = {},
): Promise<SendReceiptResult> {
  const startedAtClock = performance.now();
  const result = await runSending(owner, receiptId, now, options);
  // R27 : le nom du résultat et la durée, rien d'autre (ni identifiant).
  console.info(
    `Envoi de quittance : ${result} (${Math.round(performance.now() - startedAtClock)} ms)`,
  );
  return result;
}

async function runSending(
  owner: Owner,
  receiptId: string,
  now: Date,
  options: SendReceiptOptions,
): Promise<SendReceiptResult> {
  // Les garde-fous communs : sans propriétaire ni instant valides, on échoue
  // avant toute lecture.
  const ownerId = requireOwnerId(owner);
  const startedAt = requireInstant(now);
  const configuration =
    options.configuration === undefined
      ? getEmailConfiguration()
      : options.configuration;

  // Temps 1 : réserver.
  const reservation = await reserveReceiptSending(
    owner,
    receiptId,
    startedAt,
    configuration !== null,
  );
  switch (reservation.status) {
    case "receipt-not-found":
      return "quittance-introuvable";
    case "rental-archived":
      return "location-archivée";
    case "consent-missing":
      return "accord-manquant";
    case "recipient-refused":
      return "destinataire-refusé";
    case "not-configured":
      return "non-configuré";
    case "sending-in-progress":
      return "envoi-en-cours";
    case "reserved":
      break;
  }
  // Le contrôle de R3 qui a laissé passer l'envoi garantit une configuration.
  if (configuration === null) {
    return "non-configuré";
  }

  // Temps 2 : envoyer. Plus aucune transaction ni aucun verrou.
  let message: EmailMessage;
  try {
    message = await composeMessage(
      reservation.receipt,
      reservation.recipient,
      reservation.ownerEmail,
      configuration,
    );
  } catch (error) {
    // Le PDF ou le message n'a pas pu être produit : rien n'est parti. On sort
    // la quittance de l'état « en cours » pour que le propriétaire puisse
    // réessayer tout de suite, puis l'erreur remonte comme inattendue.
    await recordReceiptSendFailed(owner, receiptId, startedAt).catch(() => false);
    throw new ReceiptSendingError(error);
  }
  const outcome = await sendEmail(
    configuration,
    message,
    { ownerId, receiptId },
    options.transportTimeoutInMs,
  );

  // Temps 3 : enregistrer.
  if (outcome.status === "accepté") {
    const recorded = await recordSentWithRetry(
      owner,
      receiptId,
      startedAt,
      reservation.recipient,
    );
    return recorded ? "envoyée" : "envoyée-non-enregistrée";
  }
  await recordReceiptSendFailed(owner, receiptId, startedAt);
  switch (outcome.status) {
    case "refusé-définitivement":
      return "destinataire-refusé";
    case "non-configuré":
      return "non-configuré";
    default:
      return "échec-transport";
  }
}

// R24 : le PDF est celui du téléchargement, octet pour octet : même fonction,
// mêmes valeurs figées, même date de création. R21 et R22 : l'expéditeur est
// l'application, la réponse va au propriétaire.
async function composeMessage(
  receipt: Receipt,
  recipient: string,
  ownerEmail: string,
  configuration: EmailConfiguration,
): Promise<EmailMessage> {
  const pdf = await renderReceiptPdf(receipt, receipt.producedAt);
  const content = buildReceiptEmailContent(receipt);
  return {
    to: recipient,
    from: { address: configuration.fromAddress, name: SENDER_DISPLAY_NAME },
    replyTo: { address: ownerEmail, name: getReplyToName(receipt.landlordName) },
    subject: content.subject,
    html: buildReceiptEmailHtml(content),
    text: buildReceiptEmailText(content),
    attachments: [
      {
        fileName: getReceiptFileName(receipt.id, receipt.month),
        contentType: "application/pdf",
        content: pdf,
      },
    ],
  };
}

// R10 : le message est parti, l'écriture de la trace est retentée UNE fois. Rend
// vrai si elle a abouti. Une écriture qui n'atteint aucune ligne (quittance
// supprimée ou reprise par un autre envoi) n'est pas retentée : elle ne
// réussira pas davantage.
async function recordSentWithRetry(
  owner: Owner,
  receiptId: string,
  startedAt: Date,
  recipient: string,
): Promise<boolean> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await recordReceiptSent(owner, receiptId, startedAt, recipient, startedAt);
    } catch {
      // Panne de base : on retente, puis on abandonne.
    }
  }
  return false;
}
