// Le message et le résultat de l'envoi (R17 et R18 de la spécification 05).
// Fichier de types seulement : aucun import serveur. Le module d'envoi, les
// transports et le gabarit de la quittance s'accordent sur ces types et sur
// rien d'autre.

// Une adresse et le nom affiché avec elle.
export type EmailAddress = {
  address: string;
  name: string;
};

export type EmailAttachment = {
  fileName: string;
  contentType: string;
  // Les octets du fichier. Un Buffer de Node en est un.
  content: Uint8Array;
};

// R17 : un message complet, rien d'autre. Le destinataire est UNE adresse.
export type EmailMessage = {
  to: string;
  from: EmailAddress;
  replyTo: EmailAddress;
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
};

// R18 : ce que rend un transport. Les échecs sont classés, pour que l'appelant
// sache s'il peut réessayer :
// - "refusé-définitivement" : adresse ou message refusé, réessayer ne servira à rien ;
// - "refusé-temporairement" : service indisponible, limite atteinte ;
// - "délai-dépassé" : le transport n'a pas répondu à temps (R7).
export type TransportResult =
  | { status: "accepté"; messageId?: string }
  | { status: "refusé-définitivement" }
  | { status: "refusé-temporairement" }
  | { status: "délai-dépassé" };

// Le résultat du module d'envoi : celui du transport, ou "non-configuré" (R16,
// R20) quand aucun transport ne peut servir. Rien n'a alors été tenté.
export type SendEmailResult = TransportResult | { status: "non-configuré" };

// À quoi le message se rattache. Un transport qui envoie pour de bon (Resend,
// plus tard) l'ignore ; le transport local s'en sert pour ranger le message
// avec sa quittance et son propriétaire, afin qu'il disparaisse avec eux (R19).
export type EmailLink = {
  ownerId: string;
  receiptId: string;
};

// R18 : l'interface qu'un transport implémente. Ajouter Resend, c'est écrire un
// autre objet de cette forme, et le choisir dans getEmailConfiguration.
export type EmailTransport = {
  // `signal` s'annule quand le délai est dépassé : un transport qui sait
  // abandonner son appel (fetch, par exemple) l'écoute.
  send(
    message: EmailMessage,
    link: EmailLink,
    signal: AbortSignal,
  ): Promise<TransportResult>;
};
