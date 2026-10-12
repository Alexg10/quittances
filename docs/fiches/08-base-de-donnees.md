# Fiche 08 — Base de données : Postgres, Neon, ORM

## Le choix

- **Postgres** : les données sont relationnelles (comptes, locations, échéances, quittances) et doivent être cohérentes (contraintes, transactions).
- **Neon** : Postgres hébergé « serverless ». Le calcul se met en veille quand il ne sert pas, et la base se **branche** comme un dépôt git (copie instantanée, utile pour une base de test jetable).
- **Drizzle** : le schéma est écrit en TypeScript, les requêtes ressemblent à du SQL et leurs résultats sont typés. Les migrations sont des fichiers SQL versionnés.

## SQL direct, constructeur de requêtes, ORM

| | SQL direct | Drizzle | Prisma |
| --- | --- | --- | --- |
| On écrit | du SQL en chaînes | du TypeScript proche du SQL | une API objet propre à l'outil |
| Types des résultats | à la main | déduits du schéma | générés par une étape de build |
| Migrations | à la main | fichiers SQL générés | générées et gérées par l'outil |

Un ORM ne dispense pas de connaître SQL : il faut savoir quelle requête part réellement (jointure ou N requêtes, index utilisé ou non).

## Ce que la base change dans Next

- **Où lire** : dans un Server Component `async` ou une Server Action, jamais dans un Client Component. Le code d'accès à la base et la chaîne de connexion ne quittent pas le serveur.
- **Rendu** : une page qui lit des données propres à l'utilisateur (cookies) devient dynamique (`ƒ` dans `pnpm build`), alors que la page d'accueil reste statique (`○`).
- **Secrets** : la chaîne de connexion vit dans `.env.local`, hors de git. Une variable sans préfixe `NEXT_PUBLIC_` n'est jamais envoyée au navigateur.
- **Connexions** : en environnement serverless, chaque instance ouvre ses propres connexions. On passe par un pooler (Neon en fournit un) ou par un pilote HTTP, pour ne pas épuiser la base.

## Isolation des données entre comptes

Chaque table métier porte l'identifiant du propriétaire, et **chaque requête est filtrée dessus**, à partir de la session lue côté serveur, jamais à partir d'un identifiant envoyé par le navigateur. Postgres permet d'ajouter une seconde barrière, la sécurité au niveau des lignes (RLS), qui refuse au niveau de la base ce que le code aurait oublié de filtrer.

## Délais : côté client ou côté serveur

Un délai posé sur le pilote (`query_timeout` de `pg`) est un minuteur **côté client** : passé ce délai, l'application reçoit une erreur, mais la requête reste en file dans Postgres et s'exécute quand elle le peut. Trouvé en recette : une modification affichait « service indisponible », puis s'appliquait quand même une fois le verrou levé.

Pour qu'une écriture ne s'exécute jamais après son délai, c'est Postgres qui doit l'annuler : `lock_timeout` (attente d'un verrou) et `statement_timeout` (durée de l'instruction), plus courts que le délai du pilote.

Avec un répartiteur de connexions en mode transaction (PgBouncer, le « pooler » de Neon), un réglage de session ne tient pas : la connexion serveur change d'une requête à l'autre. On le pose pour la transaction (`SET LOCAL`, ou `set_config(nom, valeur, true)`).

Second piège : une transaction interrompue par le délai du pilote peut laisser la connexion dans une transaction ouverte. Rendue au pool, elle « empoisonne » la requête suivante, qui s'exécute sans jamais être validée. Règle retenue : une connexion ne retourne au pool qu'après un `COMMIT` réussi ; sinon on la détruit.

## Questions d'entretien

**Pourquoi SQL plutôt que NoSQL ici ?**
Les données ont des relations et des invariants (une quittance appartient à une échéance d'une location d'un propriétaire). Les clés étrangères et les transactions les garantissent. Un stockage de documents conviendrait à des données sans relations fortes ou à schéma très variable.

**Qu'est-ce que le problème N+1 ?**
Charger une liste (1 requête), puis faire une requête par élément pour ses données liées (N requêtes). Remède : une jointure, ou une seconde requête groupée avec `IN`.

**Qu'est-ce qu'une migration ?**
Un changement de schéma versionné et rejouable (créer une table, ajouter une colonne). On les applique dans l'ordre sur chaque environnement, et on ne modifie jamais une migration déjà appliquée en production : on en écrit une nouvelle.

**Qu'est-ce qu'une transaction ?**
Un groupe d'opérations tout ou rien. Exemple du projet : marquer le loyer reçu et créer la quittance doivent réussir ensemble ou échouer ensemble.

**Comment éviter l'injection SQL ?**
Requêtes paramétrées : les valeurs sont transmises séparément du texte de la requête. Un ORM ou un constructeur de requêtes le fait par défaut ; le danger revient dès qu'on concatène une chaîne.

**Où peut-on accéder à la base dans l'App Router ?**
Server Components, Server Actions, Route Handlers. Pour s'en assurer, on marque le module d'accès aux données avec le paquet `server-only` : l'importer depuis un Client Component fait échouer le build.
