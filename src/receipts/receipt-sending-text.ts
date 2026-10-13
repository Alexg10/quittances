// Textes d'envoi d'une quittance dans la liste du détail (« Contenus » de la
// spécification 05). Fonctions pures : l'instant est un paramètre, rien ne lit
// l'horloge ici. Aucun import serveur.
import { formatArchiveDate } from "../rentals/rental-archive-text";
import { formatMonthInSentence } from "./receipt-months";
import {
  getReceiptSendingStatus,
  type ReceiptSendingColumns,
  type ReceiptSendingStatus,
} from "./receipt-sending-state";

// La ou les lignes d'état sous la référence. « Échec » et « interrompu » sont
// datés du début du dernier envoi, qui existe toujours pour ces deux états.
export function getSendingStatusLines(
  columns: ReceiptSendingColumns,
  now: Date,
): string[] {
  const status = getReceiptSendingStatus(columns, now);
  const startedDay =
    columns.emailSendStartedAt === null
      ? ""
      : formatArchiveDate(columns.emailSendStartedAt);
  const sentLine =
    columns.emailSentAt === null || columns.emailSentTo === null
      ? null
      : `Envoyée le ${formatArchiveDate(columns.emailSentAt)} à ${columns.emailSentTo}.`;

  switch (status) {
    case "never":
      return ["Non envoyée par e-mail."];
    case "sent":
      return sentLine === null ? [] : [sentLine];
    case "sending":
      return ["Envoi en cours."];
    case "failed":
      // Un échec ne détruit pas la trace du dernier envoi réussi (R11).
      return sentLine === null
        ? [`Échec de l'envoi le ${startedDay}.`]
        : [`Échec de l'envoi le ${startedDay}.`, sentLine];
    case "interrupted":
      return [
        `Envoi interrompu le ${startedDay}. Le message est peut-être parti.`,
      ];
  }
}

export type SendingLink = {
  // Texte visible.
  label: string;
  // Nom accessible : commence par ou précise le texte visible, et distingue
  // les lignes entre elles par le mois.
  accessibleName: string;
};

// Le lien d'envoi selon l'état, ou null (envoi en cours : aucun lien).
export function getSendingLink(
  status: ReceiptSendingStatus,
  month: string,
): SendingLink | null {
  const monthInSentence = formatMonthInSentence(month);
  switch (status) {
    case "never":
      return {
        label: "Envoyer par e-mail",
        accessibleName: `Envoyer la quittance par e-mail, ${monthInSentence}`,
      };
    case "sent":
      return {
        label: "Renvoyer par e-mail",
        accessibleName: `Renvoyer la quittance par e-mail, ${monthInSentence}`,
      };
    case "failed":
    case "interrupted":
      return {
        label: "Réessayer l'envoi",
        accessibleName: `Réessayer l'envoi de la quittance, ${monthInSentence}`,
      };
    case "sending":
      return null;
  }
}
