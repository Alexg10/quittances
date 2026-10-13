// Transport local (R19 de la spécification 05) : il n'envoie rien. Il range le
// message dans la table `local_email`, liée à la quittance et au propriétaire.
// La commande `pnpm email:export` le relit en fichier .eml.
import "server-only";

import { getDb } from "../db";
import { localEmail } from "../db/schema";
import type { EmailTransport } from "./email-message";

export const localTransport: EmailTransport = {
  async send(message, link) {
    const attachment = message.attachments[0];
    // Une seule pièce jointe, le PDF (R24) : tout autre message est refusé
    // plutôt que rangé à moitié.
    if (message.attachments.length !== 1 || attachment === undefined) {
      return { status: "refusé-définitivement" };
    }
    const [row] = await getDb()
      .insert(localEmail)
      .values({
        ownerId: link.ownerId,
        receiptId: link.receiptId,
        recipient: message.to,
        senderAddress: message.from.address,
        senderName: message.from.name,
        replyToAddress: message.replyTo.address,
        replyToName: message.replyTo.name,
        subject: message.subject,
        htmlBody: message.html,
        textBody: message.text,
        attachmentFileName: attachment.fileName,
        attachmentContentType: attachment.contentType,
        attachmentContent: Buffer.from(attachment.content),
      })
      .returning({ id: localEmail.id });
    return { status: "accepté", messageId: row.id };
  },
};
