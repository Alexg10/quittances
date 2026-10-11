// Prolongation de la session pendant la navigation (R16 de la spécification 02).
// Appelé par src/proxy.ts, et par lui seul.
//
// Une session dure 60 jours et chaque utilisation la prolonge. La prolongation
// touche deux choses qui doivent rester d'accord : la date d'expiration en base
// et celle du cookie du navigateur. Un Server Component ne peut pas écrire de
// cookie ; le proxy, lui, le peut, parce qu'il construit la réponse.
//
// CE MODULE N'EST PAS UN CONTRÔLE D'ACCÈS (R2). Ce qu'il renvoie ne sert qu'à
// prolonger la session et à rediriger tôt un visiteur sans session. Chaque page
// et chaque Server Action appelle elle-même getCurrentOwner().
import "server-only";

import { getAuth } from "./auth";

export type SessionCheck = {
  // "absent"  : la requête ne porte pas de cookie de session. Base non lue.
  // "valid"   : la session existe en base et n'a pas expiré.
  // "invalid" : cookie inventé, session expirée ou fermée.
  // "unknown" : la base n'a pas répondu. On ne conclut rien.
  state: "absent" | "valid" | "invalid" | "unknown";
  // En-têtes Set-Cookie à recopier dans la réponse : le cookie prolongé quand
  // la session vient de l'être, ou sa suppression quand elle est invalide.
  setCookies: string[];
};

// Nom du cookie de session, tel que Better Auth le calcule (il est préfixé de
// « __Secure- » quand l'application est servie en https).
export async function getSessionCookieName(): Promise<string> {
  const context = await getAuth().$context;
  return context.authCookies.sessionToken.name;
}

export async function checkAndRenewSession(
  requestHeaders: Headers,
  hasSessionCookie: boolean,
): Promise<SessionCheck> {
  // Sans cookie, il n'y a rien à prolonger : aucune lecture en base pour un
  // simple visiteur.
  if (!hasSessionCookie) {
    return { state: "absent", setCookies: [] };
  }

  try {
    // getSession lit la session en base. Si elle n'a pas été prolongée depuis
    // un jour (`updateAge` dans ./auth), Better Auth repousse son expiration
    // de 60 jours et produit le cookie correspondant. returnHeaders nous donne
    // les en-têtes qu'il aurait renvoyés s'il répondait lui-même en HTTP.
    const { headers, response } = await getAuth().api.getSession({
      headers: requestHeaders,
      returnHeaders: true,
    });
    return {
      state: response ? "valid" : "invalid",
      setCookies: headers.getSetCookie(),
    };
  } catch (error) {
    // Base injoignable : la page demandée affichera elle-même l'écran de panne.
    // On ne journalise que le type de l'erreur, jamais son contenu.
    console.error(
      "Prolongation de session : erreur inattendue",
      error instanceof Error ? error.name : typeof error,
    );
    return { state: "unknown", setCookies: [] };
  }
}
