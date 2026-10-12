// Les réponses du téléchargement d'une quittance (R32 et R33 de la
// spécification 04), une fonction par ligne du tableau de la spécification.
// Fonctions pures : elles ne lisent ni la session ni la base, et construisent
// une `Response` standard du Web. Le Route Handler (./route.ts) choisit
// laquelle renvoyer.
//
// Deux en-têtes communs à toutes :
// - `Cache-Control: private, no-store` : ni le navigateur ni un intermédiaire ne
//   garde la réponse (R37) ;
// - `X-Content-Type-Options: nosniff` : le navigateur s'en tient au type
//   annoncé, sans deviner le type d'après le contenu.
import { DASHBOARD_PATH, SIGN_IN_PATH } from "@/auth/return-path";

const COMMON_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

// 200 : le fichier. `attachment` fait enregistrer le fichier par le navigateur,
// qui reste sur la page affichée. `fileName` vient de getReceiptFileName : il
// n'est fait que de lettres minuscules, de chiffres, de tirets et d'un point,
// jamais d'un texte saisi. Il peut donc être placé tel quel entre guillemets.
export function pdfResponse(pdf: Uint8Array, fileName: string): Response {
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}

// 307 : sans session. La destination est fixe et sans paramètre `retour` :
// revenir après connexion sur une adresse qui déclenche un téléchargement
// laisserait l'utilisateur devant le formulaire de connexion (R33).
// 307 et non 401 : cette adresse est suivie par la navigation d'un navigateur,
// qui afficherait une page d'erreur nue pour un 401.
export function signInRedirectResponse(): Response {
  return new Response(null, {
    status: 307,
    headers: { ...COMMON_HEADERS, Location: SIGN_IN_PATH },
  });
}

// 404 : quittance d'un autre compte, supprimée, inconnue ou identifiant mal
// formé. La fonction ne reçoit aucun argument : la réponse ne peut pas dépendre
// de la demande, elle est donc la même dans les quatre cas (R22).
export function notFoundResponse(): Response {
  return htmlResponse(404, {
    title: "Quittance introuvable — Quittances",
    heading: "Quittance introuvable",
    text: "Cette quittance n'existe pas ou a été supprimée.",
    link: { href: DASHBOARD_PATH, label: "Retour au tableau de bord" },
  });
}

// 503 (base injoignable ou trop lente) et 500 (le PDF n'a pas pu être
// construit) : le même document, sans aucun détail technique.
export function unavailableResponse(status: 500 | 503): Response {
  return htmlResponse(status, {
    title: "Service momentanément indisponible — Quittances",
    heading: "Service momentanément indisponible",
    text: "Cette page ne peut pas être affichée pour le moment.",
  });
}

// 405 : toute autre méthode que GET et HEAD. `Allow` indique celles qui sont
// acceptées.
export function methodNotAllowedResponse(): Response {
  return new Response(null, {
    status: 405,
    headers: { ...COMMON_HEADERS, Allow: "GET, HEAD" },
  });
}

type StandaloneDocument = {
  title: string;
  heading: string;
  text: string;
  link?: { href: string; label: string };
};

function htmlResponse(status: number, document: StandaloneDocument): Response {
  return new Response(buildStandaloneDocument(document), {
    status,
    headers: { ...COMMON_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}

// Un Route Handler ne passe pas par les layouts : il ne peut pas rendre un écran
// de l'application (en-tête, feuille de styles, polices). La spécification
// accepte donc un document HTML autonome (R33). Il n'a volontairement aucune
// couleur ni mise en forme propre : le navigateur applique ses styles par défaut.
// Exportée pour être testée seule.
export function buildStandaloneDocument({
  title,
  heading,
  text,
  link,
}: StandaloneDocument): string {
  const linkHtml = link
    ? `<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body>
<main>
<h1>${escapeHtml(heading)}</h1>
<p>${escapeHtml(text)}</p>
${linkHtml}
</main>
</body>
</html>
`;
}

// Les textes passés ici sont des constantes de ce fichier. Ils sont échappés
// quand même : la fonction reste sûre si on lui passe un jour un autre texte.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
