# Avancement

Journal de reprise : à lire au début de chaque session, à mettre à jour à la fin de chaque étape.

## Où on en est

Dernière mise à jour : 2026-10-10

### Fait

1. Cadrage du produit (résumé dans `CLAUDE.md`).
2. Projet créé avec `create-next-app` (Next 16.4, React 19.3, pnpm). Build vérifié. Fiche 01.
3. Agent `chef-de-projet` créé (modèle opus), pas encore testé. `CLAUDE.md` rédigé. Fiche 02.
4. `DESIGN.md` adapté au produit (base « Genesis »).
5. Agent `developpeur-front` créé (modèle sonnet), pas encore testé.
6. Vitest + React Testing Library installés et vérifiés (`pnpm test`). Agent `createur-de-tests` créé (modèle sonnet), pas encore testé. Fiche 03.
7. Playwright (Chromium, projets bureau et mobile) et axe installés et vérifiés (`pnpm test:e2e`). Agent `qa` créé (modèle sonnet), pas encore testé. Fiche 04.

8. Premier commit des agents, des tests et du design system (`fa56735`).
9. Première fonctionnalité : spécification `docs/specs/01-accueil-et-design-system.md` rédigée par `chef-de-projet` et validée (3 tâches, 36 critères). `DESIGN.md` aligné : primaire `#4F46E5` (contraste), deux graisses par famille de police.
10. T1 (socle du design system) développée par `developpeur-front` : polices `next/font`, tokens dans `@theme static`, layout racine `fr`, page `/` provisoire. Lint et build verts, `○ /`. Fiche 05.
11. T1 recettée par `qa` : CA1 à CA10 conformes, aucun bug. Tests e2e durables du socle dans `e2e/socle-design-system.spec.ts` (7 tests, verts sur `bureau` et `mobile`, vérifiés en cassant deux tokens). Commitée (`e1518f8`) sur la branche `accueil-et-design-system`.
12. T2 (contenu principal de la page d'accueil) développée par `developpeur-front` dans `src/app/page.tsx` ; deux tokens ajoutés hors échelle R6 (`--text-display-sm` 40px, `--text-display-md` 56px). Lint et build verts, `○ /`. Fiche 06.
13. T2 testée par `createur-de-tests` (premier appel) : `src/app/page.test.tsx`, 18 tests Vitest verts pour CA11 à CA20 et CA22, éprouvés par cinq mutations ; aucun écart avec la spécification. Spécification mise à jour (R6, R31, CA5 : dix tailles).
14. T2 recettée par `qa` : CA10, CA23 (partiel) et CA30 à CA36 conformes, 0 violation axe, aucun bug. Nouveau `e2e/accueil-contenu.spec.ts` ; suite e2e à 44 tests verts (22 par projet), éprouvée par mutation.
15. Correctif après recette : le `h1` n'est plus limité à 640px (960px au maximum, lignes équilibrées, deux lignes à partir de 768px) ; R31 précisée. T2 commitée (`9df1c0b`) sur `accueil-et-design-system`.
16. T3 développée par `developpeur-front` : en-tête fixe de 56px, lien d'évitement, `scroll-padding-top` pour les ancres, règle globale `a:focus-visible`. Logo en `next/link` (imposé par ESLint). Lint, build (`○ /`), 18 tests Vitest et 44 e2e verts. Fiche 07.
17. T3 testée par `createur-de-tests` : 9 tests ajoutés (CA21, R22, R23, ordre des liens), 27 tests Vitest verts.
18. Recette complète par `qa` : CA21 et CA23 à CA29 conformes, 0 violation axe ; un bug trouvé (B1 : le logo ne ramenait pas en haut de page depuis `/`, à cause de `next/link`). Premier correctif (`<a href="/">` natif) refusé par l'utilisateur, qui ne veut pas de rechargement complet ; correctif retenu : `Link` isolé dans un Client Component minimal, `src/app/logo-link.tsx`, avec `onNavigate` qui remet le défilement à 0. Spécification mise à jour (R20, R24, parcours étape 4). Nouveau `e2e/accueil-entete.spec.ts` ; `eslint.config.mjs` ignore maintenant `playwright-report/` et `test-results/`.
19. Test e2e du logo renforcé par `qa` (pas de rechargement du document, clavier, Ctrl ou Cmd + clic), éprouvé en remettant un `<a>` natif. État final : lint propre, `○ /`, 27 tests Vitest, 75 tests e2e réussis et 1 ignoré (navigation de l'en-tête, absente sur mobile). **Fonctionnalité 01 terminée**, commitée et fusionnée dans `main`.

20. Deuxième fonctionnalité, **inscription et connexion du propriétaire** : choix techniques expliqués et décidés (Postgres chez Neon avec Drizzle, fiche 08 ; Better Auth avec e-mail et mot de passe, fiche 09). Projet Neon « quittances » en région Europe, branche `test` pour les tests. Spécification `docs/specs/02-inscription-et-connexion.md` validée (5 tâches, T1 à T4 en `opus`).
21. T1, socle technique (`f2103f9`) : Drizzle et pilote `pg`, migration des comptes et sessions, Better Auth, `getCurrentOwner`, `createAccount`, garde-fou de la base de test, `pnpm test:integration`. Aucune route `/api/auth` : tout passe par des Server Actions.
22. T2, page `/inscription` et composants de formulaire (`70f9eb2`). Fiche 10.
23. T3, `/tableau-de-bord` en rendu bloquant, `src/proxy.ts` (renouvellement du cookie, redirection précoce), déconnexion avec rechargement complet, écran de panne (`4357088`). Fiche 11.
24. T4, page `/connexion`, retour vers la page demandée par l'en-tête `Referer`, propriétaire déjà connecté redirigé, ancienne session fermée à la reconnexion (`8a73ea7`). **Une redirection ouverte trouvée par la recette et corrigée** (`retour=/.//hôte`) : forme canonique exigée et destination reconstruite par le serveur. Fiche 12.
25. T5, page d'accueil : « Créer mon compte » et « Se connecter » en `Link`, section « Les inscriptions ouvrent bientôt » supprimée, tests de la fonctionnalité 01 adaptés.
26. **Fonctionnalité 02 terminée**, commitée et fusionnée dans `main`. État final : lint propre ; build `○ /`, `○ /connexion`, `○ /inscription`, `ƒ /tableau-de-bord` ; 1180 tests Vitest ; 23 tests d'intégration ; 215 tests e2e réussis et 1 ignoré (navigation de l'en-tête sur mobile, absente sous 768px).

27. Troisième fonctionnalité, **gestion des locations** : spécification `docs/specs/03-gestion-des-locations.md` validée (6 tâches, option légère sans clé de soumission ni version). Prompts des agents ajustés (`02eade7`) et **rythme allégé** adopté : recette `qa` à la première tranche de bout en bout et à la fin, e2e complets une fois avant chaque commit, mutations réservées à l'isolation et aux montants, `opus` pour les seules tâches sensibles.
28. T1 (`1f018b1`) : table `rental`, migration `drizzle/0001_locations.sql`, fonctions d'accès de `src/rentals/rental-store.ts`, toutes filtrées sur le propriétaire dans la requête SQL ; tests d'intégration d'isolation à deux comptes.
29. T2 (`559292c`) : règles pures de `src/rentals/` (montants en centimes sans calcul flottant, dates `AAAA-MM-JJ`, statut à la date du jour à Paris, validation d'ensemble) ; 860 tests Vitest, indépendants du fuseau.
30. T3, T4, T5 (`ce29815`) : le tableau de bord devient la liste des locations ; formulaire de location ; `/locations/nouvelle`, `/locations/[id]`, écran « Location introuvable ».
31. **Décision d'architecture : `cacheComponents` retiré** (`2ef34f1`), pour avoir les bons codes HTTP. Routes protégées rendues à chaque requête (`ƒ`), vrais 404 et 307, erreurs de formulaire réaffichées sans JavaScript. Fiche 14.
32. T6 (`afc3ea4`) : modifier, mettre fin, rouvrir, supprimer ; page 404 générale en français. À retenir : un argument passé par `bind` à une Server Action n'est ni chiffré ni signé ; la protection est le filtre sur le propriétaire. Fiche 13.
33. Recette complète (`3f0efcd`) : isolation tenue sur les quatre actions avec l'identifiant remplacé partout. **Un bug trouvé et corrigé** (`d76fe76`) : une écriture qui dépassait le délai du pilote s'exécutait plus tard dans Postgres. `runWriteTransaction` (`src/db/index.ts`) pose `lock_timeout` et `statement_timeout` pour la transaction et ne rend la connexion au pool qu'après un `COMMIT` réussi. Fiche 08 complétée.
34. **Fonctionnalité 03 terminée**, fusionnée dans `main`. État final : lint sans erreur ni avertissement ; build `○` pour `/`, `/connexion`, `/inscription`, `ƒ` pour `/tableau-de-bord` et tout `/locations` ; 2240 tests Vitest ; 68 tests d'intégration ; 325 tests e2e réussis et 1 ignoré.

### Prochaine étape

Quatrième fonctionnalité, acceptée par l'utilisateur (branche `quittance-pdf`) : **quittance de loyer en PDF** (produire le document à partir d'une location et d'un mois). Elle demande deux choses avant la spécification, à expliquer puis décider une à la fois :

1. Le choix technique de la **génération de PDF** : **décidé le 2026-10-12**, composants React pour PDF (`@react-pdf/renderer`), produits sur le serveur et servis par un Route Handler. Compatibilité avec React 19 et Next 16 à vérifier en premier par le développeur ; repli sur un dessin bas niveau (`pdf-lib`) sinon.
2. Les **informations du bailleur** (nom, adresse), que l'inscription ne demande pas, et ce qu'une quittance doit mentionner (à faire vérifier : le chef de projet a signalé ne pas pouvoir affirmer le droit locatif).

Orientations validées par l'utilisateur : page « Mes informations » pour le bailleur ; production manuelle d'une quittance pour une location et un mois, le propriétaire attestant le paiement intégral ; quittance enregistrée avec ses montants figés ; pas de quittance pour un paiement partiel ; l'accord du locataire pour l'envoi électronique est reporté à la fonctionnalité des e-mails. Droit vérifié sur des fiches pratiques seulement (article 21 de la loi du 6 juillet 1989), à faire vérifier sur le texte officiel.

Décisions de l'utilisateur du 2026-10-12, à faire entrer dans la spécification 04 : (1) **une quittance se supprime réellement**, pour être refaite ; (2) **« supprimer » une location l'archive, avec toutes ses quittances** ; depuis les archives, elle peut ensuite être supprimée définitivement (cela redéfinit la suppression réelle de la spécification 03, R23) ; (3) l'utilisateur fournira **deux quittances réelles** qu'il a reçues comme locataire, l'une d'un particulier, l'autre d'une agence : le texte du document sera révisé d'après elles. Ne pas copier ces fichiers dans le dépôt (données personnelles) ; n'en reprendre que la structure et les formulations.

Les deux exemples ont été lus (non copiés dans le dépôt). Ajustements du document validés par l'utilisateur : le **mois dans le titre** ; **« Provisions pour charges »** dans le détail ; une **mention de réserve courte**, calquée sur celle de l'agence (formule juridique, à faire relire) ; la **référence aléatoire** est conservée, pas de numérotation suivie. Non repris : « Paiement locataire » et « Solde à payer ». **Les mentions propres à un professionnel (carte professionnelle, garantie, mandat) sont reportées à une éventuelle V2 ouverte aux professionnels.** Idée pour la fonctionnalité des échéances : l'agence envoie la quittance du mois écoulé avec l'avis d'échéance du mois suivant, dans le même courrier.

Archivage, précisé par l'utilisateur : une location archivée quitte le tableau de bord pour une page « Archives » ; elle peut être restaurée avec ses quittances ; ses quittances restent téléchargeables depuis les archives ; la suppression définitive efface la location et ses quittances après une confirmation qui en annonce le nombre.

**Spécification 04 validée par l'utilisateur le 2026-10-12** (42 règles, 54 critères avant la dernière retouche, 5 tâches). Décisions : texte du document en douze blocs, avec le mois sous le titre, « Provisions pour charges » et la mention de réserve « La présente quittance ne libère le locataire que pour la période indiquée. Elle ne vaut pas quittance des loyers et des charges des périodes antérieures. » (« sous réserve d'encaissement » écartée ; relecture juridique à faire avant ouverture au public) ; **seule une location terminée peut être archivée** ; une location archivée est en consultation seule, restaurable, et compte dans la limite de 100 ; **une location sans aucune quittance peut être supprimée directement**, quel que soit son statut ; une location qui a des quittances suit le parcours terminée, archivée, puis supprimée définitivement depuis les archives.

| Tâche | Contenu | Modèle | Recette `qa` |
| --- | --- | --- | --- |
| T1 | Document PDF : vérifier d'abord la bibliothèque et les polices | sonnet | non |
| T2 | Règles pures : mois, période, validation, référence, nom de fichier, « archivable » | sonnet | non |
| T3 | Données : quittances, informations du bailleur, archivage | opus | non |
| T4 | Mes informations, production, téléchargement, suppression d'une quittance | opus | oui, première recette |
| T5 | Archivage, restauration, suppression définitive ; adaptation des tests de la fonctionnalité 03 | opus | oui, recette finale |

**T1 et T2 développées** par `developpeur-front` en `sonnet` (coupé une fois par la limite d'utilisation, puis repris), pas encore commitées : `@react-pdf/renderer` 4.9 convient (React 19.3, build Next sans configuration, jamais dans le JavaScript client) ; `src/receipts/` (instantané d'une quittance, contenu en douze blocs, document, rendu, polices TTF sous SIL OFL, règles de mois, de période, de référence, de validation) ; `src/rentals/rental-archivable.ts`. Précisions inscrites en tête de la spécification 04 (quinze lettres rares non dessinées, espace fine remplacée, réduction d'échelle pour tenir sur une page, coupe des mots longs, tests du PDF dans l'environnement `node`). L'exception « sans quittance, suppression directe » est inscrite (R43, CA56, CA57) ; sa phrase d'écran est validée par l'utilisateur. Spécification : 43 règles, 56 critères.

T1 et T2 testées par `createur-de-tests` et **commitées** : 438 tests ajoutés (2678 au total), identiques sous trois fuseaux, aucun écart avec la spécification ; `unpdf` en dépendance de développement et module d'aide `src/test-support/read-pdf.ts` (texte, pages, métadonnées, polices d'un PDF), réutilisable par la `qa`. Suites avant commit : lint sans erreur ni avertissement, 2678 Vitest, 325 e2e et 1 ignoré.

**T3 (données) terminée et commitée** : migration `drizzle/0002_quittances_et_archivage.sql` (appliquée aux deux bases, uniquement additive), tables `landlord` et `receipt`, `rental.archived_at` ; `src/receipts/landlord-store.ts`, `src/receipts/receipt-store.ts`, `src/rentals/rental-store.ts` complété (archiver, restaurer, lister les archives, suppression dans sa forme finale). Toute écriture qui dépend de l'état d'une location commence par un verrou de ligne (`lockRentalForWrite`) puis porte sa condition dans la requête : c'est ce qui tranche les courses (production contre suppression, production contre archivage, etc.). La base refuse d'effacer une location qui a une quittance (`ON DELETE NO ACTION`) tout en laissant le compte tout emporter (`CASCADE`, contrôlé en fin d'instruction). 97 tests d'intégration ajoutés (165 au total), isolation à deux comptes sur chaque opération. Précisions acceptées : `produceReceipt` distingue huit résultats ; `archiveRental` reçoit l'instant et non la date ; une quittance porte `owner_id`, garanti égal à celui de sa location par une clé étrangère composée.

**T4 terminée, testée, recettée et commitée** : `/mes-informations`, section « Quittances » du détail, page de production et ses trois blocs, Route Handler `GET /quittances/[id]/pdf` (200, 307 sans `retour`, 404 identiques, 503, 500, 405, 400), `/quittances/[id]/supprimer`, suppression directe d'une location sans quittance. Une adresse de téléchargement n'est plus acceptée comme destination de retour après connexion. 317 tests Vitest ajoutés (2995 au total) ; `e2e/quittances.spec.ts` et `e2e/aide-quittances.ts` ; trois tests e2e existants adaptés (liens désignés par leur nom). Première recette `qa` : conforme avec réserves, aucun bug ; PDF réel vérifié (douze blocs, métadonnées, valeurs figées après modification de la location et du bailleur) ; isolation tenue sur le téléchargement et les trois actions ; 0 violation axe.

**T5 terminée, testée et recettée (2026-10-12)** : `/archives`, `/locations/[id]/archiver`, détail archivé en consultation seule, restauration, suppression définitive avec ses quittances ; `rental-actions.tsx` porte les quatre cas du détail actif (en cours ou terminée, avec ou sans quittance). 90 tests Vitest ajoutés (3085 au total) ; `e2e/archivage.spec.ts`, `archivage-isolation.spec.ts`, `archivage-rendu.spec.ts`, `aide-archives.ts` ; tests existants complétés (`Archiver` dans CA28, lien `Archives`, `/archives` et `/archiver` dans les listes d'adresses protégées).

**Recette finale `qa` : conforme, aucun bug applicatif.** Isolation tenue à deux comptes sur les pages et les trois actions (404 identiques à ceux d'un identifiant inconnu, jamais une redirection, rien d'écrit) ; onglets restés ouverts sans effet ; rien n'est écrit par un GET ; 0 violation axe ; clavier et focus vérifiés sur les pages de T4 et de T5 ; PDF aux longueurs maximales relu à l'œil ; la clé étrangère refuse bien d'effacer une location active qui a une quittance quand le code oublie sa condition. Mutations : quatre détectées ; le filtre sur le propriétaire retiré de `restoreRental` survit aux e2e parce que l'action relit d'abord la location du propriétaire (l'isolation du magasin seul est tenue par les tests d'intégration).

**Test e2e intermittent : identifié et corrigé.** « CA39 (partie T4) » de `e2e/quittances.spec.ts` cherchait le montant « 425 » dans les adresses, et un UUID aléatoire en contient parfois. Défaut du test, pas de l'application : les identifiants sont maintenant masqués avant la recherche. Cinq passages complets enregistrés.

État final avant fusion : lint sans erreur ni avertissement, build vert (toutes les routes privées en `ƒ`), 3085 Vitest, 165 tests d'intégration, 391 e2e et 1 ignoré.

Non vérifié par la recette finale : la borne exacte de minuit à Paris dans un navigateur (tenue par les tests Vitest) ; une écriture qui échoue alors que la session est valide ; l'injection de HTML (CA44) rejouée sur les pages de T5 (aucun `dangerouslySetInnerHTML` dans `src/`, React échappe les textes) ; la relecture à l'œil à 320 et 768px (contrôlée par mesure) ; le 500 du Route Handler dans un navigateur.

Pistes d'amélioration du document, non retenues pour l'instant : la moitié basse de la page est vide (espace de signature), la mention de réserve est petite.

**Étape en cours : accord de l'utilisateur pour fusionner `quittance-pdf` dans `main`.** Fiches 15 à 18 écrites.

Puis, dans l'ordre proposé : envoi d'e-mails (choix du service ; débloque la réinitialisation du mot de passe et la vérification de l'adresse) ; échéances et tâches planifiées (le jour J, confirmation, quittance ou relance) ; tableau de bord des loyers et exports.

### Ensuite

- **Écritures de Better Auth après leur délai** (mesuré en fin de fonctionnalité 03) : la session créée à la connexion et la déconnexion peuvent s'exécuter après le délai du pilote ; l'inscription passe par `db.transaction` de l'adaptateur, exposée à la connexion laissée dans une transaction ouverte. Remèdes : un délai par défaut sur le rôle ou la base (par migration, sur chaque branche Neon), et fournir à l'adaptateur un objet dont `transaction` passe par `runWriteTransaction`.
- **Rendus possibles par le retrait de `cacheComponents`**, non faits : lire le paramètre `retour` dans l'adresse de `/connexion` plutôt que dans l'en-tête `Referer` ; retirer du proxy la redirection sans session et celle de `/locations`, que les pages font elles-mêmes.
- **Limites acceptées de la fonctionnalité 03** : « Location introuvable » répond 404 mais son document est vide sans JavaScript ; une action refusée sans JavaScript affiche la page 404 générale ; une adresse à l'encodage illisible répond 400 ; un identifiant écrit avec un encodage (`%2D`) sert la page de son propriétaire ; doublon possible à la création sans JavaScript ; le dernier enregistrement l'emporte entre deux onglets ; limite de 100 locations non garantie sous concurrence.
- **Test instable non expliqué** : « Fixation de session » (`e2e/connexion.spec.ts`) a échoué une fois, jamais reproduit depuis (160 répétitions, plus de quinze passages complets). L'autre échec intermittent est expliqué et corrigé (voir la fonctionnalité 04).
- **Avant toute ouverture au public** (Q8 de la spécification 02) : limitation des tentatives de connexion et d'inscription ; réinitialisation du mot de passe et vérification de l'adresse (demandent le service d'envoi d'e-mails) ; écart de temps de réponse entre adresse inconnue et mot de passe faux ; mentions légales et information sur les données personnelles ; suppression de compte.
- **Limites connues** : environ 10 s avant l'écran de panne quand la base ne répond pas du tout (proxy puis page, 5 s chacun) ; sans en-tête `Referer`, le retour vers la page demandée est perdu ; sans JavaScript, une déconnexion pendant une panne de base affiche « Internal Server Error » ; avertissement `sslmode` du pilote `pg` au démarrage.
- **Reportés de la fonctionnalité 01** : tokens de taille en `px` (agrandir le texte seul dans le navigateur n'a pas d'effet, envisager `rem`) ; seul Chromium est configuré dans Playwright (Safari, Firefox et un vrai téléphone ne sont pas vérifiés) ; `hover:` de Tailwind 4 inactif sur écran tactile ; contraste des couleurs sémantiques `success` et `warning` pour du texte (à traiter avec les statuts de loyer).
- Choix techniques à expliquer et décider le moment venu : envoi d'e-mails, tâches planifiées.
- Le nom du propriétaire n'est pas demandé à l'inscription : à ajouter quand les quittances en auront besoin.
- Les comptes `@quittances.test` de la base de test peuvent être purgés à tout moment ; chaque exécution de `pnpm test:e2e` en crée.

## Décisions prises

- Le paiement est pointé manuellement par le propriétaire ; une quittance ne part qu'après confirmation.
- Le locataire n'a pas de compte.
- WhatsApp, paiement en ligne et connexion bancaire sont reportés.
- Les agents communiquent par les spécifications de `docs/specs/` ; la session principale orchestre.
- Thème clair uniquement. Polices Google uniquement (Plus Jakarta Sans pour les titres, DM Sans, JetBrains Mono), chargées avec `next/font/google`.
- Couleur primaire `#4F46E5` (survol `#4338CA`) : `#6366F1` n'atteignait pas 4.5:1 avec le blanc.
- Page d'accueil : appel à l'action « Voir comment ça marche » (ancre), tant que l'inscription n'existe pas.
- Base de données : Postgres hébergé chez Neon, accès avec Drizzle (schéma et requêtes typés, migrations SQL).
- Authentification : Better Auth, e-mail et mot de passe ; les comptes et les sessions vivent dans la base du projet.
- Base Neon en région Europe (Francfort).
- Quittances en PDF produites sur le serveur avec des composants React pour PDF (`@react-pdf/renderer`), servies par un Route Handler.
- Les routes internes passent par `next/link`, jamais par un `<a>` natif : pas de rechargement complet de la page.
- `cacheComponents` retiré de `next.config.ts` le 2026-10-11 : les bons codes HTTP (404, 307) et les formulaires sans JavaScript priment sur le rendu partiel.
- Rythme allégé à partir de la fonctionnalité 03 : recette `qa` à la première tranche de bout en bout et à la fin, pas après chaque tâche ; e2e complets une fois avant chaque commit.
- Agents de développement en `sonnet` par défaut ; l'orchestrateur demande `opus` à l'appel pour les tâches difficiles (authentification, isolation des données, logique de dates).

## Notions déjà vues (fiches)

- 01 — Création du projet : App Router, layout et page, statique ou dynamique, `cacheComponents`.
- 02 — Agents IA : contexte séparé, outils, choix du modèle, orchestration.
- 03 — Stratégie de tests : niveaux, pyramide et trophée, Vitest, RTL, limites avec les Server Components.
- 04 — Recette et e2e : vérification et validation, Playwright, accessibilité, rapport de bug.
- 05 — Polices et tokens : `next/font`, CLS, `font-display`, `@theme` de Tailwind 4, contraste.
- 06 — Server Components : frontière `"use client"`, hydratation, HTML sémantique (liens, titres, repères, listes).
- 07 — Accessibilité au clavier : lien d'évitement, `:focus-visible`, ancres sous un en-tête fixe, techniques de masquage, `next/link`.
- 08 — Base de données : Postgres, Neon, ORM, migrations, isolation des données, accès depuis l'App Router.
- 09 — Authentification : hachage, session et cookie `httpOnly`, CSRF, autorisation, protection des routes dans l'App Router.
- 10 — Server Actions et formulaires : `useActionState`, amélioration progressive, validation serveur, accessibilité des formulaires.
- 11 — Protéger une route : proxy, cookie et Server Components, statique / partiel / dynamique, panne comme état, redirection ouverte.
- 12 — Sécurité de la connexion : énumération, redirection ouverte (valider n'est pas normaliser), fixation de session, canal du temps de réponse, ce que chaque niveau de test voit.
- 13 — Données, mutations et contrôle d'accès par identifiant : lecture dans un Server Component, ordre des contrôles d'une action, IDOR, ce que `bind` ne protège pas, argent en centimes, dates sans fuseau.
- 14 — `cacheComponents`, rendu partiel et codes HTTP : ce qu'il apporte, ce qu'il coûte, pourquoi on l'a retiré, codes à connaître.
- 15 — Route Handler et réponse binaire : page, Server Action ou Route Handler, en-têtes d'un téléchargement, erreurs sans `error.tsx`, flux ou fichier entier.
- 16 — Générer un PDF côté serveur : familles de solutions, contenu séparé de la mise en page, polices incorporées, tenir sur une page, valeurs figées et fichier reproductible.
- 17 — Concurrence : lecture périmée, condition dans l'écriture, contrainte d'unicité, `SELECT … FOR UPDATE`, `ON DELETE NO ACTION` ou `CASCADE`, onglets restés ouverts.
- 18 — Archiver ou supprimer : suppression réelle, logique, archivage ; état par date ; consultation seule tenue par le serveur ; appartenance avant état ; confirmer une action destructrice.

## Notions à couvrir

Server et Client Components, hydratation, modes de rendu (SSG, SSR, ISR, streaming, PPR), cache et revalidation, data fetching, Server Actions et formulaires, hooks et cycle de rendu, gestion d'état, tests unitaires, d'intégration et e2e, accessibilité, performance et Core Web Vitals, sécurité.
