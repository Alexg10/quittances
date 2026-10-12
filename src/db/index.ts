// Accès à la base de données, réservé au serveur. Importer ce module depuis un
// Client Component fait échouer le build : la chaîne de connexion ne peut pas
// se retrouver dans le JavaScript envoyé au navigateur.
import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireEnv } from "../env";
import * as schema from "./schema";

// Le pool est gardé sur globalThis : en développement, le rechargement à chaud
// réévalue ce module à chaque modification, et chaque évaluation ouvrirait sinon
// un nouveau pool de connexions sans fermer le précédent.
declare global {
  var pgPool: Pool | undefined;
}

// Délai accordé à la base pour ouvrir une connexion, puis pour répondre à une
// requête. Cinq secondes : une base Neon mise en veille met une à deux secondes
// à se réveiller, et ne doit pas être prise pour une base en panne.
//
// Ce délai est tenu par le pilote, dans Node : passé cinq secondes, `pg` cesse
// d'attendre la réponse et lève une erreur. Il n'annule PAS la requête dans
// Postgres : si elle attendait un verrou, elle s'exécutera dès qu'il sera levé,
// alors que l'utilisateur a déjà lu « service indisponible » (bug B1 de la
// recette des locations). Pour une lecture, c'est sans conséquence. Pour une
// écriture, non : il faut que Postgres lui-même abandonne la requête.
const DATABASE_TIMEOUT_IN_MS = 5_000;

// Délais tenus par Postgres, pour les écritures. Passé ces délais, c'est la
// base qui annule la requête : elle ne peut donc plus s'exécuter plus tard.
// - lock : temps maximal passé à attendre un verrou ;
// - statement : temps maximal d'exécution d'une instruction, attente comprise.
//
// Ils sont calculés à partir du délai du pilote, jamais écrits en dur : ils
// restent ainsi plus courts que lui, quelle que soit sa valeur. C'est
// nécessaire : si le pilote abandonnait le premier, on retrouverait le bug.
// La seconde d'écart laisse à l'erreur d'annulation le temps de revenir.
//
// Ils ne peuvent pas être posés une fois pour toutes sur les connexions du
// pool : la chaîne de connexion passe par le « pooler » de Neon (PgBouncer en
// mode transaction), qui ignore ou refuse les réglages de session (mesuré).
// Ils sont donc posés au début de chaque transaction d'écriture, pour cette
// transaction seulement : voir runWriteTransaction, plus bas.
const WRITE_STATEMENT_TIMEOUT_IN_MS = DATABASE_TIMEOUT_IN_MS - 1_000;
const WRITE_LOCK_TIMEOUT_IN_MS = DATABASE_TIMEOUT_IN_MS - 2_000;

function getPool(): Pool {
  globalThis.pgPool ??= createPool();
  return globalThis.pgPool;
}

function createPool(): Pool {
  // Créer un Pool n'ouvre aucune connexion : la première part à la première requête.
  const pool = new Pool({
    connectionString: requireEnv("DATABASE_URL"),
    // Sans ces deux délais, une base qui accepte la connexion mais ne répond
    // jamais ferait attendre la page indéfiniment. Passé le délai, `pg` lève
    // une erreur, traitée comme toute panne de base (R24). `query_timeout` est
    // le filet pour une base muette ; il ne protège pas les écritures (voir
    // plus haut).
    connectionTimeoutMillis: DATABASE_TIMEOUT_IN_MS,
    query_timeout: DATABASE_TIMEOUT_IN_MS,
  });
  // Le pool garde des connexions ouvertes entre deux requêtes. Si la base coupe
  // l'une d'elles pendant qu'elle attend, `pg` le signale par l'événement
  // "error" du pool, puis retire lui-même la connexion. Sans écouteur, Node
  // traite cet événement comme une exception non rattrapée : elle peut arrêter
  // le serveur, et son affichage contient l'objet de connexion entier, avec
  // l'hôte, l'utilisateur et le nom de la base (constaté par la recette de T4).
  // On ne journalise que le nom de l'erreur. La requête suivante ouvrira une
  // nouvelle connexion, ou échouera et sera traitée comme une panne (R24).
  pool.on("error", (error) => {
    console.error("Base de données : connexion inactive perdue", error.name);
  });
  return pool;
}

// Une fonction plutôt qu'une constante exportée : rien n'est lu ni vérifié à
// l'import du module. `pnpm build` importe les modules des routes sans exécuter
// de requête ; il ne doit donc exiger ni base joignable ni DATABASE_URL.
export function getDb() {
  return drizzle({ client: getPool(), schema });
}

// Ce que reçoit le travail d'une transaction d'écriture : les mêmes méthodes
// que getDb() (select, insert, update, delete), mais toutes ses requêtes
// partent sur la connexion de la transaction.
export type WriteTransaction = NodePgDatabase<typeof schema>;

// Exécute `work` dans une transaction d'écriture : BEGIN, les délais tenus par
// Postgres, le travail, COMMIT. Deux garanties :
//
// 1. Une écriture qui échoue n'aboutit jamais plus tard. Tant que COMMIT n'est
//    pas envoyé, rien n'est définitif ; et Postgres annule lui-même toute
//    instruction qui attend un verrou ou dure trop longtemps, avant que le
//    pilote n'abandonne (voir les constantes plus haut).
// 2. Une connexion n'est rendue au pool que si la transaction s'est terminée
//    par un COMMIT réussi. Dans tous les autres cas, elle est détruite.
//
// C'est le SEUL moyen d'ouvrir une transaction d'écriture dans l'application.
// Ne pas appeler `getDb().transaction(…)` : en cas d'erreur, Drizzle envoie
// ROLLBACK puis rend la connexion au pool sans regarder si ROLLBACK a abouti.
// Quand l'erreur est un délai du pilote, la requête d'origine occupe encore la
// connexion et ROLLBACK ne part jamais : la connexion retourne au pool avec sa
// transaction ouverte. Les requêtes suivantes qui la réutilisent s'y exécutent
// alors sans être validées (elles répondent « une ligne modifiée », et rien
// n'est écrit), ou la valident plus tard avec l'écriture qui avait échoué.
// Constaté par la mesure, et rejoué par le test d'intégration voisin.
export async function runWriteTransaction<Result>(
  work: (tx: WriteTransaction) => Promise<Result>,
): Promise<Result> {
  // Une connexion réservée à cette transaction : toutes ses requêtes doivent
  // partir sur la même, ce que `pool.query` ne garantit pas.
  const client = await getPool().connect();
  // Vrai seulement après un COMMIT réussi. Dans le doute, on détruit.
  let committed = false;
  try {
    await client.query("BEGIN");
    // set_config(nom, valeur, true) est l'équivalent de SET LOCAL : le réglage
    // vaut pour cette transaction seulement et disparaît avec elle. Les valeurs
    // sont en millisecondes.
    await client.query(
      "select set_config('lock_timeout', $1, true), set_config('statement_timeout', $2, true)",
      [String(WRITE_LOCK_TIMEOUT_IN_MS), String(WRITE_STATEMENT_TIMEOUT_IN_MS)],
    );
    const result = await work(drizzle({ client, schema }));
    await client.query("COMMIT");
    committed = true;
    return result;
  } finally {
    // release(true) retire la connexion du pool et la ferme. Postgres annule
    // alors de lui-même la transaction restée ouverte : pas besoin de ROLLBACK,
    // qu'une connexion occupée ou muette ne recevrait de toute façon pas.
    // Détruire après toute erreur, même une simple contrainte refusée, coûte
    // une reconnexion ; c'est le prix d'une règle sans cas particulier.
    //
    // Cas limite qui reste : si c'est COMMIT lui-même qui dépasse le délai du
    // pilote, on ne sait pas si Postgres l'a reçu. L'appelant voit une erreur
    // alors que l'écriture a pu être validée.
    client.release(!committed);
  }
}

// Pour les scripts et les tests, qui doivent fermer les connexions pour se terminer.
export async function closeDb(): Promise<void> {
  await globalThis.pgPool?.end();
  globalThis.pgPool = undefined;
}
