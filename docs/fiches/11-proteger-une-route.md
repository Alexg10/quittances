# Fiche 11 — Protéger une route : proxy, rendu dynamique, pannes

## Où se fait le contrôle d'accès

**Au plus près des données**, pas à l'entrée. Chaque page protégée et chaque Server Action appelle `getCurrentOwner()` elle-même.

Le **proxy** (`src/proxy.ts`, l'ancien `middleware.ts`) s'exécute avant le rendu. Ici il fait deux choses, et aucune n'est une barrière de sécurité :

1. prolonger le cookie de session pendant la navigation ;
2. rediriger tôt, par une vraie réponse HTTP 307, un visiteur sans session.

Le test à se poser : si on supprime le proxy, une donnée privée devient-elle visible ? La réponse doit être non. Une Server Action est appelée par un POST direct : un proxy qui ne filtre que des chemins de pages ne la protège pas.

## Pourquoi le cookie se renouvelle dans le proxy

Un Server Component **ne peut pas écrire de cookie** : quand il s'exécute, les en-têtes de la réponse sont déjà partis (le HTML est envoyé en flux). Seuls une Server Action, un Route Handler ou le proxy le peuvent. La session était donc prolongée en base, mais pas dans le navigateur. Le proxy lit la session et recopie le `Set-Cookie`.

## Statique, partiel, dynamique

`pnpm build` affiche un symbole par route :

| Symbole | Rendu | Exemple |
| --- | --- | --- |
| `○` | pré-rendu une fois au build | `/`, `/inscription` |
| `◐` | coque statique, plus des parties rendues à la requête sous `<Suspense>` (rendu partiel) | `/tableau-de-bord` en T2 |
| `ƒ` | rendu à chaque requête | `/tableau-de-bord` en T3 |

Avec `cacheComponents`, lire les cookies ou les en-têtes rend un composant dépendant de la requête : il doit être sous `<Suspense>`, sinon le build échoue. Next envoie alors d'abord la coque et l'état de chargement, puis le contenu dans un bloc masqué qu'**un script révèle**.

Conséquence observée : sans JavaScript, le tableau de bord n'affichait que « Chargement en cours », donc pas le bouton de déconnexion. Solution retenue : `export const instant = false` sur la page, qui demande un **rendu bloquant**. Le serveur attend la session et envoie le contenu complet. On y gagne le fonctionnement sans JavaScript, on y perd l'état de chargement.

## Traiter la panne comme un état

Base injoignable : il y a trois réponses possibles, et une seule est juste.

- Afficher le contenu « dans le doute » : faille.
- Rediriger vers la connexion : trompeur, le propriétaire a une session valide et se reconnecter ne servira à rien.
- Afficher « service indisponible » sans rien de privé : c'est le bon comportement.

La page attrape l'erreur et rend l'écran de panne côté serveur (il s'affiche donc sans JavaScript). `error.tsx`, qui est un Client Component, reste un filet pour l'imprévu.

Deux pièges trouvés en chemin :

- la bibliothèque d'authentification écrivait dans le journal serveur la requête SQL **avec ses valeurs, dont le jeton de session** : on a restreint ce qu'elle journalise ;
- sa fonction de déconnexion effaçait le cookie même quand la base était en panne, laissant une session vivante côté serveur : l'action vérifie d'abord la session.

## Redirection ouverte

`/connexion?retour=…` ramène le propriétaire là où il allait. Si on redirige vers n'importe quelle valeur, un lien piégé envoie la victime sur un site d'hameçonnage après une vraie connexion. La valeur passe par une fonction pure, `getSafeReturnPath`, qui n'accepte qu'un chemin interne : refus de `https://…`, `//autre.site`, `/\\autre.site`, des encodages et des retours à la ligne.

## Questions d'entretien

**À quoi sert le middleware (proxy) et à quoi ne doit-il pas servir ?**
À ce qui se décide avant le rendu : redirections, réécritures, en-têtes, renouvellement de cookie. Pas au contrôle d'accès comme unique barrière : il ne voit pas les Server Actions de la même façon, son `matcher` peut oublier une route, et la vérification doit rester à côté de la lecture des données.

**Pourquoi un Server Component ne peut-il pas poser de cookie ?**
Le rendu est diffusé en flux : les en-têtes HTTP sont envoyés avant que le composant ait fini. Écrire un cookie demande une Server Action, un Route Handler ou le proxy.

**Qu'est-ce que le rendu partiel (PPR) ?**
La coque statique de la page est servie immédiatement, et les parties qui dépendent de la requête arrivent ensuite dans le même flux, chacune sous sa limite `<Suspense>`. On a le temps de réponse du statique et la fraîcheur du dynamique. Limite : la révélation du contenu différé passe par du JavaScript.

**Quel code HTTP pour une redirection après un POST ?**
303 « See Other » : le navigateur suit avec un GET, et recharger la page ne renvoie pas le formulaire. 307 conserve la méthode, il sert pour rediriger un GET en GET.

**Que doit-il se passer au bouton Précédent après une déconnexion ?**
Le contenu protégé ne doit pas réapparaître. Deux sources possibles : le cache du navigateur (en-têtes `Cache-Control`) et le cache de navigation côté client du framework, qui garde des pages en mémoire.

**Comment tester une page protégée ?**
Trois cas négatifs au minimum : sans cookie, avec un cookie inventé, avec une session expirée. On vérifie l'adresse d'arrivée, et surtout que la réponse elle-même (HTML, charge RSC, titre) ne contient rien de privé.
