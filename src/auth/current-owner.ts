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
// - Base injoignable, avec un cookie de session correctement signé : l'erreur
//   remonte. On ne renvoie jamais un propriétaire « dans le doute » (R24), et
//   on ne répond pas non plus « personne » : l'appelant doit pouvoir distinguer
//   une panne d'une absence de session.
// - Base injoignable, sans cookie ou avec un cookie à la signature fausse :
//   null. La base n'est pas interrogée, il n'y a de toute façon pas de session.
//
// `cache` de React ne garde le résultat que le temps d'une requête : plusieurs
// composants d'une même page partagent une seule lecture en base, et rien n'est
// conservé d'une requête à l'autre ni d'un visiteur à l'autre.
//
// Lire les en-têtes, c'est lire une donnée de la requête : une page qui appelle
// cette fonction ne peut pas être pré-rendue au build. Next la rend à chaque
// requête (symbole `ƒ` de `pnpm build`), sans rien avoir à déclarer.
export const getCurrentOwner = cache(async (): Promise<Owner | null> => {
  // Les en-têtes sont lus en premier, et l'ordre compte : pendant `pnpm build`,
  // Next essaie de pré-rendre chaque page. Il n'y a alors pas de requête, et
  // headers() lève une erreur interne de Next, qui lui signale que la page est
  // dynamique. L'exécution s'arrête donc ici, sans atteindre getAuth() : le
  // build n'a besoin ni du secret ni de la base.
  // Qui entoure cet appel d'un try doit rendre cette erreur à Next
  // (unstable_rethrow) : avalée, elle laisserait la page se pré-rendre.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
    // Lecture seule. Prolonger la session modifie la base ET le cookie, or un
    // Server Component ne peut pas écrire de cookie : les deux se
    // désaccorderaient. La prolongation est faite au même endroit pour les
    // deux, dans le proxy (voir ./session-renewal).
    query: { disableRefresh: true },
  });
  if (!session) {
    return null;
  }
  return { id: session.user.id, email: session.user.email };
});
