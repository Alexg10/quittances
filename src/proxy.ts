// Proxy de Next (l'ancien « middleware ») : il s'exécute sur le serveur avant
// le rendu des pages listées dans `config.matcher`, en bas de ce fichier. Il
// fait deux choses, et aucune n'est un
// contrôle d'accès (R2 de la spécification 02) :
//
// 1. Prolonger la session et son cookie pendant la navigation (R16).
// 2. Rediriger tôt, par une vraie réponse HTTP, un visiteur sans session qui
//    demande une page protégée (R23). C'est un confort : la redirection
//    fonctionne ainsi sans JavaScript et n'envoie aucun contenu.
//
// La protection réelle reste dans chaque page et chaque Server Action, qui
// appellent getCurrentOwner(). Si ce fichier était supprimé ou si son `matcher`
// oubliait une route, aucune donnée privée ne deviendrait visible.
import { NextResponse, type NextRequest } from "next/server";

import {
  buildSignInPath,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
} from "./auth/return-path";
import {
  checkAndRenewSession,
  getSessionCookieName,
} from "./auth/session-renewal";

// Les deux pages publiques sur lesquelles le proxy s'exécute, pour y prolonger
// la session. Toute autre adresse retenue par `config.matcher`, en bas de ce
// fichier, est une page protégée : la liste des pages protégées n'existe donc
// qu'à un seul endroit, le `matcher`.
const PUBLIC_PATHS = [SIGN_IN_PATH, SIGN_UP_PATH];

function isProtectedPath(pathname: string): boolean {
  return !PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(await getSessionCookieName());
  const session = await checkAndRenewSession(request.headers, hasSessionCookie);

  const { pathname, search } = request.nextUrl;
  const hasNoSession = session.state === "absent" || session.state === "invalid";
  // Seules les lectures sont redirigées. Un POST est l'appel d'une Server
  // Action : elle vérifie la session elle-même et décide de la suite.
  // Dans le doute ("unknown", base injoignable), on laisse passer : la page
  // affichera l'écran de panne plutôt qu'une demande de connexion trompeuse.
  const shouldRedirect =
    request.method === "GET" && isProtectedPath(pathname) && hasNoSession;

  const response = shouldRedirect
    ? NextResponse.redirect(
        new URL(buildSignInPath(pathname, search), request.url),
      )
    : NextResponse.next();

  // Le cookie prolongé (ou supprimé) par Better Auth part avec la réponse.
  for (const setCookie of session.setCookies) {
    response.headers.append("Set-Cookie", setCookie);
  }
  return response;
}

export const config = {
  // Le proxy ne s'exécute que sur ces adresses. Partout ailleurs (l'accueil,
  // les fichiers statiques), aucune session n'est lue : la page d'accueil reste
  // servie telle que pré-rendue, sans lecture en base (R39).
  //
  // Next lit ce tableau à la compilation : il doit être écrit en toutes
  // lettres, sans constante ni variable. Les deux dernières adresses répètent
  // donc SIGN_IN_PATH et SIGN_UP_PATH (./auth/return-path) : les modifier
  // ensemble.
  //
  // Pour protéger une nouvelle section, ajouter ici "/section/:path*". Un oubli
  // ne rendrait rien visible : la page reste protégée par getCurrentOwner().
  // Elle y perdrait seulement la redirection sans JavaScript et la
  // prolongation de la session pendant qu'on la consulte.
  matcher: ["/tableau-de-bord/:path*", "/connexion", "/inscription"],
};
