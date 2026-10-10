// Configuration de Better Auth, réservée au serveur.
// Aucune route HTTP n'expose la bibliothèque : inscription, connexion et
// déconnexion passent par des Server Actions qui appellent `getAuth().api.*`.
// Chaque entrée reste ainsi derrière notre propre validation (R9).
import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDb } from "../db";
import * as schema from "../db/schema";
import { requireEnv } from "../env";

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

function createAuth() {
  return betterAuth({
    // Signe le cookie de session : un jeton modifié ou inventé est rejeté sans
    // même interroger la base.
    secret: requireEnv("BETTER_AUTH_SECRET"),
    // Adresse publique de l'application. Son protocole décide de l'attribut
    // `Secure` du cookie (R17) : présent en https, absent en http (localhost).
    baseURL: requireEnv("BETTER_AUTH_URL"),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      // Le compte et son mot de passe haché sont deux lignes (user, account) :
      // dans une transaction, soit les deux existent, soit aucune.
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      // R7 : la longueur seule, sans règle de composition.
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // R11 : l'inscription ouvre aussitôt une session.
      autoSignIn: true,
    },
    session: {
      // R16 : 60 jours glissants. La prolongation n'est écrite en base qu'une
      // fois par jour, pour ne pas faire une écriture à chaque page affichée.
      expiresIn: 60 * ONE_DAY_IN_SECONDS,
      updateAge: ONE_DAY_IN_SECONDS,
    },
    // Le cookie de session garde les attributs par défaut de la bibliothèque,
    // qui sont ceux de R17 : HttpOnly, SameSite=Lax, chemin « / », et un contenu
    // limité au jeton signé.
    //
    // nextCookies recopie les cookies posés par Better Auth dans la réponse de
    // la Server Action en cours. Il doit rester le dernier plugin de la liste.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

// Créée au premier appel, puis réutilisée. Comme pour getDb, rien n'est lu à
// l'import : `pnpm build` n'a besoin ni du secret ni de la base.
export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}
