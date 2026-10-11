// Prolongation de la session pendant la navigation (R16 de la spécification 02).
// Appelé par src/proxy.ts, et par lui seul.
//
// Une session dure 60 jours et chaque utilisation la prolonge. La prolongation
// touche deux choses qui doivent rester d'accord : la date d'expiration en base
// et celle du cookie du navigateur. Un Server Component ne peut pas écrire de
// cookie ; le proxy, lui, le peut.
//
// Comment le cookie part : quand Better Auth prolonge une session (ou constate
// qu'elle n'existe plus), son plugin nextCookies (./auth) écrit le cookie
// prolongé (ou sa suppression) avec cookies() de next/headers. Dans le proxy,
// Next ajoute lui-même à la réponse, redirection comprise, tout cookie écrit
// de cette façon. Ce module n'a donc aucun en-tête Set-Cookie à transmettre.
//
// CE MODULE N'EST PAS UN CONTRÔLE D'ACCÈS (R2). Ce qu'il renvoie ne sert qu'à
// rediriger tôt, par confort. Chaque page et chaque Server Action appelle
// elle-même getCurrentOwner().
import "server-only";

import { getAuth } from "./auth";

// "absent"  : la requête ne porte pas de cookie de session. Base non lue.
// "valid"   : la session existe en base et n'a pas expiré.
// "invalid" : cookie inventé, session expirée ou fermée.
// "unknown" : la base n'a pas répondu. On ne conclut rien.
export type SessionState = "absent" | "valid" | "invalid" | "unknown";

// Nom du cookie de session, tel que Better Auth le calcule (il est préfixé de
// « __Secure- » quand l'application est servie en https).
export async function getSessionCookieName(): Promise<string> {
  const context = await getAuth().$context;
  return context.authCookies.sessionToken.name;
}

export async function checkAndRenewSession(
  requestHeaders: Headers,
  hasSessionCookie: boolean,
): Promise<SessionState> {
  // Sans cookie, il n'y a rien à prolonger : aucune lecture en base pour un
  // simple visiteur.
  if (!hasSessionCookie) {
    return "absent";
  }

  try {
    // getSession lit la session en base. Si elle n'a pas été prolongée depuis
    // un jour (`updateAge` dans ./auth), Better Auth repousse son expiration
    // de 60 jours et écrit le cookie correspondant (voir l'en-tête du fichier).
    const session = await getAuth().api.getSession({ headers: requestHeaders });
    return session ? "valid" : "invalid";
  } catch (error) {
    // Base injoignable : la page demandée affichera elle-même l'écran de panne.
    // On ne journalise que le type de l'erreur, jamais son contenu.
    console.error(
      "Prolongation de session : erreur inattendue",
      error instanceof Error ? error.name : typeof error,
    );
    return "unknown";
  }
}
