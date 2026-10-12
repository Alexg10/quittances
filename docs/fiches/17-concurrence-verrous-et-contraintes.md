# Fiche 17 — Concurrence : verrous, contraintes, onglets restés ouverts

## Le problème : décider d'après une lecture périmée

Une page lit un état, l'utilisateur réfléchit, puis une action écrit. Entre les deux, tout a pu changer : un autre onglet, un double clic, une seconde requête partie au même instant.

```ts
// Faux : « lire, vérifier, écrire » (TOCTOU, time of check to time of use)
const rental = await getRental(owner, id);
if (rental.archivedAt === null) {
  await db.update(rental).set(values).where(eq(rental.id, id));
}
```

Entre le `if` et l'`update`, la location a pu être archivée. Le front senior doit connaître ce défaut : il naît dans les Server Actions, pas dans la base.

## Trois outils, du plus simple au plus fort

**1. La condition dans l'écriture.** L'`UPDATE` porte l'état attendu dans son `WHERE` et on compte les lignes touchées.

```sql
UPDATE rental SET archived_at = $3
WHERE id = $1 AND owner_id = $2 AND archived_at IS NULL AND end_date < $4
RETURNING id;   -- zéro ligne : rien n'a été écrit
```

Suffit quand la condition ne porte que sur la ligne écrite.

**2. La contrainte en base.** « Une quittance par location et par mois » est une contrainte `UNIQUE`. Deux productions simultanées du même mois : la base en accepte une. `INSERT … ON CONFLICT DO NOTHING RETURNING` rend zéro ligne à la seconde, sans erreur. Aucune lecture préalable ne peut garantir cela.

**3. Le verrou de ligne.** Quand la condition porte sur **une autre table** (« supprimer la location si elle n'a aucune quittance » pendant qu'une quittance se crée), la condition dans le `WHERE` ne suffit plus. À son niveau d'isolation par défaut, `READ COMMITTED`, Postgres donne à chaque instruction une photographie de la base prise à son début : les deux transactions ne se voient pas.

```sql
BEGIN;
SELECT … FROM rental WHERE id = $1 AND owner_id = $2 FOR UPDATE;  -- verrou
-- contrôles, puis écriture, sur un état que personne d'autre ne peut changer
COMMIT;
```

Toute écriture qui dépend de l'état d'une location commence par ce verrou (`lockRentalForWrite`). La seconde transaction attend la première, puis voit ce qu'elle a validé.

Règles pour ne pas se faire mal :

- **Borner l'attente** : `lock_timeout` posé par transaction. Sans lui, une requête attend indéfiniment, ou s'exécute après que l'utilisateur a lu « service indisponible » (bug réel du projet, fiche 08).
- **Toujours verrouiller dans le même ordre** (ici : la location, jamais autre chose avant), sinon deux transactions peuvent s'attendre mutuellement : interblocage.
- **Transactions courtes** : rien de lent (rendu PDF, appel réseau) pendant qu'un verrou est tenu.

## Clé étrangère : que devient l'enfant quand le parent disparaît

| `ON DELETE` | Effet | Dans le projet |
| --- | --- | --- |
| `CASCADE` | les lignes enfants sont effacées avec le parent | compte → locations, compte → quittances |
| `NO ACTION` (défaut) | l'effacement du parent est refusé s'il reste un enfant ; contrôlé en fin d'instruction | location → quittances |
| `RESTRICT` | refusé aussi, mais contrôlé immédiatement | non utilisé |
| `SET NULL` | l'enfant reste, sa référence est vidée | non utilisé |

`CASCADE` sur location → quittances aurait rendu la suppression triviale, et la perte de documents silencieuse : un chemin de code oubliant la règle effacerait des quittances sans un mot. Avec `NO ACTION`, il obtient une erreur. La suppression définitive efface donc elle-même les quittances, puis la location, dans une transaction.

Pourquoi `NO ACTION` et pas `RESTRICT` : en effaçant un compte, Postgres cascade vers ses locations **et** ses quittances dans la même instruction. À la fin, plus rien ne référence les locations effacées : `NO ACTION` passe. `RESTRICT` refuserait dès la première location.

La clé étrangère porte sur le couple `(rental_id, owner_id)` : la base garantit qu'une quittance a le même propriétaire que sa location. L'isolation ne repose pas sur la seule discipline du code.

## Défense en profondeur

Chaque règle importante est tenue deux fois : par le code (condition dans la requête) et par la base (`CHECK`, `UNIQUE`, clé étrangère). La recette le prouve par mutation : on retire la condition du code et on regarde si la base refuse.

## Ce que voit l'utilisateur

Un onglet resté ouvert propose encore `Modifier` sur une location archivée ailleurs. L'action ne lève pas d'erreur : elle n'écrit rien et ramène sur l'état réel. Les résultats des écritures sont des valeurs nommées (`"archived"`, `"not-applicable"`, `"not-found"`), pas des exceptions : l'action choisit la page d'arrivée d'après elles.

Le double clic se traite à trois étages : bouton désactivé pendant l'envoi (`isPending`), opération idempotente côté serveur, contrainte en base.

## Questions d'entretien

**Qu'est-ce qu'une condition de course ? Un exemple dans une application web ?**
Un résultat qui dépend de l'ordre d'arrivée de deux opérations. Exemple : deux onglets, l'un supprime une location « sans quittance » pendant que l'autre en produit une. Sans précaution, on obtient une quittance orpheline ou une erreur.

**Verrouillage optimiste ou pessimiste ?**
Optimiste : on n'empêche rien, on détecte le conflit à l'écriture (numéro de version ou condition dans le `WHERE`), et on demande de recommencer. Bon quand les conflits sont rares. Pessimiste : on verrouille avant de lire (`SELECT … FOR UPDATE`), les autres attendent. Bon quand la décision dépend de plusieurs lignes ou tables.

**Pourquoi une condition dans le `WHERE` ne suffit-elle pas toujours ?**
Elle protège la ligne écrite. Si la condition porte sur une autre table, deux transactions simultanées ne se voient pas en `READ COMMITTED`. Il faut un verrou commun, une contrainte, ou un niveau d'isolation plus strict (`SERIALIZABLE`, avec nouvel essai en cas d'échec).

**Comment garantir l'unicité ?**
Par une contrainte `UNIQUE` en base. Vérifier avant d'insérer ne garantit rien : deux requêtes passent la vérification en même temps.

**`CASCADE` ou non ?**
`CASCADE` quand l'enfant n'a aucun sens sans le parent et que sa perte est voulue. Sinon on refuse, pour que l'effacement soit un acte explicite du code. Un document émis ne doit jamais disparaître par effet de bord.

**Comment tester une course ?**
En test d'intégration contre une vraie base : on lance les deux opérations avec `Promise.all`, de nombreuses fois, et on vérifie l'invariant final (jamais deux quittances, jamais d'orpheline). Ou on tient un verrou depuis une seconde connexion pour forcer l'ordre. Un test unitaire avec une base simulée ne voit rien de tout cela.

**Qu'est-ce qu'une opération idempotente ?**
Une opération dont la répétition ne change rien de plus que la première exécution. Archiver une location déjà archivée ne fait rien et ne signale pas d'erreur : le double envoi devient inoffensif.
