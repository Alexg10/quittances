// Lecture du code d'une erreur de Better Auth. Fichier pur, sans dépendance :
// utilisable et testable partout.

// Renvoie le code d'une erreur de Better Auth (`error.body.code`), ou
// undefined si l'erreur n'en porte pas (panne de base, erreur inattendue).
//
// On ne teste pas `error instanceof APIError` : certaines erreurs de la
// bibliothèque sont levées par une couche interne, avec une autre classe, pour
// laquelle ce test est faux. Constaté en T2 sur le build de production : une
// adresse refusée était alors prise pour une panne. On lit donc la forme de
// l'objet, pas sa classe.
export function readAuthErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("body" in error)) {
    return undefined;
  }
  const body = error.body;
  if (typeof body !== "object" || body === null || !("code" in body)) {
    return undefined;
  }
  return typeof body.code === "string" ? body.code : undefined;
}
