# Fiche 18 — Archiver ou supprimer : le cycle de vie d'une donnée

## Trois façons de faire disparaître

| | Effet | Réversible | Exemple |
| --- | --- | --- | --- |
| Suppression réelle | la ligne est effacée (`DELETE`) | non | quittance produite par erreur ; location sans quittance |
| Suppression logique (*soft delete*) | une colonne marque la ligne (`deleted_at`), que toutes les lectures doivent filtrer | oui, mais l'utilisateur croit avoir supprimé | non utilisée |
| Archivage | un état visible, voulu par l'utilisateur (`archived_at`), avec son écran | oui : `Restaurer` | location terminée |

L'archivage n'est pas une suppression logique déguisée. La suppression logique cache une donnée que l'utilisateur pense détruite, ce qui pose un problème de confiance et de droit à l'effacement. L'archivage est une fonction du produit : la location change de rangement, elle a sa page, et l'utilisateur peut ensuite la détruire pour de bon.

## Les règles du produit

- Une **quittance** se supprime, pour être refaite : c'est une erreur de saisie qu'on corrige.
- Une location **sans quittance** se supprime directement : créée par erreur, elle n'a aucune histoire.
- Une location **avec quittances** ne se supprime pas tant qu'elle est active. Elle doit être **terminée**, puis **archivée** ; depuis les archives, elle se supprime définitivement, avec toutes ses quittances, après une confirmation qui en annonce le nombre.
- Une location **en cours** ne s'archive pas : l'interface n'offre pas le lien et dit pourquoi, plutôt que d'afficher un bouton qui échoue.

L'idée : plus une action détruit, plus elle demande d'étapes. Et la friction est placée là où la perte serait réelle.

## Un état, pas un booléen

`archived_at` est une date, nulle tant que la location est active. Par rapport à un booléen `is_archived` : on sait **quand**, on peut trier les archives, et il n'existe pas d'état incohérent « archivée sans date ».

Les états d'une location se déduisent de deux colonnes : `end_date` et `archived_at`. Une contrainte `CHECK` interdit la combinaison impossible (archivée sans être terminée). On ne stocke pas un champ `status` à tenir à jour : ce qui se calcule ne se stocke pas.

## Le coût : chaque requête doit choisir

Le piège de tout marquage : une lecture qui oublie le filtre ressort les archives dans la liste active. Remèdes employés :

- **un seul module** lit la table ; `listRentals` et `listArchivedRentals` sont deux fonctions distinctes, le filtre n'est pas un paramètre optionnel ;
- **les écritures portent l'état attendu** dans leur `WHERE` (fiche 17) : modifier une location archivée n'écrit rien ;
- **l'interface suit l'état relu par le serveur**, pas celui que la page affichait.

## Consultation seule : dans l'interface et sur le serveur

Le détail d'une location archivée n'offre ni `Modifier`, ni `Mettre fin`, ni production de quittance. Retirer les liens ne protège rien : les adresses et les actions existent toujours. Donc :

- chaque page hors de propos (`/modifier`, `/fin`, `/archiver`…) redirige vers le détail ;
- chaque action relit l'état sous verrou et refuse.

**L'ordre des contrôles compte.** D'abord « cette location est-elle à moi ? » (sinon 404), ensuite seulement « son état permet-il cela ? » (sinon redirection). Dans l'ordre inverse, un autre compte recevrait une redirection pour une location archivée et un 404 pour une location inexistante : il apprendrait qu'elle existe, et dans quel état.

## Confirmer une action destructrice

- Une **page de confirmation**, avec sa propre adresse, plutôt qu'une boîte `confirm()` : elle fonctionne sans JavaScript, se lit au lecteur d'écran, et dit précisément ce qui sera perdu (« cette location et ses 12 quittances »).
- Le bouton destructeur a un style distinct, et n'est jamais le seul bouton : `Annuler` est à côté.
- L'action ne part que par un **POST**. Un GET, un préchargement ou un survol ne doit rien détruire.
- Après suppression : redirection (303), et le bouton Précédent ne fait rien réapparaître.

## Conserver ou effacer

Deux obligations tirent en sens inverse : garder les documents utiles (un bailleur peut devoir justifier d'un loyer des années après), et ne pas garder de données personnelles sans raison. Le produit laisse la décision au propriétaire et rend la suppression définitive réellement définitive : aucune copie cachée, le compte supprimé emporte tout. La durée de conservation recommandée reste un point à faire vérifier par un juriste.

## Questions d'entretien

**Suppression logique : avantages et inconvénients ?**
Elle permet d'annuler et de garder une trace. Elle complique chaque requête, fausse les contraintes d'unicité (il faut des index partiels), fait grossir les tables, et heurte le droit à l'effacement si rien ne purge. Je la réserve aux cas où l'annulation est un vrai besoin, avec une purge planifiée.

**Booléen ou date pour un état ?**
Une date nullable dit le fait et le moment, et rend un état incohérent impossible. Pour plus de deux états, un type énuméré ou des colonnes dont l'état se déduit, avec des contraintes `CHECK`.

**Comment rendre un écran « lecture seule » ?**
En retirant les commandes de l'interface **et** en refusant sur le serveur. L'interface est une politesse ; la règle est dans l'action et dans la requête.

**Désactiver un bouton ou le retirer ?**
Retirer avec une phrase d'explication quand l'action n'a pas de sens dans cet état : un bouton désactivé n'est pas focalisable et ne dit pas pourquoi. Désactiver pendant un envoi en cours, état transitoire.

**Comment concevoir une action irréversible ?**
Étape de confirmation explicite qui nomme ce qui sera perdu, style distinct, méthode POST, opération en transaction (tout ou rien), et pas de raccourci qui la déclenche par accident. Pour les cas graves, une étape intermédiaire réversible : ici, l'archivage.

**Pourquoi vérifier l'appartenance avant l'état ?**
Parce que deux réponses différentes selon l'état d'une ressource d'autrui sont une fuite d'information. Tant que l'appartenance n'est pas établie, la seule réponse est « introuvable ».
