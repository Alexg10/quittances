// Lecture, sans effet de bord, de la configuration d'envoi dans l'environnement
// (R16, R20 et R21 de la spécification 05). La fonction reçoit l'environnement
// en paramètre : on la teste sans toucher à process.env. Aucun import serveur.

// Ce que la configuration permet : le transport choisi, et l'adresse
// d'expédition. L'ajout de Resend ajoutera une valeur ici.
export type EmailEnvironment = {
  transport: "local";
  fromAddress: string;
};

// Valeurs qui disent « ce n'est PAS la production réelle ». Toute autre valeur
// non vide la déclare : on se trompe dans le sens qui bloque l'envoi.
const NOT_PRODUCTION_VALUES = ["false", "0", "no", "non"];

export function isRealProduction(
  env: Record<string, string | undefined>,
): boolean {
  const value = (env.REAL_PRODUCTION ?? "").trim().toLowerCase();
  return value !== "" && !NOT_PRODUCTION_VALUES.includes(value);
}

// null : l'envoi n'est pas configuré (R16, R20). C'est le cas quand
// EMAIL_TRANSPORT est absent ou inconnu, quand l'adresse d'expédition manque
// ou n'a pas la forme d'une adresse, et quand le transport local est demandé
// dans un environnement déclaré de production réelle : le transport local n'envoie
// rien, il ne doit pas faire croire à un envoi.
export function readEmailEnvironment(
  env: Record<string, string | undefined>,
): EmailEnvironment | null {
  const fromAddress = (env.EMAIL_FROM_ADDRESS ?? "").trim();
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+$/.test(fromAddress)) {
    return null;
  }
  if (env.EMAIL_TRANSPORT === "local" && !isRealProduction(env)) {
    return { transport: "local", fromAddress };
  }
  return null;
}
