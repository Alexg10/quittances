"use server";

// Server Actions de la déconnexion (R18 de la spécification 02). Ce sont des
// points d'entrée HTTP publics : elles ne reçoivent et ne lisent aucun
// paramètre. La session à fermer est celle du cookie de la requête, et aucune
// autre.
//
// Il y en a deux, pour une seule raison : la fin de la déconnexion doit être un
// rechargement complet du document (voir sign-out-form.tsx).
// - signOut : le navigateur envoie le formulaire lui-même (sans JavaScript).
//   La réponse est une redirection HTTP, donc un rechargement complet.
// - closeSession : appelée par le formulaire quand JavaScript est actif. Elle
//   ne redirige pas : une redirection faite ici deviendrait une navigation
//   côté client, sans rechargement. C'est le navigateur qui change de page.
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/auth/auth";
import { getCurrentOwner } from "@/auth/current-owner";
import { SIGN_IN_PATH } from "@/auth/return-path";

export async function signOut(): Promise<void> {
  await deleteCurrentSession();
  // Même arrivée qu'il y ait eu une session ou non, sans message.
  redirect(SIGN_IN_PATH);
}

export async function closeSession(): Promise<void> {
  await deleteCurrentSession();
}

// Non exportée : ce n'est pas une Server Action, seulement le travail commun
// aux deux.
async function deleteCurrentSession(): Promise<void> {
  // Lecture préalable, pour une seule raison : si la base ne répond pas,
  // getCurrentOwner() lève une erreur et tout s'arrête ici. Sans elle,
  // Better Auth effacerait le cookie sans avoir pu supprimer la session : le
  // propriétaire se croirait déconnecté alors que son jeton resterait valable.
  // Sans session (déjà expirée, déjà fermée dans un autre onglet), la fonction
  // renvoie null et la suite se déroule sans erreur.
  await getCurrentOwner();

  // Supprime la session en base, puis efface le cookie du navigateur. Les
  // autres sessions du même compte ne sont pas touchées (R3).
  await getAuth().api.signOut({ headers: await headers() });
}
