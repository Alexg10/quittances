# Fiche 06 — Server Components et HTML sémantique

## Server Component, Client Component

Dans l'App Router, tout composant est un **Server Component** par défaut.

| | Server Component | Client Component (`"use client"`) |
| --- | --- | --- |
| S'exécute | au build ou sur le serveur, jamais dans le navigateur | sur le serveur pour le premier HTML, **puis** dans le navigateur |
| Son code part au navigateur | non | oui |
| Peut | être `async`, lire la base, des secrets, le système de fichiers | utiliser `useState`, `useEffect`, des gestionnaires d'événements, les API du navigateur |
| Ne peut pas | avoir d'état, d'effet, de `onClick` | être `async`, lire un secret |

`"use client"` ne veut pas dire « rendu uniquement dans le navigateur » : un Client Component est aussi pré-rendu en HTML côté serveur. La directive marque une **frontière** : ce fichier et tout ce qu'il importe entrent dans le JavaScript envoyé au navigateur.

**Hydratation** : React, dans le navigateur, reprend le HTML déjà affiché et y attache l'état et les gestionnaires d'événements. Seuls les Client Components sont hydratés.

## Ce qu'on a fait

`src/app/page.tsx` est un Server Component synchrone : des tableaux de données, du JSX, aucun état, aucun événement. Conséquences vérifiables :

- `pnpm build` affiche `○ /` : la page est pré-rendue une fois, au build ;
- elle fonctionne JavaScript désactivé : le bouton est un lien `<a href="#fonctionnement">`, la navigation est faite par le navigateur ;
- aucune erreur d'hydratation possible sur son contenu, puisqu'il n'y a rien à hydrater.

Règle pratique : rester serveur tant qu'on n'a pas besoin d'interactivité, et placer `"use client"` le plus bas possible dans l'arbre (le bouton, pas la page).

## HTML sémantique

- **Lien ou bouton** : un lien emmène quelque part (`href`), un bouton déclenche une action. Un « bouton » qui navigue est un `<a>` stylé.
- **Titres** : un seul `h1`, puis `h2`, `h3` sans sauter de niveau. Les lecteurs d'écran naviguent par titres.
- **Repères** : `header` (`banner`), `nav`, `main`, `footer` (`contentinfo`). Un `footer` placé dans `main` ou `section` n'est plus un repère.
- **Listes** : `ol` quand l'ordre a un sens (des étapes), `ul` sinon. Le numéro affiché à côté d'une étape est décoratif, donc `aria-hidden`, puisque `ol` porte déjà le rang.
- **`section`** : devient un repère `region` seulement si elle a un nom accessible (`aria-labelledby` vers son titre).

## Questions d'entretien

**Quelle différence entre un Server Component et le SSR ?**
Le SSR est une stratégie de rendu : produire du HTML sur le serveur, puis hydrater toute la page. Les Server Components sont un type de composant dont le code ne quitte jamais le serveur et qui n'est pas hydraté. On peut avoir du SSR sans Server Components (Pages Router) ; l'App Router combine les deux.

**Que se passe-t-il quand un Server Component rend un Client Component ?**
Le serveur produit le HTML des deux. Pour le Client Component, il transmet aussi une référence vers son code et ses props, sérialisées dans la charge RSC. Les props doivent donc être sérialisables : pas de fonction (sauf Server Action), pas d'instance de classe.

**Un Client Component peut-il contenir un Server Component ?**
Il ne peut pas l'importer, mais il peut le recevoir en `children` ou en prop : le Server Component est rendu par le serveur et passé déjà résolu. C'est le motif pour garder un contexte ou une mise en page interactive sans rendre toute la page cliente.

**Qu'est-ce qu'une erreur d'hydratation ?**
Le HTML du serveur ne correspond pas au premier rendu dans le navigateur : `Date.now()`, `Math.random()`, `window`, fuseau horaire, HTML invalide (`div` dans `p`). Remèdes : rendre déterministe, déplacer dans un `useEffect`, ou calculer la valeur côté serveur et la passer en prop.

**Pourquoi réduire le JavaScript envoyé ?**
Moins à télécharger, analyser et exécuter : meilleur INP et meilleur temps avant interactivité, surtout sur mobile. Et moins de surface d'erreur côté navigateur.

**Quand un composant doit-il devenir client ?**
Dès qu'il lui faut un état, un effet, un gestionnaire d'événement, une API du navigateur ou un hook qui en dépend. Pas pour afficher des données.
