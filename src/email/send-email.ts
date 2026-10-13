// Le module d'envoi unique (R16 à R18 de la spécification 05). Toute
// l'application envoie ses e-mails par ici. Il ne compose rien de métier : il
// reçoit un message complet, le confie au transport choisi par EMAIL_TRANSPORT,
// tient le délai et classe les échecs.
import "server-only";

import { readEmailEnvironment } from "./email-environment";
import type {
  EmailLink,
  EmailMessage,
  EmailTransport,
  SendEmailResult,
  TransportResult,
} from "./email-message";
import { localTransport } from "./local-transport";

// R7 : délai total accordé au transport.
export const TRANSPORT_TIMEOUT_IN_MS = 15_000;

// Un transport prêt à servir, et l'adresse d'expédition de l'application.
export type EmailConfiguration = {
  transport: EmailTransport;
  fromAddress: string;
};

// La configuration lue dans l'environnement du processus, ou null quand l'envoi
// n'est pas configuré (R16, R20). Resend s'ajoutera ici : une branche de plus.
export function getEmailConfiguration(): EmailConfiguration | null {
  const environment = readEmailEnvironment(process.env);
  if (environment === null) {
    return null;
  }
  return { transport: localTransport, fromAddress: environment.fromAddress };
}

// Confie `message` au transport de `configuration`. Ne lève jamais d'erreur :
// toute exception du transport est classée "refusé-temporairement" (R18), et
// un transport qui ne répond pas dans le délai donne "délai-dépassé" (R7).
// `timeoutInMs` n'existe que pour les tests.
//
// Aucune donnée du message n'est journalisée (R27).
export async function sendEmail(
  configuration: EmailConfiguration | null,
  message: EmailMessage,
  link: EmailLink,
  timeoutInMs: number = TRANSPORT_TIMEOUT_IN_MS,
): Promise<SendEmailResult> {
  if (configuration === null) {
    return { status: "non-configuré" };
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Une promesse qui se réalise au bout du délai. Promise.race rend la première
  // des deux à se terminer.
  const timeout = new Promise<TransportResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ status: "délai-dépassé" });
    }, timeoutInMs);
  });

  try {
    return await Promise.race([
      configuration.transport.send(message, link, controller.signal),
      timeout,
    ]);
  } catch {
    // Exception inattendue du transport : on ne sait rien de plus (R18). Elle
    // n'est pas journalisée, son message pourrait contenir l'adresse.
    return { status: "refusé-temporairement" };
  } finally {
    clearTimeout(timer);
  }
}
