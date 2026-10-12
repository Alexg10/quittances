# Fiche 14 — `cacheComponents`, rendu partiel et codes HTTP

## Ce que `cacheComponents` apporte

C'est le modèle de rendu que Next met en avant. Une même page mélange trois choses :

- du **statique**, pré-rendu au build ;
- du **caché**, marqué par la directive `"use cache"` ;
- du **dynamique**, lu à la requête (cookies, en-têtes, base), placé sous `<Suspense>`.

Le serveur envoie tout de suite une **coque** statique, puis diffuse les parties dynamiques dans le même flux : c'est le rendu partiel (PPR). L'utilisateur voit la structure de la page immédiatement, et le contenu personnalisé arrive ensuite. Le symbole `◐` de `pnpm build` désigne ces routes.

## Ce que cela coûte, mesuré sur ce projet

Toute page qui lit la session est « reprise » d'une coque, même vide. Or les en-têtes HTTP partent avec la coque, avant que la page sache ce qu'elle va répondre :

| Appel dans la page | Sans `cacheComponents` | Avec |
| --- | --- | --- |
| `notFound()` | 404 | 200, document que le script complète |
| `redirect()` | 307 | 200, redirection faite par le script |
| Formulaire refusé, sans JavaScript | erreurs réaffichées | formulaire vide, sans message |
| Contenu dynamique, sans JavaScript | visible | masqué, révélé par le script |

On avait accumulé les contournements : rendu bloquant déclaré page par page (`instant = false`), redirections confiées au proxy, page de connexion gardée statique, paramètre de retour lu dans l'en-tête `Referer`, rechargement complet à la déconnexion parce que Next gardait les pages récentes masquées dans le document.

## La décision

Le produit voulait les bons codes HTTP et des formulaires qui fonctionnent sans JavaScript. On a retiré `cacheComponents` : chaque page protégée est rendue en entier à chaque requête (`ƒ`), et HTTP redevient exact.

Ce qu'on a perdu : la coque instantanée et le cache par composant. Sur des pages privées, petites et propres à chaque utilisateur, il n'y avait presque rien à mettre en cache.

La règle à retenir : **le flux et le code HTTP sont en tension**. Dès que le serveur commence à répondre avant d'avoir décidé, il ne peut plus changer de code. Le rendu partiel vaut pour des pages publiques riches (catalogue, article, tableau de bord lourd) ; il sert mal des pages dont la première décision est « as-tu le droit de voir ceci ? ».

## Ce qui reste vrai sans `cacheComponents`

- `notFound()` répond 404, mais Next renvoie un document minimal que le script complète : l'écran « introuvable » est vide sans JavaScript. Pour avoir 404 **et** un HTML complet, il faudrait décider avant le rendu, dans le proxy, donc y lire la donnée. On a refusé : le proxy ne lit jamais une location.
- Un Server Component ne peut toujours pas écrire de cookie : le renouvellement de la session reste dans le proxy.
- Une adresse à l'encodage invalide (`/locations/%`) fait échouer Next avant la page : le proxy répond 400.

## Les codes à connaître

| Code | Sens | Usage dans le projet |
| --- | --- | --- |
| 200 | réussite | page affichée, formulaire refusé réaffiché |
| 303 | « voir ailleurs », suivi en GET | après un POST réussi sans JavaScript |
| 307 | redirection temporaire, méthode conservée | visiteur sans session vers la connexion |
| 308 | redirection permanente | barre oblique finale retirée par Next |
| 400 | requête mal formée | adresse à l'encodage illisible |
| 404 | introuvable | location d'un autre compte ou inexistante |
| 500 | erreur du serveur | Server Action venue d'une autre origine, refusée par Next |

## Questions d'entretien

**Qu'est-ce que le rendu partiel (PPR) ?**
La coque statique d'une page est servie immédiatement, et les parties qui dépendent de la requête arrivent ensuite dans le même flux, chacune sous sa limite `<Suspense>`. On a la vitesse du statique et la fraîcheur du dynamique.

**Quelle est sa contrepartie ?**
Le code HTTP et les en-têtes sont figés quand la coque part. Une page ne peut plus répondre 404 ou 307 après coup ; elle le fait par du JavaScript. Cela touche le référencement des pages d'erreur, les clients sans JavaScript, et tout ce qui lit le code de réponse.

**Comment choisir entre statique, dynamique et partiel ?**
Statique si le contenu est le même pour tous et change rarement. Dynamique si chaque réponse dépend de l'utilisateur et que la décision d'accès passe avant tout. Partiel si la page a une grande part commune et quelques zones personnalisées.

**Pourquoi 303 après un formulaire ?**
Le navigateur suit en GET : recharger la page d'arrivée ne renvoie pas le formulaire. C'est le motif « post, redirect, get ».

**Streaming et SEO, ou streaming et erreurs : quel est le lien ?**
Avec le flux, le serveur a déjà répondu 200 quand une erreur survient plus bas dans l'arbre. On la traite par une limite d'erreur côté client, pas par un code HTTP. Il faut donc faire tôt, avant tout rendu, ce qui doit changer le code de réponse.
