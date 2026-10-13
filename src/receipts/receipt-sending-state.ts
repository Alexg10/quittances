// État d'envoi d'une quittance, déduit de ses colonnes et de l'instant présent
// (R8, R9 et R15 de la spécification 05). Fonctions pures : l'instant est un
// paramètre, rien ne lit l'horloge ici. Aucun import serveur.

// R8 et R9 : un envoi « en cours » depuis moins de ce délai est vivant ; au-delà,
// il est périmé (le serveur s'est sans doute arrêté entre la réservation et
// l'enregistrement). Le transport a 15 secondes : deux minutes laissent de la
// marge au rendu du PDF.
export const SENDING_STALE_AFTER_IN_MS = 2 * 60 * 1000;

// Les quatre informations d'envoi enregistrées sur la quittance (R15).
export type ReceiptSendingColumns = {
  // null : aucun envoi en cours ni échoué.
  emailSendState: "sending" | "failed" | null;
  // Début du dernier envoi, présent si et seulement si l'état l'est.
  emailSendStartedAt: Date | null;
  // Date et adresse du dernier envoi RÉUSSI, ensemble.
  emailSentAt: Date | null;
  emailSentTo: string | null;
};

// Ce que le propriétaire voit (« Contenus » de la spécification) :
// - "never" : jamais envoyée ;
// - "sent" : envoyée, rien de plus récent ;
// - "sending" : envoi en cours depuis moins de deux minutes ;
// - "failed" : le dernier envoi a échoué ;
// - "interrupted" : un envoi est resté « en cours » plus de deux minutes.
// Une quittance "failed" ou "interrupted" peut aussi avoir été envoyée avant :
// c'est `emailSentAt` qui le dit.
export type ReceiptSendingStatus =
  | "never"
  | "sent"
  | "sending"
  | "failed"
  | "interrupted";

// Vrai si un envoi est en cours ET vivant (moins de deux minutes) à l'instant
// `now`. Un début dans le futur (horloges désaccordées) compte comme vivant.
export function isSendingInProgress(
  columns: Pick<ReceiptSendingColumns, "emailSendState" | "emailSendStartedAt">,
  now: Date,
): boolean {
  return (
    columns.emailSendState === "sending" &&
    columns.emailSendStartedAt !== null &&
    now.getTime() - columns.emailSendStartedAt.getTime() <
      SENDING_STALE_AFTER_IN_MS
  );
}

export function getReceiptSendingStatus(
  columns: ReceiptSendingColumns,
  now: Date,
): ReceiptSendingStatus {
  if (columns.emailSendState === "sending") {
    return isSendingInProgress(columns, now) ? "sending" : "interrupted";
  }
  if (columns.emailSendState === "failed") {
    return "failed";
  }
  return columns.emailSentAt === null ? "never" : "sent";
}
