// Fermeture de l'ancienne session quand un propriétaire se connecte dans un
// navigateur qui en porte déjà une (R3 de la spécification 02, précision après
// T4). Exemple : /connexion resté ouvert dans un onglet pendant qu'on se
// connectait dans un autre. Better Auth ne le fait pas de lui-même : sa
// connexion crée une session et remplace le cookie, mais laisse l'ancienne
// session valable en base jusqu'à son expiration.
import "server-only";

import { cookies, headers } from "next/headers";

import { getAuth } from "./auth";
import { getSessionCookieName } from "./session-renewal";

// Renvoie le jeton de la session que porte la requête en cours, ou null s'il
// n'y en a pas (pas de cookie, cookie inventé, session expirée ou fermée).
// À appeler AVANT la connexion : devant une session expirée, Better Auth
// efface le cookie de session, et cet effacement ne doit pas passer après
// l'écriture du nouveau cookie.
// Si la base est injoignable, l'erreur remonte : la connexion échouerait aussi.
export async function readPreviousSessionToken(): Promise<string | null> {
  // Cas ordinaire, sans cookie de session : aucune lecture en base.
  const cookieStore = await cookies();
  if (!cookieStore.has(await getSessionCookieName())) {
    return null;
  }
  // Better Auth vérifie la signature du cookie avant de lire la base, et ne
  // renvoie que la session de ce cookie : jamais une autre session du même
  // compte. Lecture seule (disableRefresh), comme dans ./current-owner.
  const previous = await getAuth().api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
  return previous ? previous.session.token : null;
}

// Supprime la session désignée par ce jeton, et elle seule. Le jeton de
// l'ancienne session est refusé ensuite.
// À appeler APRÈS une connexion réussie. Cette fonction ne lève jamais
// d'erreur : à ce moment, la nouvelle session existe et son cookie est posé.
// Si la base ne répond plus, la connexion reste réussie ; l'ancienne session
// subsiste simplement jusqu'à son expiration, comme avant ce correctif.
export async function closePreviousSession(token: string): Promise<void> {
  try {
    const context = await getAuth().$context;
    // La fonction dont Better Auth se sert lui-même à la déconnexion.
    await context.internalAdapter.deleteSession(token);
  } catch (error) {
    // On ne journalise que le type de l'erreur, jamais son contenu ni le jeton.
    console.error(
      "Connexion : ancienne session non fermée",
      error instanceof Error ? error.name : typeof error,
    );
  }
}
