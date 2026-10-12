// Garde-fou commun aux modules d'accès aux données (R8 de la spécification 03,
// R23 de la spécification 04) : sans propriétaire, on échoue avant toute requête.
//
// TypeScript refuse déjà ces appels, mais les types n'existent plus une fois le
// code compilé : un `null` venu d'un getCurrentOwner() dont on aurait oublié de
// tester le résultat arriverait ici.
//
// `import type` : seul le type est importé, il disparaît à la compilation. Ce
// module ne charge donc ni next/headers ni Better Auth.
import type { Owner } from "../auth/current-owner";

export function requireOwnerId(owner: Owner): string {
  // Le paramètre est relu comme une valeur inconnue : c'est précisément le cas
  // où le type annoncé est faux qu'on veut attraper.
  const candidate: unknown = owner;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("id" in candidate) ||
    typeof candidate.id !== "string" ||
    candidate.id === ""
  ) {
    throw new Error(
      "Accès aux données : propriétaire manquant. Toute lecture ou écriture exige le résultat de getCurrentOwner().",
    );
  }
  return candidate.id;
}
