# Fiche 01 — Création du projet Next.js

## Ce qu'on a fait

```bash
npx create-next-app@16.4.0 quittances --ts --tailwind --eslint --app --src-dir --use-pnpm
```

Versions installées : Next 16.4, React 19.3, TypeScript 5.9, Tailwind 4.

## Les choix et leur justification

| Option | Ce que ça fait | Pourquoi |
| --- | --- | --- |
| `--ts` | TypeScript | Les erreurs de type sont détectées à la compilation, pas en production. |
| `--app` | App Router (dossier `app/`) | Le routeur actuel de Next, bâti sur les React Server Components. L'ancien s'appelle Pages Router (dossier `pages/`). |
| `--src-dir` | Code dans `src/` | Sépare le code applicatif des fichiers de configuration à la racine. |
| `--tailwind` | Tailwind CSS | Styles par classes utilitaires, pas de CSS mort dans le build. |
| `--eslint` | ESLint + règles Next | Détecte les erreurs courantes (hooks mal utilisés, `<img>` au lieu de `<Image>`). |
| `--use-pnpm` | pnpm | Installation rapide, `node_modules` strict (pas de dépendance fantôme). |

## Les fichiers à connaître

- `src/app/layout.tsx` — le **layout racine**. Obligatoire, il contient `<html>` et `<body>` et enveloppe toutes les pages. Il n'est pas re-rendu quand on navigue d'une page à l'autre.
- `src/app/page.tsx` — la page de la route `/`. Dans l'App Router, **un dossier = un segment d'URL**, et c'est le fichier `page.tsx` qui rend ce segment accessible.
- `next.config.ts` — configuration de Next. Deux options sont activées par défaut :
  - `cacheComponents: true` — modèle de cache actuel : rien n'est mis en cache sauf ce qu'on marque avec la directive `"use cache"`. Une même page peut mélanger du statique, du caché et du dynamique.
  - `partialPrefetching: true` — un `<Link>` précharge seulement la coquille statique de la page cible, pas la page entière.
- `AGENTS.md` — consignes pour les agents IA : la doc de la version installée est dans `node_modules/next/dist/docs/`, à lire avant de coder.
- `tsconfig.json` — l'alias `@/*` pointe vers `src/*` (on écrit `@/components/x` au lieu de `../../components/x`).

## Ce que dit le premier build

```
Route (app)
┌ ○ /
└ ○ /_not-found

○ (Static) prerendered as static content
```

Le symbole `○` signifie que la page a été **pré-rendue en HTML au moment du build**. Elle ne lit ni cookie, ni base de données, ni paramètre de requête, donc Next peut la générer une seule fois et la servir telle quelle.

## Questions d'entretien

**Quelle différence entre App Router et Pages Router ?**
Le Pages Router rend des composants React classiques, avec `getServerSideProps` / `getStaticProps` pour charger les données par page. L'App Router repose sur les Server Components : les composants sont rendus côté serveur par défaut, peuvent être `async` et charger leurs données directement, et seuls ceux marqués `"use client"` envoient du JavaScript au navigateur. Il apporte aussi les layouts imbriqués et le streaming.

**À quoi sert un layout, et en quoi diffère-t-il d'une page ?**
Un layout enveloppe les pages d'un segment et de ses sous-segments. Il conserve son état et n'est pas re-rendu lors d'une navigation entre ses pages enfants. Une page est propre à une URL.

**Comment Next décide-t-il qu'une page est statique ou dynamique ?**
Par ce qu'elle utilise. Tant qu'elle ne dépend de rien de propre à la requête (cookies, en-têtes, paramètres de recherche, données non mises en cache), elle est pré-rendue au build. Dès qu'un composant lit une de ces sources, cette partie est rendue à la requête.

**Pourquoi `next/font` et `next/image` plutôt que les balises classiques ?**
`next/font` héberge la police avec l'app (pas de requête vers Google) et évite le décalage de mise en page au chargement. `next/image` redimensionne, convertit en formats modernes, charge en différé et réserve la place de l'image. Les deux améliorent les Core Web Vitals (CLS, LCP).
