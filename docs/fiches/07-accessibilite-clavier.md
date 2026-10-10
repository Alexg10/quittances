# Fiche 07 — Accessibilité au clavier : lien d'évitement, focus, ancres

## Lien d'évitement

Premier élément focalisable de la page, il mène directement au contenu (`<a href="#contenu">`). Sans lui, un utilisateur au clavier retraverse toute la navigation à chaque page. C'est le critère WCAG 2.4.1 « Contourner des blocs », niveau A.

Il est masqué tant qu'il n'a pas le focus, mais reste **focalisable** : on ne le cache donc ni avec `display: none` ni avec `visibility: hidden`, qui le retireraient de la tabulation. Ici : taille nulle et `overflow: hidden` au repos, taille normale au focus.

## Focus visible

- `:focus` s'applique quel que soit le moyen (souris, clavier). `:focus-visible` ne s'applique que lorsque le navigateur juge l'indicateur utile, en pratique au clavier : c'est lui qu'on stylise.
- Ne jamais écrire `outline: none` sans remplacement. Critère WCAG 2.4.7 « Focus visible », niveau AA.
- `outline` ne prend pas de place dans la mise en page et suit `border-radius` ; `outline-offset` l'écarte de l'élément, ce qui le garde lisible sur un bouton de la même couleur.

Ce qu'on a fait : une seule règle globale `a:focus-visible` dans `globals.css` (contour plein de 2px en `primary`, décalé de 2px, plus l'ombre `focus`).

Piège rencontré : la classe `transition` de Tailwind anime aussi `outline-color` et `box-shadow`. Le contour de focus partait d'une autre couleur et apparaissait en fondu. On limite donc la transition aux propriétés voulues (`transition-[background-color,translate]`).

## Ancres et en-tête fixe

Un en-tête en `position: fixed` recouvre le haut de la fenêtre : après un clic sur `#fonctionnement`, le titre visé se retrouve caché dessous. Deux remèdes en CSS, sans JavaScript :

- `scroll-padding-top` sur `html` : réserve une zone en haut du conteneur de défilement, pour toutes les ancres d'un coup. C'est ce qu'on a choisi (72px : 56px d'en-tête et 16px d'air).
- `scroll-margin-top` sur chaque cible : même effet, élément par élément.

Le contenu en haut de page doit aussi commencer sous l'en-tête : `main` reçoit un `padding-top` augmenté de la hauteur de la barre.

## Masquer sans casser

| Technique | Visible | Lecteur d'écran | Tabulation |
| --- | --- | --- | --- |
| `display: none`, `visibility: hidden`, attribut `hidden` | non | non | non |
| classe « sr-only » (1px, `clip`) | non | oui | oui |
| `aria-hidden="true"` | oui | non | **oui** (à éviter sur un élément focalisable) |
| `opacity: 0` | non | oui | oui |

La navigation de l'en-tête est en `display: none` sous 768px : absente de l'écran, de l'arbre d'accessibilité et de la tabulation, mais présente dans le DOM. C'est pourquoi le test Vitest la trouve (jsdom n'applique pas les media queries) alors que Playwright constate qu'elle est inatteignable sur mobile.

## `next/link` ou `<a>`

`Link` fait une navigation côté client (sans rechargement du document) et précharge la route. C'est un Client Component : il est hydraté. Sans JavaScript il reste un `<a href>` ordinaire. La règle ESLint de Next impose `Link` pour les routes internes. Pour une ancre de la même page (`#section`) ou un lien externe, un `<a>` suffit.

Bug rencontré à la recette : le logo, un `Link` vers `/`, ne ramenait pas en haut de page quand on était déjà sur `/`. En navigation client, `Link` conserve la position de défilement tant que la page visée est déjà visible, et son option `scroll` ne sait que désactiver le défilement, pas le forcer. Depuis `/#inscriptions` cela fonctionnait, parce que l'adresse changeait.

Premier correctif, refusé : un `<a href="/">` natif. Il règle le défilement, mais recharge tout le document : on perd la navigation client et on doit désactiver une règle ESLint.

Correctif retenu : garder `Link` et isoler le logo dans un Client Component minimal, `src/app/logo-link.tsx` :

```tsx
"use client";
<Link href="/" onNavigate={() => window.scrollTo(0, 0)}>Quittances</Link>
```

- `onNavigate` ne s'exécute que pour une navigation côté client : un Cmd ou Ctrl + clic (nouvel onglet) ne fait pas défiler la page courante. Avec `onClick`, il aurait fallu tester les touches à la main.
- La frontière `"use client"` est placée le plus bas possible : seul le logo devient client. `page.tsx`, l'en-tête et la navigation restent serveur, et la page reste pré-rendue (`○ /`).
- Un gestionnaire d'événement (`onNavigate`, `onClick`) est une fonction : elle ne peut pas être passée en prop depuis un Server Component, d'où le composant dédié.

Ce bug n'a été vu ni par le développeur, ni par les tests Vitest (jsdom ne défile pas et n'a pas de routeur), ni par axe : seule la recette du parcours dans un vrai navigateur l'a trouvé.

## Questions d'entretien

**Comment testez-vous l'accessibilité au clavier ?**
Je parcours la page avec Tab et Maj+Tab : chaque élément interactif est atteint, dans un ordre logique, avec un focus visible, et rien ne piège le focus. Entrée et Espace activent, Échap ferme. En automatique : axe pour les règles détectables, et des tests e2e qui tabulent et vérifient l'élément actif.

**`tabindex` : quelles valeurs ?**
`0` place l'élément dans l'ordre naturel, `-1` le rend focalisable par script seulement, une valeur positive impose un ordre et est à proscrire. Un `<a href>` ou un `<button>` n'en ont pas besoin.

**Différence entre `:focus`, `:focus-visible` et `:focus-within` ?**
`:focus` : l'élément a le focus. `:focus-visible` : il l'a et l'indicateur doit être montré. `:focus-within` : lui ou l'un de ses descendants a le focus (utile pour styliser un champ composé).

**Comment gérez-vous le focus dans une application à navigation côté client ?**
Après un changement de route, le focus ne revient pas seul en haut de page : il faut le déplacer (vers le titre principal, par exemple) et annoncer le changement. Next annonce le titre de la nouvelle route par un annonceur intégré.

**Pourquoi un `<div onClick>` n'est-il pas un bouton ?**
Il n'est ni focalisable, ni activable au clavier, ni annoncé comme bouton. Il faudrait ajouter `role`, `tabindex` et la gestion des touches : autant utiliser `<button>`.
