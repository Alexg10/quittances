// Le seul moyen d'obtenir le propriétaire courant (R2 de la spécification 02).
// Toute page, Server Action ou route qui lit ou écrit des données privées
// appelle getCurrentOwner() elle-même, puis filtre ses requêtes sur `owner.id`.
import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { getAuth } from "./auth";

// Volontairement étroit : rien de plus que ce dont le code applicatif a besoin.
// Ni jeton de session, ni hachage du mot de passe ne sortent de ce module.
export type Owner = {
  // Identifiant interne du compte (R1) : la clé de l'isolation entre comptes.
  id: string;
  // Adresse normalisée (R4), telle qu'enregistrée.
  email: string;
};

// La fonction ne prend aucun argument, et c'est ce qui la rend sûre : l'identité
// vient du cookie de session de la requête en cours, vérifié en base, jamais
// d'une valeur que le navigateur pourrait choisir (paramètre, champ, corps).
//
// - Pas de session, session expirée, session fermée ou jeton invalide : null.
// - Base injoignable : l'erreur remonte. On ne renvoie jamais un propriétaire
//   « dans le doute » (R24).
//
// `cache` de React ne garde le résultat que le temps d'une requête : plusieurs
// composants d'une même page partagent une seule lecture en base, et rien n'est
// conservé d'une requête à l'autre ni d'un visiteur à l'autre.
//
// Lire les en-têtes est une donnée de requête : avec `cacheComponents`, tout
// composant qui appelle cette fonction doit être rendu sous une limite <Suspense>.
export const getCurrentOwner = cache(async (): Promise<Owner | null> => {
  // Les en-têtes sont lus en premier, et l'ordre compte : pendant `pnpm build`,
  // il n'y a pas de requête et headers() ne répond jamais. Le pré-rendu s'arrête
  // donc ici, sans atteindre getAuth() : le build n'a besoin ni du secret ni de
  // la base.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) {
    return null;
  }
  return { id: session.user.id, email: session.user.email };
});
