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

// Origine fictive, pour analyser un chemin avec l'API URL du langage.
// « .invalid » est un domaine réservé, qui ne désigne aucun site réel.
const INTERNAL_ORIGIN = "http://interne.invalid";

type SearchParams = Record<string, string | string[] | undefined>;

// Ce qu'une page reçoit de Next pour un paramètre d'adresse : une chaîne, un
// tableau quand le paramètre est répété (?retour=a&retour=b), ou rien.
type ReturnParam = string | string[] | null | undefined;

// Renvoie la destination de retour si elle est sûre, sinon /tableau-de-bord.
// Une destination sûre est renvoyée à l'identique (chemin, paramètres, ancre).
export function getSafeReturnPath(value: ReturnParam): string {
  return isSafeReturnPath(value) ? value : DASHBOARD_PATH;
}

// `value is string` : là où cette fonction répond vrai, TypeScript sait que la
// valeur est une chaîne.
export function isSafeReturnPath(value: ReturnParam): value is string {
  // La valeur vient de l'adresse, donc du visiteur : le type annoncé ne
  // garantit rien à l'exécution. Tout ce qui n'est pas une chaîne est refusé,
  // un tableau compris, même s'il contient une destination valide : on ne
  // choisit pas un élément parmi plusieurs.
  if (typeof value !== "string") {
    return false;
  }
  // Un seul « / » au début : « //exemple.test » désigne un autre site, et
  // « https://… », « javascript:… » ou « tableau-de-bord » ne commencent pas
  // par « / ».
  if (!value.startsWith("/") || value.startsWith("//")) {
    return false;
  }
  // Un navigateur lit « \ » comme « / » : « /\exemple.test » y vaut
  // « //exemple.test ».
  if (value.includes("\\")) {
    return false;
  }
  // Un navigateur retire tabulations et sauts de ligne d'une adresse :
  // « /<tabulation>/exemple.test » y vaut aussi « //exemple.test ».
  if (hasControlCharacter(value)) {
    return false;
  }

  // Seconde barrière : une fois analysée comme le fera le navigateur, la
  // destination doit rester sur notre origine.
  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return false;
  }
  if (url.origin !== INTERNAL_ORIGIN) {
    return false;
  }

  return !PUBLIC_AUTH_PATHS.includes(normalizePathname(url.pathname));
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
