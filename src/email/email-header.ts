// Règles pures sur ce qui entre dans un message : texte d'en-tête et adresse
// du destinataire (R4 et R22 de la spécification 05). Aucun import serveur.

// Caractères qui terminent une ligne d'en-tête ou la brouillent : les
// caractères de contrôle (U+0000 à U+001F, U+007F, qui comprennent \r et \n) et
// les séparateurs de ligne Unicode U+2028 et U+2029.
const HEADER_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F\u2028\u2029]+/g;

// R22 : assainit un texte destiné à un en-tête (nom, objet). Chaque suite de
// caractères de contrôle devient une espace, les espaces répétées sont réduites
// à une seule, les bords sont rognés. Un texte ainsi vidé est remplacé par
// `fallback`. Une valeur contenant « \r\nBcc: … » ne peut donc jamais ajouter
// un en-tête : plus aucun saut de ligne n'y survit.
export function sanitizeHeaderText(value: string, fallback: string): string {
  const cleaned = value
    .replace(HEADER_CONTROL_CHARACTERS, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  return cleaned === "" ? fallback : cleaned;
}

// R4 : une seule adresse, de 3 à 254 caractères, sans espace (ni aucune
// espace Unicode), sans caractère de contrôle, sans , ; < > ". Comme les
// adresses de l'application sont normalisées à l'enregistrement, ce contrôle
// est un dernier rempart : il vérifie ce qui va réellement partir au transport.
// On exige aussi un seul « @ », avec du texte de chaque côté.
export function isValidRecipient(address: string): boolean {
  if (address.length < 3 || address.length > 254) {
    return false;
  }
  if (/[\s\u0000-\u001F\u007F,;<>"]/.test(address)) {
    return false;
  }
  const parts = address.split("@");
  return parts.length === 2 && parts[0] !== "" && parts[1] !== "";
}
