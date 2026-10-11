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
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./sign-up-validation";

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
      // R7 : la longueur seule, sans règle de composition. La règle qui fait
      // foi est validateNewPassword (./sign-up-validation), appliquée avant :
      // elle compte en caractères Unicode. Better Auth compte autrement, en
      // unités UTF-16 (`String.length`), où un emoji vaut 2. Ses deux bornes
      // sont donc réglées pour ne jamais refuser un mot de passe que notre
      // règle accepte :
      // - 12 caractères font au moins 12 unités ;
      // - 128 caractères font au plus 256 unités.
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH * 2,
      // R11 : l'inscription ouvre aussitôt une session.
      autoSignIn: true,
    },
    logger: {
      level: "warn",
      // Par défaut, Better Auth écrit dans le journal l'erreur d'origine à la
      // suite de son message. Quand la base ne répond pas, cette erreur
      // contient la requête SQL et ses valeurs : un jeton de session, une
      // adresse e-mail, un mot de passe haché. Constaté sur le build de
      // production. On ne garde donc que le niveau et le message, qui sont des
      // textes fixes de la bibliothèque : ses autres arguments sont ignorés.
      log: (level, message) => {
        const line = `Better Auth [${level}] ${message}`;
        if (level === "error") {
          console.error(line);
        } else {
          console.warn(line);
        }
      },
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
