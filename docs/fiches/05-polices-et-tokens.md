# Fiche 05 — Polices avec `next/font` et tokens de design

## `next/font` : ce que ça fait

`next/font/google` télécharge les fichiers de police **au build** et les sert depuis le domaine de l'application. Conséquences :

- aucune requête du navigateur vers `fonts.googleapis.com` : une connexion de moins à ouvrir, et aucune adresse IP de visiteur transmise à Google (sujet RGPD) ;
- les fichiers sont mis en cache longtemps, leur nom contient une empreinte ;
- Next génère une **police de repli aux métriques ajustées** (`size-adjust`, `ascent-override`…) : le texte occupe la même place avant et après l'arrivée de la vraie police, donc pas de décalage de mise en page ;
- la police est préchargée (`<link rel="preload">`) pour les routes qui l'utilisent.

On ne charge que les graisses utiles (`weight: ["400", "500"]`) et le sous-ensemble `latin` : chaque graisse est un fichier de plus.

## Ce qu'on a configuré

- `src/app/layout.tsx` : trois polices (Plus Jakarta Sans 700, DM Sans 400 et 500, JetBrains Mono 400). Chacune expose une **variable CSS** (`variable: "--font-display-face"`) posée sur `<html>` par une classe.
- `src/app/globals.css` : bloc `@theme static` de Tailwind 4. Les tokens (`--color-primary`, `--text-title`, `--shadow-focus`…) y sont définis une seule fois, et Tailwind en tire à la fois des variables CSS et des utilitaires (`bg-primary`, `text-title`).
  - `static` : Tailwind 4 n'émet par défaut que les variables réellement utilisées ; ce mot-clé les émet toutes.
  - `--color-*: initial` : supprime la palette par défaut. `bg-zinc-50` n'existe plus, on ne peut plus sortir du design system par accident.
  - `--font-display: var(--font-display-face)` : le token du thème pointe vers la variable de `next/font`, sous un nom différent pour éviter qu'ils se marchent dessus.

## Tokens de design

Un token est une décision de design nommée (`primary`, `text-secondary`) au lieu d'une valeur (`#4F46E5`). On change la valeur à un seul endroit, et le nom dit l'intention.

Exemple vécu : le bouton blanc sur `#6366F1` donnait un contraste de 4.47:1, sous le seuil AA de 4.5:1. La correction a tenu en deux lignes parce qu'aucun composant n'écrivait la couleur en dur.

## Questions d'entretien

**Qu'est-ce que le CLS et comment les polices le dégradent-elles ?**
Cumulative Layout Shift : la somme des déplacements inattendus d'éléments pendant la vie de la page (bon en dessous de 0.1). Une police web qui remplace la police de repli change la largeur et la hauteur du texte, donc pousse le contenu. Remèdes : police de repli aux métriques ajustées (ce que fait `next/font`), préchargement, dimensions réservées.

**FOIT, FOUT, `font-display` ?**
FOIT : texte invisible tant que la police n'est pas chargée. FOUT : texte affiché en police de repli puis remplacé. `font-display: swap` choisit le FOUT (le texte est lisible tout de suite), `optional` n'utilise la police web que si elle est déjà disponible. `next/font` applique `swap` par défaut et réduit le saut visuel grâce au repli ajusté.

**Pourquoi auto-héberger les polices plutôt qu'utiliser le CDN de Google ?**
Le cache des navigateurs est cloisonné par site depuis 2020, donc l'argument « déjà en cache » ne tient plus. Auto-héberger évite une résolution DNS et une connexion TLS vers un autre domaine, et ne transmet rien à un tiers.

**Variables CSS ou valeurs dans la configuration Tailwind ?**
Avec Tailwind 4 c'est la même chose : le thème est déclaré en CSS (`@theme`) et produit des variables. Elles sont lisibles à l'exécution (`getComputedStyle`), utilisables hors des classes utilitaires, et redéfinissables localement (thème, composant).

**Où déclarer les polices dans l'App Router ?**
Dans le layout racine, un Server Component : la déclaration est évaluée au build, aucun JavaScript n'est envoyé au navigateur pour cela. Déclarer une police dans plusieurs fichiers crée plusieurs instances ; on l'exporte depuis un seul module si plusieurs fichiers en ont besoin.

**Comment vérifier un contraste ?**
Rapport de luminance relative entre texte et fond : 4.5:1 pour le texte courant, 3:1 pour le grand texte (24px, ou 18.66px en gras) et les composants d'interface, au niveau AA. Outils : axe, les outils de développement du navigateur. Un audit automatique ne remplace pas la vérification des états (survol, focus, désactivé).
