# Fiche 12 — Sécurité d'une page de connexion

## Les attaques à connaître

| Attaque | Principe | Protection dans le projet |
| --- | --- | --- |
| Énumération de comptes | Savoir si une adresse a un compte, par le message, le code HTTP ou le temps de réponse | Un seul message pour tous les échecs, même réponse HTTP ; écart de temps accepté pour l'instant |
| Force brute | Essayer des mots de passe en série | Pas encore : limitation des tentatives reportée, à faire avant toute ouverture au public |
| Redirection ouverte | Un lien `…/connexion?retour=…` qui mène chez un tiers après une vraie connexion | Destination validée et reconstruite par le serveur |
| Fixation de session | L'attaquant impose un identifiant de session avant la connexion de la victime | Nouveau jeton à chaque connexion ; l'ancienne session du navigateur est fermée |
| CSRF de connexion | Faire connecter la victime, à son insu, au compte de l'attaquant | Next refuse une Server Action dont l'en-tête `Origin` ne correspond pas à l'hôte |

## La redirection ouverte trouvée en recette

Le paramètre `retour` ramène le propriétaire à la page qu'il demandait. La règle d'origine : accepter un chemin qui commence par `/`, pas par `//`.

La valeur `/.//exemple.test` passait : un seul `/` en tête. Le serveur la renvoyait telle quelle. Puis le routeur de Next, **dans le navigateur**, simplifiait le chemin en retirant le segment `.` : il restait `//exemple.test`, une adresse relative au protocole, donc un autre site.

Trois leçons :

1. **Valider n'est pas normaliser.** Ce qu'on a validé (une chaîne) n'était pas ce qui a été suivi (la même chaîne, normalisée par un autre programme). Remède : le serveur analyse la valeur, la reconstruit (`pathname + search + hash`) et renvoie **sa** version. Ce qui est validé est exactement ce qui est suivi.
2. **Liste d'interdits ou forme canonique.** Refuser `//` en tête, c'est énumérer des attaques, et on en oublie toujours une. Exiger une forme canonique (aucun `//`, aucun segment `.` ou `..`, aucune forme encodée de ces caractères) ferme la famille entière.
3. **Deux barrières indépendantes.** Le refus des formes non canoniques, puis le contrôle d'origine sur la destination reconstruite. Si l'une a un trou, l'autre tient.

## Ce que chaque niveau de test a vu

- **603 tests Vitest**, dont une propriété vérifiée sur 232 valeurs hostiles : tous verts, faille présente. Ils vérifiaient la chaîne renvoyée, pas ce qu'un navigateur en fait.
- **Recette dans un navigateur**, avec la consigne de chercher à casser : faille trouvée, parce que la QA a raisonné sur le routeur client.
- **Après correctif** : la propriété testée devient « le résultat ne change plus quand on le normalise », et un test de bout en bout rejoue l'attaque avec une vraie connexion.

Un test ne prouve que ce qu'il observe. Une fonction de sécurité se teste aussi là où sa sortie est consommée.

## Le temps de réponse comme canal

« Adresse inconnue » répondait en 69 ms, « mot de passe faux » en 95 ms : une requête en base de plus quand le compte existe. Le message est identique, mais le chronomètre révèle l'existence du compte. Remèdes classiques : limiter le nombre de tentatives, imposer une durée minimale de réponse, ou faire le même travail dans les deux cas.

## Autres points vus dans cette tâche

- **Le véhicule du paramètre.** La page de connexion reste statique : elle ne lit pas son adresse. L'action lit l'en-tête `Referer`, l'adresse de la page d'où part le formulaire. Sans cet en-tête, on arrive sur le tableau de bord : la panne est sûre.
- **Journaux.** Une exception non rattrapée affichait l'objet de connexion à la base, avec son hôte et son utilisateur. Un journal est une sortie comme une autre : on y écrit un nom d'erreur, pas un objet.
- **Cache de navigation.** Next garde dans le document, masquées, les pages récentes. À la déconnexion, on recharge le document entier. À la connexion, on vérifie par un test qu'aucun mot de passe n'y subsiste.

## Questions d'entretien

**Qu'est-ce qu'une redirection ouverte et comment s'en protéger ?**
L'application redirige vers une adresse fournie par l'utilisateur. Un lien vers le vrai site envoie alors la victime chez un tiers, souvent après une vraie connexion. Protections : n'accepter que des chemins internes, les analyser et renvoyer la forme reconstruite, ou n'accepter qu'un identifiant de destination pris dans une liste.

**Pourquoi `//exemple.test` est-il dangereux ?**
C'est une adresse relative au protocole : le navigateur garde `https:` et prend `exemple.test` comme hôte. Même chose pour `/\exemple.test` dans plusieurs navigateurs.

**Comment éviter l'énumération de comptes ?**
Même message, même code HTTP, même temps de réponse pour « compte inconnu » et « mot de passe faux », à la connexion comme à la réinitialisation. À l'inscription c'est plus difficile : la solution propre est de répondre « vérifiez vos e-mails » dans tous les cas.

**Qu'est-ce que la fixation de session ?**
L'attaquant fait utiliser à la victime un identifiant de session qu'il connaît, puis attend qu'elle se connecte. Protection : émettre un nouvel identifiant à chaque connexion et invalider l'ancien.

**Qu'est-ce que la défense en profondeur ?**
Plusieurs protections indépendantes pour un même risque, de sorte qu'un défaut dans l'une ne suffise pas. Ici : validation du chemin, reconstruction, contrôle d'origine, et refus par Next des actions venues d'un autre site.

**Que testez-vous sur une fonctionnalité de sécurité ?**
Les cas négatifs d'abord, des propriétés plutôt que des exemples, des mutations pour vérifier que les tests détectent une régression, et un test de bout en bout là où la valeur est réellement consommée.
