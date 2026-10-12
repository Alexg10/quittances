// Destination de retour après connexion (R14, R23 de la spécification 02).
// Fichier pur, sans import serveur : utilisable et testable partout.
//
// Le paramètre `retour` vient de l'adresse : n'importe qui peut fabriquer un
// lien /connexion?retour=… et l'envoyer à un propriétaire. S'il était suivi tel
// quel, ce lien pourrait mener vers un autre site après une vraie connexion
// (redirection ouverte). On ne retient donc qu'un chemin interne.

export const DASHBOARD_PATH = "/tableau-de-bord";
export const SIGN_IN_PATH = "/connexion";
export const SIGN_UP_PATH = "/inscription";

// Les pages publiques ne sont jamais une destination de retour : un
// propriétaire connecté en est redirigé (R22), on tournerait en rond.
const PUBLIC_AUTH_PATHS = [SIGN_IN_PATH, SIGN_UP_PATH];

// Les chemins internes qui ne sont pas des pages : ils ne sont jamais une
// destination de retour non plus. Aujourd'hui un seul motif, le téléchargement
// d'une quittance (/quittances/<un segment>/pdf, R33 de la spécification 04) :
// y revenir après connexion déclencherait un téléchargement et laisserait
// l'utilisateur devant le formulaire de connexion. Le segment n'est pas
// examiné : toute adresse qui mène à ce Route Handler est refusée.
// Chaque motif est comparé au chemin normalisé (voir normalizePathname).
const NON_PAGE_PATH_PATTERNS = [/^\/quittances\/[^/]+\/pdf$/];

// Origine fictive, pour analyser un chemin avec l'API URL du langage.
// « .invalid » est un domaine réservé, qui ne désigne aucun site réel.
const INTERNAL_ORIGIN = "http://interne.invalid";

type SearchParams = Record<string, string | string[] | undefined>;

// Ce qu'une page reçoit de Next pour un paramètre d'adresse : une chaîne, un
// tableau quand le paramètre est répété (?retour=a&retour=b), ou rien.
type ReturnParam = string | string[] | null | undefined;

// Longueur maximale d'une destination. Largement au-dessus de toute adresse de
// l'application ; au-delà, la valeur n'a rien d'une destination légitime.
const MAX_RETURN_PATH_LENGTH = 2000;

// Un chemin peut être encodé plusieurs fois (« %252e » se décode en « %2e »,
// qui se décode en « . »). On le décode au plus ce nombre de fois ; s'il change
// encore, il est refusé.
const MAX_DECODING_ROUNDS = 3;

// Renvoie la destination de retour si elle est sûre, sinon /tableau-de-bord.
// La destination renvoyée n'est jamais la chaîne reçue : c'est l'adresse
// reconstruite après analyse (voir normalizeReturnPath).
export function getSafeReturnPath(value: ReturnParam): string {
  return normalizeReturnPath(value) ?? DASHBOARD_PATH;
}

// Même règle, à partir de l'adresse complète de la page de connexion, telle que
// le navigateur l'annonce dans l'en-tête Referer quand il envoie le formulaire
// (« http://…/connexion?retour=%2Ftableau-de-bord »). Cet en-tête vient du
// navigateur, donc du visiteur : rien n'en est retenu sans passer par
// isSafeReturnPath. En-tête absent ou illisible, autre page que /connexion,
// paramètre `retour` absent ou répété : /tableau-de-bord.
// L'origine de l'adresse (protocole, hôte) n'est pas comparée à la nôtre : elle
// ne sert à rien ici, seul un chemin interne peut sortir de cette fonction.
export function getSafeReturnPathFromPageUrl(pageUrl: string | null): string {
  if (pageUrl === null) {
    return DASHBOARD_PATH;
  }
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return DASHBOARD_PATH;
  }
  if (url.pathname !== SIGN_IN_PATH) {
    return DASHBOARD_PATH;
  }
  // getAll renvoie toutes les valeurs du paramètre, déjà décodées. Une seule
  // est attendue : zéro ou plusieurs sont transmises sous forme de tableau,
  // que getSafeReturnPath refuse.
  const values = url.searchParams.getAll("retour");
  return getSafeReturnPath(values.length === 1 ? values[0] : values);
}

// `value is string` : là où cette fonction répond vrai, TypeScript sait que la
// valeur est une chaîne. Elle dit seulement si la valeur est acceptable : la
// destination à suivre est celle que renvoie getSafeReturnPath.
export function isSafeReturnPath(value: ReturnParam): value is string {
  return normalizeReturnPath(value) !== null;
}

// Renvoie la destination à suivre, ou null si la valeur est refusée.
//
// Le danger : la valeur est lue trois fois, par ce code, par le navigateur et
// par le routeur de Next dans le navigateur, et ces lecteurs ne la comprennent
// pas forcément de la même façon. « /.//exemple.test » commence par un seul
// « / » ; mais une fois le segment « . » retiré, il reste « //exemple.test »,
// que le routeur de Next prenait pour l'adresse d'un autre site (redirection
// ouverte trouvée par la recette de T4).
//
// Deux barrières indépendantes :
// 1. Le chemin reçu doit déjà être sous forme canonique : tout ce qu'un lecteur
//    pourrait réécrire est refusé (isCanonicalPath).
// 2. La destination renvoyée est reconstruite à partir de l'adresse analysée,
//    puis revérifiée : ce qui a été validé est exactement ce qui sera suivi.
function normalizeReturnPath(value: ReturnParam): string | null {
  // La valeur vient de l'adresse, donc du visiteur : le type annoncé ne
  // garantit rien à l'exécution. Tout ce qui n'est pas une chaîne est refusé,
  // un tableau compris, même s'il contient une destination valide : on ne
  // choisit pas un élément parmi plusieurs.
  if (typeof value !== "string" || value.length > MAX_RETURN_PATH_LENGTH) {
    return null;
  }
  // Un navigateur retire tabulations et sauts de ligne d'une adresse :
  // « /<tabulation>/exemple.test » y vaut « //exemple.test ». Et il lit « \ »
  // comme « / ». Refusés partout, paramètres et ancre compris.
  if (hasControlCharacter(value) || value.includes("\\")) {
    return null;
  }

  // Première barrière, sur la valeur reçue.
  if (!isCanonicalPath(getPathPart(value))) {
    return null;
  }

  // Seconde barrière : la valeur est analysée comme le fera le navigateur, sur
  // une origine fictive, et doit y rester.
  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== INTERNAL_ORIGIN) {
    return null;
  }
  // La destination est reconstruite à partir des trois morceaux de l'adresse
  // analysée. L'analyse a pu réécrire la valeur (un « é » devient « %C3%A9 ») :
  // c'est ce résultat, et non la chaîne reçue, qui doit être sûr. Il repasse
  // donc la première barrière, et une nouvelle analyse ne doit plus rien y
  // changer.
  const destination = url.pathname + url.search + url.hash;
  if (!isCanonicalPath(url.pathname)) {
    return null;
  }
  const reparsed = new URL(destination, INTERNAL_ORIGIN);
  if (
    reparsed.origin !== INTERNAL_ORIGIN ||
    reparsed.pathname + reparsed.search + reparsed.hash !== destination
  ) {
    return null;
  }

  // Les pages publiques ne sont jamais une destination (R22).
  // La comparaison porte sur le chemin reconstruit par l'analyse, ramené à une
  // forme comparable, et non sur la chaîne reçue.
  const comparablePath = normalizePathname(url.pathname);
  if (PUBLIC_AUTH_PATHS.includes(comparablePath)) {
    return null;
  }
  // Ni les chemins qui ne sont pas des pages, quels que soient les paramètres
  // ou l'ancre qui les suivent.
  if (NON_PAGE_PATH_PATTERNS.some((pattern) => pattern.test(comparablePath))) {
    return null;
  }
  return destination;
}

// Le chemin d'une destination : ce qui précède le premier « ? » ou « # ».
// La règle de forme canonique ne porte que sur lui. Les paramètres et l'ancre
// peuvent contenir « // » ou « .. » (« ?suite=https://… » est une valeur
// ordinaire) : tout lecteur d'adresse s'arrête de lire le chemin au premier
// « ? » ou « # », et rien de ce qui suit ne peut devenir un nom de site.
function getPathPart(value: string): string {
  const end = value.search(/[?#]/);
  return end === -1 ? value : value.slice(0, end);
}

// Vrai si le chemin est déjà sous la forme que tous ses lecteurs garderont :
// - il commence par « / » ;
// - il ne contient nulle part « // », « \ » ni caractère de contrôle ;
// - aucun de ses segments n'est « . » ou « .. » (un lecteur les retire, et
//   « /a/..//x » devient « //x ») ;
// - il ne contient pas ces mêmes caractères sous forme encodée (« %2e » pour
//   « . », « %2f » pour « / », « %5c » pour « \ »), même encodés plusieurs fois.
function isCanonicalPath(path: string): boolean {
  if (!path.startsWith("/")) {
    return false;
  }
  let current = path;
  // Le chemin est vérifié tel quel, puis décodé et revérifié, jusqu'à ce que
  // le décodage ne change plus rien.
  for (let round = 0; round <= MAX_DECODING_ROUNDS; round += 1) {
    if (hasAmbiguousPathSyntax(current)) {
      return false;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      // Encodage invalide (« %zz ») : les lecteurs peuvent diverger.
      return false;
    }
    if (decoded === current) {
      return true;
    }
    current = decoded;
  }
  // Encore encodé après plusieurs décodages : refusé.
  return false;
}

function hasAmbiguousPathSyntax(path: string): boolean {
  if (path.includes("//") || path.includes("\\") || hasControlCharacter(path)) {
    return true;
  }
  if (/%(2e|2f|5c)/i.test(path)) {
    return true;
  }
  return path.split("/").some((segment) => segment === "." || segment === "..");
}

// Adresse de la page de connexion pour une page protégée demandée sans session
// (R23) : /connexion?retour=<chemin et paramètres demandés, encodés>.
// `search` est la partie « ?… » de l'adresse demandée, ou une chaîne vide.
export function buildSignInPath(pathname: string, search = ""): string {
  return `${SIGN_IN_PATH}?retour=${encodeURIComponent(pathname + search)}`;
}

// Reconstruit la partie « ?… » d'une adresse à partir des paramètres qu'une
// page reçoit de Next. Renvoie une chaîne vide s'il n'y en a aucun.
export function toSearchString(searchParams: SearchParams): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    // Un paramètre répété (?a=1&a=2) arrive sous forme de tableau.
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item !== undefined) {
        params.append(name, item);
      }
    }
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

// Caractères de contrôle : codes 0 à 31, et 127.
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}

// Ramène un chemin à une forme comparable : « /Connexion/ » ou « /%63onnexion »
// désignent la page de connexion aussi sûrement que « /connexion ».
function normalizePathname(pathname: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Encodage invalide (« %zz ») : on compare le chemin tel quel.
    decoded = pathname;
  }
  const lowered = decoded.toLowerCase();
  // Barres obliques finales retirées, sans vider le chemin « / ».
  const trimmed = lowered.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}
