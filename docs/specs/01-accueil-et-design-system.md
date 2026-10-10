# 01 — Page d'accueil publique et socle du design system

Statut : validée par l'utilisateur le 2026-10-10 (Q1, Q2, Q4 et Q6 tranchées selon les hypothèses recommandées ; `DESIGN.md` mis à jour pour Q1 et Q4). Première fonctionnalité du projet, elle sert aussi à roder la chaîne spec → développeur → tests → QA.

Références : `CLAUDE.md` (produit), `DESIGN.md` (design system), `docs/AVANCEMENT.md` (décisions). Le code applicatif se trouve dans `src/app/` (le projet a été créé avec `--src-dir`).

## Objectif

Un propriétaire bailleur qui arrive sur `/` doit comprendre en moins d'une minute ce que fait Quittances : un e-mail le jour de l'échéance, une confirmation du loyer, puis une quittance PDF ou une relance envoyée au locataire, et un tableau de bord. En même temps, le design system de `DESIGN.md` est installé une fois pour toutes dans le code (polices, tokens, layout racine), pour que toutes les fonctionnalités suivantes s'appuient dessus au lieu de réinventer couleurs et tailles.

## Périmètre

### Inclus

1. **Socle du design system** : chargement des trois polices, tokens (couleurs, typographie, ombres, rayons, espacements) utilisables dans Tailwind, styles globaux, layout racine (langue, métadonnées), suppression du contenu et du thème sombre hérités de `create-next-app`.
2. **Page d'accueil publique `/`** : en-tête, bloc d'accroche avec appel à l'action, section « Comment ça marche », section « Ce que fait Quittances », section « Les inscriptions ouvrent bientôt », pied de page. Contenus fournis mot pour mot plus bas.

### Exclu

- Base de données, authentification, envoi d'e-mail, formulaire (même non fonctionnel), champ de saisie.
- Pages d'inscription, de connexion, mentions légales, contact : elles n'existent pas et ne sont pas créées ici. Aucun lien ne pointe vers elles.
- Thème sombre.
- Menu mobile en tiroir (hamburger), menu du compte : la navigation applicative de `DESIGN.md` sera spécifiée avec les premières pages connectées.
- Composants du design system non utilisés par la page d'accueil (champs, chips de statut, listes, dialogues, interrupteurs, états vides). Seuls leurs tokens sont posés.
- Page 404 personnalisée : celle de Next reste en l'état.
- Favicon et logo graphique : le logo est le mot « Quittances » en texte ; le favicon existant est conservé.
- Images, illustrations, icônes, animations au défilement, statistiques, témoignages, tarifs.
- Mesure d'audience, cookies, bandeau de consentement.
- Document PDF, quittance d'exemple.

## Règles métier

Il n'y a pas de logique métier (montants, dates, bail) dans cette fonctionnalité. Les règles ci-dessous portent sur le socle, le contenu et la présentation.

### Socle

**R1 — Langue.** Le document HTML déclare la langue `fr`.

**R2 — Métadonnées.** Les métadonnées par défaut du site sont exactement :

- titre : `Quittances — quittances de loyer et relances par e-mail`
- description : `Un e-mail le jour de l'échéance, vous confirmez le loyer reçu, et la quittance PDF ou la relance part chez votre locataire.`

**R3 — Polices.** Trois familles, chargées avec `next/font/google` (donc servies par l'application elle-même, sans requête du navigateur vers les serveurs de Google) :

| Rôle | Famille | Usage | Graisses nécessaires |
| --- | --- | --- | --- |
| display | Plus Jakarta Sans | tous les titres (`h1` à `h3`) et le logo texte | 700 |
| body | DM Sans | tout le reste ; c'est la police par défaut de `body` | 400 et 500 |
| mono | JetBrains Mono | références et identifiants ; aucune utilisation sur la page d'accueil | 400 |

La règle « pas plus de deux graisses par écran » de `DESIGN.md` est interprétée par famille : 700 seul pour Plus Jakarta Sans, 400 et 500 pour DM Sans. Aucune autre graisse n'est utilisée (voir Q4).

**R4 — Couleurs.** Les tokens de couleur sont les suivants. Les noms sont le contrat partagé avec les spécifications suivantes.

| Token | Valeur | Remarque |
| --- | --- | --- |
| `primary` | `#4F46E5` | Écart assumé avec `DESIGN.md` (`#6366F1`), voir R5 et Q1 |
| `primary-hover` | `#4338CA` | Écart assumé avec `DESIGN.md` (`#4F46E5`), voir R5 et Q1 |
| `neutral` | `#9C9C9C` | Jamais pour du texte à lire |
| `background` | `#FAFAFA` | Fond de page |
| `surface` | `#FFFFFF` | Cartes, fond de l'en-tête |
| `text-primary` | `#0A0A0A` | Titres, texte courant |
| `text-secondary` | `#6B6B6B` | Descriptions, surtitre, pied de page |
| `border` | `#E8E8EC` | Bordures et filets |
| `success` | `#10B981` | Non utilisé sur la page d'accueil |
| `warning` | `#F59E0B` | Non utilisé sur la page d'accueil |
| `error` | `#EF4444` | Non utilisé sur la page d'accueil |

**R5 — Contraste de la couleur primaire.** `DESIGN.md` impose à la fois un bouton primaire à texte blanc sur fond `#6366F1` et un contraste d'au moins 4.5:1 pour tout texte. Ces deux exigences sont incompatibles : blanc sur `#6366F1` donne environ 4.47:1, et l'analyse axe de la QA le signalera. Cette spécification retient donc `#4F46E5` pour `primary` (environ 6.3:1 avec le blanc) et `#4338CA` pour `primary-hover`. Sur ce point, et sur ce point seulement, la spécification prime sur `DESIGN.md` tant que Q1 n'est pas tranchée autrement.

**R6 — Échelle typographique.** Les tailles de `DESIGN.md` sont exposées comme tokens. Les interlignes et interlettrages non précisés par `DESIGN.md` sont fixés ici.

| Token | Taille | Interligne | Interlettrage | Famille et graisse |
| --- | --- | --- | --- | --- |
| `display` | 72px | 1.1 | -0.04em | display 700 |
| `headline` | 60px | 1.1 | -0.04em | display 700 |
| `title` | 32px | 1.25 | -0.03em | display 700 |
| `subtitle` | 24px | 1.25 | -0.03em | display 700 |
| `body` | 15px | 1.6 | normal | body 400 |
| `small` | 13px | 1.6 | normal | body 400 |
| `caption` | 12px | 1.6 | normal | body 400 |
| `overline` | 11px | 1.6 | 0.08em, capitales | body 500 |

**R7 — Ombres.** Trois tokens : `card-hover` = `0 8px 30px rgba(0,0,0,0.08)` ; `primary-glow` = `0 4px 12px rgba(79,70,229,0.35)` ; `focus` = `0 0 0 3px rgba(79,70,229,0.12)`. Les deux dernières sont teintées de la couleur `primary` retenue en R4. Aucun élément statique ne porte d'ombre.

**R8 — Rayons et espacements.** Seules les valeurs de `DESIGN.md` sont employées : rayons 4, 6, 8, 12 et 9999px ; espacements 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 et 96px. Conteneur : largeur maximale 1280px, centré, 24px de marge intérieure horizontale. Espacement vertical entre sections : 32px en mobile, 48px en tablette, 64px en bureau.

**R9 — Points de rupture.** `DESIGN.md` ne les chiffre pas ; ils sont fixés ici : mobile = largeur inférieure à 768px ; tablette = de 768px à 1023px ; bureau = 1024px et plus. La conception part du mobile.

**R10 — Exposition des tokens.** Chaque token de R4, R6 (taille) et R7, ainsi que les trois familles de R3, est lisible dans le navigateur comme propriété CSS personnalisée de l'élément racine, sous les noms `--color-<token>`, `--text-<token>`, `--shadow-<token>` et `--font-display`, `--font-body`, `--font-mono`, y compris les tokens qu'aucune page n'utilise encore. Chacun est aussi utilisable comme utilitaire Tailwind. Le mécanisme est au choix du développeur (attention : Tailwind 4 peut ne pas émettre les variables de thème inutilisées, lire sa documentation).

**R11 — Pas de valeur en dur.** En dehors de l'unique endroit où les tokens sont définis, aucun fichier de `src/` ne contient de couleur écrite en dur (hexadécimal, `rgb()`, `hsl()`, couleur nommée de la palette Tailwind par défaut comme `zinc-50`).

**R12 — Thème clair uniquement.** Le rendu est identique que le système de l'utilisateur soit en mode clair ou sombre. Toute règle `prefers-color-scheme` et toute variante `dark:` héritées de `create-next-app` disparaissent.

**R13 — Styles globaux.** `body` : fond `background`, texte `text-primary`, police body, taille `body` (15px), interligne 1.6. Le layout racine ne contient ni en-tête ni pied de page : ceux de cette spécification appartiennent à la page d'accueil et ne doivent pas s'imposer aux futures pages de l'application.

**R14 — Nettoyage.** Plus aucune trace de `create-next-app` : textes « Create Next App », « To get started », liens vers vercel.com et nextjs.org, logos Next et Vercel, polices Geist. Les fichiers `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/globe.svg` et `public/window.svg` sont supprimés.

### Contenu de la page d'accueil

**R15 — Textes exacts.** Les textes de la section « Contenus » ci-dessous sont repris mot pour mot, accents compris, avec l'apostrophe droite (`'`) telle qu'écrite ici. Ils ont été rédigés sans deux-points, point-virgule, point d'interrogation ni point d'exclamation pour éviter toute question d'espace insécable. Le nom du produit s'écrit « Quittances », avec une majuscule.

**R16 — Rien hors périmètre produit.** La page ne mentionne ni WhatsApp, ni SMS, ni paiement en ligne, ni prélèvement, ni connexion ou synchronisation bancaire.

**R17 — Aucune promesse non décidée.** La page ne mentionne ni prix ni gratuité, ni conformité ou valeur juridique des documents, ni nombre d'utilisateurs, ni date d'ouverture. Elle ne dit pas qu'un compte peut être créé.

**R18 — Appel à l'action.** La page comporte un seul bouton primaire : le lien « Voir comment ça marche », dans le bloc d'accroche, qui mène à la section « Comment ça marche » de la même page (ancre `#fonctionnement`). Justification : les pages d'inscription et de connexion n'existent pas ; un bouton « Créer mon compte » mènerait à une erreur 404 ou à une promesse non tenue. L'ancre garde un appel à l'action réel, sans lien mort et sans nouvelle route. La section finale dit honnêtement que les inscriptions ne sont pas ouvertes et ne contient aucun bouton. Quand l'inscription sera spécifiée, cet appel à l'action deviendra « Créer mon compte » (voir Q2).

**R19 — Liens.** Tous les liens de la page sont internes : `/`, `#contenu`, `#fonctionnement`, `#fonctionnalites`. Aucun lien externe, aucun `mailto:`, aucun élément `button`, `form` ou champ de saisie.

**R20 — Fonctionnement sans JavaScript.** La page n'a besoin d'aucun JavaScript côté navigateur : avec JavaScript désactivé, tout le contenu est lisible et les ancres fonctionnent.

**R21 — Rendu statique.** La page ne lit aucune donnée dépendante de la requête ni de l'horloge (pas d'année courante dans le pied de page) et est pré-rendue au build.

### Présentation et accessibilité

**R22 — Structure sémantique.** Un seul `h1`. Chaque section a un `h2`. Les étapes et les cartes ont un `h3`. Aucun niveau de titre n'est sauté. La page a les repères `banner` (en-tête), `navigation` nommé « Navigation principale », `main` (identifiant `contenu`) et `contentinfo` (pied de page). Les trois étapes forment une liste ordonnée, les quatre cartes une liste non ordonnée.

**R23 — Lien d'évitement.** Le premier élément focalisable de la page est un lien « Aller au contenu » qui mène à `#contenu`. Il est invisible tant qu'il n'a pas le focus et visible quand il l'a.

**R24 — En-tête.** Barre fixe en haut de la fenêtre, haute de 56px, fond `surface` translucide avec flou d'arrière-plan, filet bas de 1px `border`, pas d'ombre. À gauche, le logo texte « Quittances » (police display 700, couleur `text-primary`), lien vers `/` dont le nom accessible est « Quittances, accueil ». À droite, à partir de 768px seulement, la navigation avec deux liens : « Fonctionnement » (`#fonctionnement`) et « Fonctionnalités » (`#fonctionnalites`), en 14px graisse 500, couleur `text-primary`, fond léger au survol. En dessous de 768px, la navigation n'est pas rendue visible ni atteignable au clavier, et il n'y a pas de menu hamburger : la page est courte et l'appel à l'action joue ce rôle.

**R25 — Ancres et en-tête fixe.** Après activation d'une ancre, le titre de la section visée est visible dans la fenêtre, sous l'en-tête et non recouvert par lui. Le contenu du haut de page n'est jamais masqué par l'en-tête. Aucun défilement animé n'est demandé.

**R26 — Bouton primaire.** Fond `primary`, texte blanc, rayon 6px, graisse 500, taille « large » (hauteur 44px, marge intérieure horizontale 24px). Au survol : fond `primary-hover`, ombre `primary-glow`, décalage de 1px vers le haut.

**R27 — Cartes.** Fond `surface`, bordure 1px `border`, rayon 12px, marge intérieure 24px, sans ombre. Les quatre cartes de la page ne sont pas cliquables : elles n'ont ni ombre ni soulèvement au survol.

**R28 — Couleur primaire réservée à l'interactif.** Sur la page, `primary` n'apparaît que sur le bouton primaire et sur les indicateurs de focus. Les numéros d'étape, titres et textes sont en `text-primary` ou `text-secondary`.

**R29 — Focus visible.** Tout lien qui reçoit le focus au clavier affiche un contour plein de 2px en `primary`, décalé de 2px, accompagné de l'ombre `focus`. Le contour plein est ajouté par cette spécification parce que l'anneau à 12 % d'opacité de `DESIGN.md` ne se voit pas seul sur un lien sans bordure.

**R30 — Mouvement réduit.** Si l'utilisateur a demandé la réduction des animations (`prefers-reduced-motion`), le décalage du bouton au survol et toute transition sont supprimés.

**R31 — Mise en page selon la largeur.**

| Élément | Moins de 768px | 768 à 1023px | 1024px et plus |
| --- | --- | --- | --- |
| Titre `h1` | 40px | 56px | 72px (`display`) |
| Titres `h2` | 24px (`subtitle`) | 32px (`title`) | 32px (`title`) |
| Étapes | 1 colonne | 3 colonnes | 3 colonnes |
| Cartes | 1 colonne | 2 colonnes | 2 colonnes |
| Navigation de l'en-tête | absente | présente | présente |
| Espacement entre sections | 32px | 48px | 64px |

Gouttière des grilles : 24px. Les titres `h3` sont en 15px display 700. Le texte du bloc d'accroche est aligné à gauche et sa largeur de ligne ne dépasse pas 640px. Aucun défilement horizontal, de 320px à 1920px de large.

## Contenus

À reprendre tels quels (R15). L'ordre ci-dessous est l'ordre dans la page.

### En-tête

- Lien d'évitement : `Aller au contenu`
- Logo : `Quittances` (nom accessible du lien : `Quittances, accueil`)
- Navigation (nom accessible : `Navigation principale`) : `Fonctionnement`, `Fonctionnalités`

### Bloc d'accroche

- Surtitre (token `overline`, couleur `text-secondary`) : `Pour les propriétaires bailleurs`
- Titre `h1` : `Vos quittances de loyer, envoyées sans y penser.`
- Accroche (token `body`, 15px, couleur `text-secondary`) : `Le jour de l'échéance, Quittances vous demande par e-mail si le loyer est arrivé. Vous confirmez, la quittance PDF part chez votre locataire. Sinon, il reçoit une relance.`
- Bouton primaire (lien vers `#fonctionnement`) : `Voir comment ça marche`

### Section « Comment ça marche » (identifiant `fonctionnement`)

- Titre `h2` : `Comment ça marche`
- Introduction (couleur `text-secondary`) : `Trois étapes, une fois par mois et par location.`
- Liste ordonnée de trois étapes. Chaque étape affiche son numéro (`1`, `2`, `3`, décoratif, masqué aux lecteurs d'écran puisque la liste ordonnée porte déjà le rang), un titre `h3` et un texte en `text-secondary`.

| N° | Titre `h3` | Texte |
| --- | --- | --- |
| 1 | `Vous recevez un e-mail le jour J` | `Vous choisissez le jour d'échéance de chaque location. Ce jour-là, Quittances vous demande si le loyer a bien été reçu.` |
| 2 | `Vous confirmez, ou non, le loyer` | `Rien ne part sans votre réponse. C'est vous qui pointez chaque paiement.` |
| 3 | `Votre locataire reçoit le bon e-mail` | `Si le loyer est confirmé, la quittance en PDF lui est envoyée. Sinon, il reçoit une relance. Il n'a aucun compte à créer.` |

### Section « Ce que fait Quittances » (identifiant `fonctionnalites`)

- Titre `h2` : `Ce que fait Quittances`
- Liste non ordonnée de quatre cartes (R27), chacune avec un titre `h3` et un texte en `text-secondary`.

| Titre `h3` | Texte |
| --- | --- |
| `Plusieurs locations, un seul compte` | `Suivez tous vos biens au même endroit, chacun avec son locataire, son loyer et son jour d'échéance.` |
| `Quittances en PDF` | `Une quittance prête à imprimer, envoyée par e-mail à votre locataire dès que vous confirmez le loyer.` |
| `Relances des loyers non reçus` | `Si vous indiquez que le loyer n'est pas arrivé, votre locataire reçoit un e-mail de relance.` |
| `Tableau de bord et exports` | `Voyez d'un coup d'œil les loyers reçus et les impayés, et exportez-les.` |

### Section « Les inscriptions ouvrent bientôt » (identifiant `inscriptions`)

- Titre `h2` : `Les inscriptions ouvrent bientôt`
- Texte (couleur `text-secondary`) : `Quittances est en cours de développement. La création de compte n'est pas encore disponible.`
- Aucun bouton, aucun lien, aucun champ.

### Pied de page

- Filet haut de 1px `border`, texte en `small` (13px), couleur `text-secondary` : `Quittances, l'envoi des quittances de loyer et des relances pour les propriétaires bailleurs.`
- Aucun lien, aucune année.

## Parcours utilisateur

Un seul écran, `/`, accessible sans compte.

1. **Arrivée.** Le visiteur voit l'en-tête, puis le bloc d'accroche : surtitre, titre, accroche, bouton « Voir comment ça marche ». Sur mobile, le bouton est visible sans que l'en-tête ne recouvre le titre.
2. **Clic sur « Voir comment ça marche »** (ou sur « Fonctionnement » dans l'en-tête, à partir de 768px). La fenêtre se place sur la section « Comment ça marche », titre visible sous l'en-tête. L'adresse se termine par `#fonctionnement`. Le bouton Précédent du navigateur ramène en haut de page.
3. **Lecture.** En défilant, il lit les trois étapes, puis les quatre cartes, puis la section « Les inscriptions ouvrent bientôt », puis le pied de page. L'en-tête reste fixé en haut.
4. **Clic sur le logo.** Retour à `/`, en haut de page.
5. **Au clavier.** Tabulation depuis le haut : « Aller au contenu » apparaît, puis le logo, puis (à partir de 768px) « Fonctionnement » et « Fonctionnalités », puis « Voir comment ça marche ». Chaque arrêt a un focus visible. Il n'y a pas d'autre élément focalisable.

États :

- **Vide** : sans objet, le contenu est fixe.
- **Chargement** : sans objet, la page est pré-rendue ; aucun indicateur de chargement, aucun décalage de mise en page à l'arrivée des polices.
- **Erreur** : sans objet, la page ne lit aucune donnée. Une adresse inconnue affiche la page 404 par défaut de Next (hors périmètre).
- **JavaScript désactivé** : même contenu, mêmes ancres (R20).

## Critères d'acceptation

Niveau de vérification indicatif : [V] Vitest et React Testing Library sur le composant de page ; [N] navigateur (Playwright, projets `bureau` et `mobile`) ; [C] ligne de commande ou lecture du dépôt. Les critères de socle qui touchent au layout racine et aux polices ne sont pas rendus par Vitest : ils relèvent de la QA.

### Socle

- **CA1** [N] Étant donné la page `/`, quand elle est chargée, alors l'élément `html` porte l'attribut `lang="fr"`.
- **CA2** [N] Étant donné la page `/`, quand elle est chargée, alors le titre du document est exactement `Quittances — quittances de loyer et relances par e-mail` et la balise meta `description` vaut exactement le texte de R2.
- **CA3** [N] Étant donné la page `/`, quand elle est chargée, alors la police calculée de `body` commence par DM Sans, celle du `h1` par Plus Jakarta Sans, et la propriété `--font-mono` de l'élément racine désigne JetBrains Mono.
- **CA4** [N] Étant donné la page `/`, quand elle est chargée en observant le réseau, alors aucune requête ne part vers `fonts.googleapis.com` ni `fonts.gstatic.com`.
- **CA5** [N] Étant donné la page `/`, quand on lit les propriétés CSS personnalisées de l'élément racine, alors les onze `--color-*` de R4, les huit `--text-*` de R6 et les trois `--shadow-*` de R7 existent avec les valeurs indiquées (à l'écriture près : casse, espaces, `px` ou `rem` équivalent sur une base de 16px).
- **CA6** [N] Étant donné la page `/`, quand elle est chargée, alors le fond calculé de `body` est `rgb(250, 250, 250)`, sa couleur de texte `rgb(10, 10, 10)` et sa taille de police 15px.
- **CA7** [N] Étant donné un navigateur réglé sur le thème sombre (`prefers-color-scheme: dark`), quand la page `/` est chargée, alors le fond et la couleur de texte de `body` sont les mêmes qu'en CA6.
- **CA8** [C] Étant donné le dépôt, quand on cherche dans `src/` les couleurs en dur (hexadécimal, `rgb(`, `hsl(`, classes de palette Tailwind par défaut, variante `dark:`), alors on n'en trouve que dans l'unique fichier où les tokens sont définis, et aucune variante `dark:` ni règle `prefers-color-scheme` nulle part.
- **CA9** [C] Étant donné le dépôt, quand on cherche « Create Next App », « Geist », « vercel » et « nextjs.org » dans `src/`, alors il n'y a aucun résultat, et les cinq fichiers SVG cités en R14 n'existent plus dans `public/`.
- **CA10** [C] Étant donné le dépôt, quand on lance `pnpm lint` puis `pnpm build`, alors les deux réussissent sans erreur et la sortie du build liste la route `/` avec le symbole `○` (Static), et non `◐` ni `ƒ`.

### Contenu

- **CA11** [V] Étant donné la page d'accueil, quand elle est rendue, alors elle contient exactement un titre de niveau 1, dont le texte est `Vos quittances de loyer, envoyées sans y penser.`
- **CA12** [V] Étant donné la page d'accueil, quand elle est rendue, alors elle contient exactement trois titres de niveau 2, dans cet ordre : `Comment ça marche`, `Ce que fait Quittances`, `Les inscriptions ouvrent bientôt`.
- **CA13** [V] Étant donné la page d'accueil, quand elle est rendue, alors le surtitre `Pour les propriétaires bailleurs` et l'accroche du bloc d'accroche sont présents avec le texte exact de la section « Contenus ».
- **CA14** [V] Étant donné la section « Comment ça marche », quand elle est rendue, alors elle contient le texte d'introduction et une liste ordonnée de trois éléments dont les titres de niveau 3 et les textes sont, dans l'ordre, ceux du tableau des étapes.
- **CA15** [V] Étant donné la section « Ce que fait Quittances », quand elle est rendue, alors elle contient une liste de quatre éléments dont les titres de niveau 3 et les textes sont, dans l'ordre, ceux du tableau des cartes.
- **CA16** [V] Étant donné la section « Les inscriptions ouvrent bientôt », quand elle est rendue, alors elle contient le texte exact prévu et ne contient aucun lien, bouton ni champ.
- **CA17** [V] Étant donné la page d'accueil, quand elle est rendue, alors le pied de page (repère `contentinfo`) contient le texte exact prévu et aucun lien.
- **CA18** [V] Étant donné la page d'accueil, quand elle est rendue, alors il existe un lien nommé `Voir comment ça marche` dont la cible est `#fonctionnement`, et l'élément d'identifiant `fonctionnement` existe et contient le titre `Comment ça marche`.
- **CA19** [V] Étant donné la page d'accueil, quand on lit tout son texte sans tenir compte de la casse, alors on n'y trouve aucun de ces termes : `whatsapp`, `sms`, `paiement en ligne`, `prélèvement`, `banque`, `bancaire`, `gratuit`, `tarif`, `prix`, `conforme`, `légal`, `créer mon compte`, `s'inscrire`, `se connecter`.
- **CA20** [V] Étant donné la page d'accueil, quand elle est rendue, alors elle ne contient aucun élément `button`, `form`, `input`, `textarea`, `select` ni `img`, et la cible de chacun de ses liens est l'une de : `/`, `#contenu`, `#fonctionnement`, `#fonctionnalites`.
- **CA21** [V] Étant donné la page d'accueil, quand elle est rendue, alors elle présente les repères `banner`, `main` et `contentinfo`, une navigation nommée `Navigation principale` contenant les liens `Fonctionnement` (`#fonctionnement`) et `Fonctionnalités` (`#fonctionnalites`), et un lien nommé `Quittances, accueil` vers `/`. (La navigation est présente dans le document à toutes les largeurs ; son masquage sous 768px relève de CA26, dans le navigateur.)
- **CA22** [V] Étant donné la page d'accueil, quand on parcourt ses titres dans l'ordre du document, alors aucun niveau n'est sauté (pas de `h3` sans `h2` avant lui, pas de `h4`).

### Comportement dans le navigateur

- **CA23** [N] Étant donné la page `/` en haut de page, quand on active « Voir comment ça marche », alors l'adresse se termine par `#fonctionnement` et le titre `Comment ça marche` est entièrement visible dans la fenêtre, son bord supérieur situé sous le bord inférieur de l'en-tête. Vérifié sur `bureau` et `mobile`.
- **CA24** [N] Étant donné la page `/` sur `bureau`, quand on active « Fonctionnalités » dans l'en-tête, alors l'adresse se termine par `#fonctionnalites` et le titre `Ce que fait Quittances` est visible sous l'en-tête.
- **CA25** [N] Étant donné la page `/`, quand on défile jusqu'au pied de page, alors l'en-tête reste visible en haut de la fenêtre, avec une hauteur de 56px.
- **CA26** [N] Étant donné une fenêtre de 767px de large ou moins, quand la page `/` est chargée, alors les liens « Fonctionnement » et « Fonctionnalités » de l'en-tête ne sont ni visibles ni atteignables à la tabulation ; étant donné une fenêtre de 768px ou plus, alors ils sont visibles et atteignables.
- **CA27** [N] Étant donné la page `/` fraîchement chargée, quand on appuie une fois sur Tab, alors le lien « Aller au contenu » a le focus et est visible ; quand on l'active, alors l'adresse se termine par `#contenu`. Avant de recevoir le focus, ce lien n'est pas visible.
- **CA28** [N] Étant donné la page `/` sur `bureau`, quand on tabule depuis le haut, alors l'ordre du focus est : « Aller au contenu », logo, « Fonctionnement », « Fonctionnalités », « Voir comment ça marche », puis plus aucun élément de la page. Sur `mobile`, même ordre sans les deux liens de navigation. À chaque arrêt, l'élément a un contour calculé plein d'au moins 2px.
- **CA29** [N] Étant donné la page `/`, quand on lance une analyse axe avec les règles WCAG 2.1 A et AA, alors elle ne remonte aucune violation, sur `bureau` comme sur `mobile`.
- **CA30** [N] Étant donné des fenêtres de 320, 412, 768, 1024 et 1280px de large, quand la page `/` est chargée, alors la largeur de défilement du document ne dépasse pas la largeur de la fenêtre (pas de défilement horizontal).
- **CA31** [N] Étant donné des fenêtres de 412, 768 et 1280px de large, quand la page `/` est chargée, alors la taille calculée du `h1` est respectivement 40, 56 et 72px ; les trois étapes sont sur 1, 3 et 3 colonnes ; les quatre cartes sur 1, 2 et 2 colonnes.
- **CA32** [N] Étant donné la page `/`, quand on inspecte le lien « Voir comment ça marche », alors son fond calculé est `rgb(79, 70, 229)`, son texte blanc, son rayon 6px, sa hauteur 44px et sa graisse 500 ; et aucun autre élément de la page n'a ce fond.
- **CA33** [N] Étant donné la page `/`, quand on inspecte une carte de la section « Ce que fait Quittances », alors son fond est `rgb(255, 255, 255)`, sa bordure de 1px `rgb(232, 232, 236)`, son rayon 12px, et elle n'a aucune ombre, y compris quand le pointeur la survole.
- **CA34** [N] Étant donné un navigateur dont JavaScript est désactivé, quand la page `/` est chargée, alors le `h1`, les trois `h2` et le pied de page sont visibles, et l'activation de « Voir comment ça marche » amène la section visée dans la fenêtre.
- **CA35** [N] Étant donné la page `/`, quand elle est chargée puis parcourue (défilement, clic sur chaque lien), alors la console du navigateur n'affiche aucune erreur ni aucun avertissement, d'hydratation notamment.
- **CA36** [N] Étant donné un navigateur réglé sur la réduction des animations, quand le pointeur survole « Voir comment ça marche », alors le bouton ne se déplace pas et sa durée de transition calculée est nulle.

## Découpage

Trois tâches, à réaliser et recetter dans cet ordre, une à la fois.

### T1 — Socle du design system

Polices, tokens, styles globaux, layout racine (langue, métadonnées), suppression du thème sombre et des restes de `create-next-app` (R1 à R14). Pour que le socle soit observable seul, la page `/` est réduite à un contenu provisoire : un `h1` « Quittances » et un paragraphe « Page d'accueil en cours de construction. », sans autre élément. Ce contenu provisoire est remplacé en T2 et ne fait l'objet d'aucun test durable.

Critères couverts : CA1 à CA10.

### T2 — Contenu principal de la page d'accueil

Dans `main` (identifiant `contenu`) : bloc d'accroche avec son appel à l'action, sections « Comment ça marche », « Ce que fait Quittances », « Les inscriptions ouvrent bientôt », puis pied de page ; mise en page selon la largeur (R15 à R22 hors en-tête, R26 à R28, R30, R31). Pas encore d'en-tête ni de lien d'évitement.

Critères couverts : CA11 à CA20, CA22, CA30 à CA36, et CA23 pour l'adresse et la visibilité du titre (la condition « sous l'en-tête » se vérifie en T3). CA10 est à revérifier.

### T3 — En-tête, lien d'évitement et recette complète

En-tête fixe avec logo et navigation, lien d'évitement, décalage des ancres sous l'en-tête, focus visible sur tous les liens (R23 à R25, R29). C'est à la fin de cette tâche que la QA déroule la recette complète de la page et écrit les tests e2e durables.

Critères couverts : CA21, CA23 (complet) à CA29. À revérifier sur la page finie : CA10, CA20, CA22, CA30, CA34, CA35.

## Questions ouvertes

**Q1 — Couleur primaire et contraste (à trancher avant T1).** Blanc sur `#6366F1` donne environ 4.47:1, sous le seuil de 4.5:1 exigé par `DESIGN.md` lui-même et contrôlé par axe. Hypothèse recommandée et appliquée dans cette spécification : `primary` = `#4F46E5`, `primary-hover` = `#4338CA`, et mise à jour de `DESIGN.md` en conséquence par l'utilisateur ou l'orchestrateur (le chef de projet n'écrit que dans `docs/specs/`). Autre option : garder `#6366F1` et accepter une exception documentée à la règle axe de contraste, ce qui affaiblit CA29.

**Q2 — Cible de l'appel à l'action.** Hypothèse recommandée et appliquée : ancre vers « Comment ça marche », et section finale annonçant que les inscriptions ne sont pas ouvertes (R18). Autres options si l'utilisateur veut un appel à l'action plus engageant : une page statique `/inscription` « bientôt disponible » derrière un bouton « Créer mon compte » (l'adresse resterait valable ensuite, mais le libellé promet ce qui n'existe pas), ou un lien `mailto:` vers une adresse de contact (aucune adresse n'est définie à ce jour).

**Q3 — Mentions légales.** Un site français ouvert au public doit identifier son éditeur et son hébergeur. Le projet est didactique et non publié : hypothèse recommandée, ne rien ajouter maintenant et prévoir une spécification dédiée avant toute mise en ligne publique.

**Q4 — Règle des deux graisses.** `DESIGN.md` demande des titres en gras, du texte en regular et des boutons en medium, tout en limitant un écran à deux graisses. Hypothèse recommandée et appliquée (R3) : la limite s'entend par famille de police. À confirmer, et à préciser dans `DESIGN.md`.

**Q5 — Contraste des couleurs sémantiques (pour les spécifications suivantes).** `success` `#10B981`, `warning` `#F59E0B` et `error` `#EF4444` sont trop clairs pour du texte lisible sur fond clair ou teinté, alors que `DESIGN.md` prévoit des chips « texte de la couleur sémantique ». Sans effet ici (aucun chip sur la page d'accueil) ; hypothèse recommandée : poser les tokens tels quels maintenant et définir des variantes de texte plus sombres dans la spécification qui introduira les statuts de loyer.

**Q6 — Textes de la page.** Les titres et accroches sont une proposition du chef de projet. Hypothèse recommandée : les valider tels quels pour cette première itération ; toute retouche doit être faite dans cette spécification avant T2, car les tests s'appuient sur le texte exact.
