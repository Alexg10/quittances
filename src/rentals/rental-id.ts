// Forme de l'identifiant d'une location (R6 de la spécification 03).
// Fonction pure, sans base ni framework : elle sert aux fonctions d'accès aux
// données, et servira aux pages qui lisent l'identifiant dans l'adresse.

// Forme canonique d'un UUID : 36 caractères, chiffres hexadécimaux en
// minuscules, tirets aux positions 8, 13, 18 et 23. Les ancres ^ et $ et
// l'absence de drapeau (ni « i », ni « m ») font que rien d'autre ne passe :
// ni majuscules, ni accolades, ni espace, ni saut de ligne final.
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Vrai si `value` a la seule forme acceptée pour un identifiant de location.
// Ce n'est pas un contrôle d'accès : un identifiant bien formé peut être celui
// de la location d'un autre compte. Le contrôle d'accès est le filtre sur le
// propriétaire, dans chaque requête.
export function isRentalId(value: string): boolean {
  return CANONICAL_UUID.test(value);
}
