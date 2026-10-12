// Proxy de Next (l'ancien « middleware ») : il s'exécute sur le serveur avant
// le rendu des pages listées dans `config.matcher`, en bas de ce fichier. Il
// fait trois choses, et aucune n'est un contrôle d'accès (R2 de la
// spécification 02) :
//
// 1. Prolonger la session et son cookie pendant la navigation (R16).
// 2. Rediriger tôt vers /connexion un visiteur sans session qui demande une
//    page protégée (R23).
// 3. Rediriger vers /tableau-de-bord un propriétaire déjà connecté qui demande
//    /connexion ou /inscription (R22), ou /locations, qui n'a pas de contenu
//    (R27 de la spécification 03).
//
// Ces redirections sont un confort : chaque page protégée redirige aussi
// elle-même. Faites ici, elles partent plus tôt, avant tout rendu, et leur
// réponse n'a aucun contenu.
//
// Il refuse aussi, par un code 400, une adresse illisible sous /locations/ ou
// /quittances/ (voir isDecodable).
//
// Une adresse fait exception au point 2 : le téléchargement d'une quittance
// (voir isReceiptDownloadPath).
//
// La protection réelle reste dans chaque page et chaque Server Action, qui
// appellent getCurrentOwner(). Si ce fichier était supprimé ou si son `matcher`
// oubliait une route, aucune donnée privée ne deviendrait visible.
import { NextResponse, type NextRequest } from "next/server";

import {
  buildSignInPath,
  DASHBOARD_PATH,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
} from "./auth/return-path";
import {
  checkAndRenewSession,
  getSessionCookieName,
} from "./auth/session-renewal";

// Les deux pages publiques sur lesquelles le proxy s'exécute. Toute autre
// adresse retenue par `config.matcher`, en bas de ce fichier, est une page
// protégée : la liste des pages protégées n'existe donc qu'à un seul endroit,
// le `matcher`.
const PUBLIC_PATHS = [SIGN_IN_PATH, SIGN_UP_PATH];

// La liste des locations est le tableau de bord : cette adresse y renvoie.
const RENTALS_PATH = "/locations";

// Section des quittances (spécification 04).
const RECEIPTS_PATH = "/quittances";

// /quittances/<un segment>/pdf : le téléchargement d'une quittance. Seule la
// forme de l'adresse est regardée : le segment n'est ni lu ni comparé à quoi
// que ce soit.
const RECEIPT_DOWNLOAD_PATH = /^\/quittances\/[^/]+\/pdf$/;

function isProtectedPath(pathname: string): boolean {
  return !PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Vrai pour l'adresse de téléchargement d'une quittance (R33 de la
// spécification 04). Le proxy ne redirige jamais cette adresse : c'est le Route
// Handler qui répond à un visiteur sans session, par une redirection vers
// /connexion SANS paramètre `retour` (revenir après connexion sur une adresse
// qui déclenche un téléchargement laisserait l'utilisateur devant le formulaire
// de connexion). Une seule fonction décide ainsi de cette réponse, pour GET
// comme pour HEAD.
function isReceiptDownloadPath(pathname: string): boolean {
  return RECEIPT_DOWNLOAD_PATH.test(pathname);
}

// Faux pour un chemin dont l'encodage est invalide (« /locations/% »). Next ne
// sait pas en tirer la valeur du segment [id] : il répondrait par une erreur
// 500 avant d'avoir exécuté la page (mesuré sur cette version).
function isDecodable(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(await getSessionCookieName());
  // Si la session est prolongée ou n'existe plus, le cookie correspondant est
  // ajouté à la réponse par Next, quelle que soit la réponse renvoyée plus bas
  // (voir ./auth/session-renewal).
  const session = await checkAndRenewSession(request.headers, hasSessionCookie);

  const { pathname, search } = request.nextUrl;

  // Téléchargement d'une quittance, quelle que soit la méthode : la session
  // vient d'être prolongée ci-dessus comme pour toute autre adresse, puis la
  // requête passe au Route Handler, qui contrôle lui-même la session. Seule
  // une adresse illisible est arrêtée ici, par un code 400 sans contenu : Next
  // ne saurait pas en tirer la valeur du segment.
  if (isReceiptDownloadPath(pathname)) {
    if (!isDecodable(pathname)) {
      return new NextResponse(null, {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    return NextResponse.next();
  }

  // Seules les lectures sont redirigées. Un POST est l'appel d'une Server
  // Action : elle vérifie la session elle-même et décide de la suite.
  if (request.method !== "GET") {
    return NextResponse.next();
  }

  if (isProtectedPath(pathname)) {
    // Dans le doute ("unknown", base injoignable), on laisse passer : la page
    // affichera l'écran de panne plutôt qu'une demande de connexion trompeuse.
    if (session === "absent" || session === "invalid") {
      return NextResponse.redirect(
        new URL(buildSignInPath(pathname, search), request.url),
      );
    }
    // /locations, pour un propriétaire connecté : le tableau de bord. La page
    // fait la même redirection ; celle-ci la devance. Seule l'adresse exacte
    // est concernée : le proxy ne regarde jamais ce qui suit /locations/.
    if (session === "valid" && pathname === RENTALS_PATH) {
      return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
    }
    // Adresse illisible sous /locations/ ou /quittances/ : 400 « requête
    // incorrecte », sans contenu, plutôt que l'erreur 500 de Next. Le proxy ne
    // juge ici que la forme de l'adresse : la réponse est la même qu'une
    // location ou une quittance existe ou non.
    const hasDynamicSegment =
      pathname.startsWith(`${RENTALS_PATH}/`) ||
      pathname.startsWith(`${RECEIPTS_PATH}/`);
    if (hasDynamicSegment && !isDecodable(pathname)) {
      return new NextResponse(null, { status: 400 });
    }
    return NextResponse.next();
  }

  // Page publique. Un propriétaire déjà connecté va au tableau de bord, sans
  // paramètre : le `retour` éventuel de l'adresse n'est pas suivi (R22).
  // Dans le doute, là aussi, on laisse passer : le formulaire s'affiche.
  if (session === "valid") {
    return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
  }
  return NextResponse.next();
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
  // Elle y perdrait seulement la prolongation de la session pendant qu'on la
  // consulte, et la redirection faite avant tout rendu.
  //
  // "/locations/:path*" couvre /locations et tout ce qui est dessous (R28 de la
  // spécification 03), que l'adresse existe ou non. Le proxy n'y lit que la
  // session : jamais une location, jamais l'identifiant de l'adresse. Savoir à
  // qui appartient une location reste l'affaire de la page.
  //
  // "/mes-informations/:path*" et "/quittances/:path*" (spécification 04) suivent la
  // même règle : le proxy n'y lit que la session, jamais une quittance.
  matcher: [
    "/tableau-de-bord/:path*",
    "/locations/:path*",
    "/mes-informations/:path*",
    "/quittances/:path*",
    "/connexion",
    "/inscription",
  ],
};
