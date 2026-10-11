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

### Prochaine étape

Fonctionnalité 03 : **gestion des locations** (branche `gestion-des-locations`) : créer, lister, consulter, modifier et retirer ses locations (bien, locataire et son e-mail, loyer et charges, jour d'échéance). Première donnée métier, donc première mise à l'épreuve de l'isolation entre comptes. Aucun nouveau choix technique.

Spécification `docs/specs/03-gestion-des-locations.md` rédigée par `chef-de-projet` et **validée** : 44 règles, 43 critères, 6 tâches. Le tableau de bord devient la liste des locations ; six routes sous `/locations`. Aucun calcul d'échéance dans cette version. Décisions : dix informations par location, un seul locataire, adresses françaises, supprimer efface et mettre fin archive (« Rouvrir »), limite de 100 locations par compte, **option légère** (ni clé de soumission ni numéro de version : doublon possible sans JavaScript, dernier enregistrement qui l'emporte), tokens `success-text`, `success-surface`, `warning-text`, `warning-surface` ajoutés à `DESIGN.md`.

| Tâche | Contenu | Modèle | Recette `qa` |
| --- | --- | --- | --- |
| T1 | Schéma, migration, fonctions d'accès filtrées par propriétaire | opus | non (pas d'interface) |
| T2 | Règles pures : montants, jour d'échéance, dates, statut | sonnet | non |
| T3 | Tableau de bord, liste, chip de statut, tests existants à adapter | sonnet | non |
| T4 | Formulaire de location (affichage seul) | sonnet | non |
| T5 | Création, détail, « introuvable », protection | opus | oui |
| T6 | Modification, fin, réouverture, suppression | opus | oui, recette complète |

**Rythme allégé**, décidé par l'utilisateur le 2026-10-11 : recette `qa` après T5 et à la fin seulement ; après chaque agent, l'orchestrateur ne relance que le lint et les tests rapides, et les tests e2e complets une fois avant chaque commit ; mutations réservées à l'isolation et aux montants ; `opus` pour T1, T5 et T6 seulement.

**T1 terminée et commitée** : table `rental` (migration `drizzle/0001_locations.sql`, appliquée aux deux bases), sept fonctions d'accès dans `src/rentals/rental-store.ts`, toutes filtrées sur le propriétaire dans la requête SQL, `src/rentals/rental-id.ts`, 39 tests d'intégration à deux comptes (62 au total). Aucun accès à la table hors de ces fonctions. 

**T2 terminée et commitée** : règles pures dans `src/rentals/` (`rental-amount`, `rental-dates`, `rental-due-day`, `rental-text`, `rental-messages`, `rental-validation`), sans import serveur ; 860 tests Vitest ajoutés (2027 au total), identiques sous trois fuseaux horaires ; mutations sur les montants détectées. Ambiguïtés de la spécification laissées en l'état : date faite d'espaces (L20), plus de 500 espaces dans un montant, UUID d'une autre version que 4 accepté par `isRentalId`.

**T3 et T4 terminées** : le tableau de bord est la liste des locations (groupes « en cours » et « terminées », chip de statut, état vide), `src/components/rental-form.tsx` est le formulaire de location. 121 tests Vitest ajoutés (2148 au total).

**T5 développée** par `developpeur-front` en `opus` (coupée une fois par la limite d'utilisation, puis reprise) : `src/app/locations/` (`/locations/nouvelle` et son action de création, `/locations/[id]` détail, écran « Location introuvable », `rental-access.ts` qui contrôle la session puis l'appartenance), `matcher` du proxy étendu à `/locations/:path*`. Isolation vérifiée à deux comptes dans le navigateur : réponse identique pour la location d'un autre, une location inexistante et un identifiant mal formé. T3, T4 et T5 commitées ensemble. Suites : lint propre, 2148 Vitest, 62 d'intégration, 215 e2e et 1 ignoré.

**Décision d'architecture, prise par l'utilisateur le 2026-10-11 : retirer `cacheComponents`** (« il nous faut les bons codes HTTP »). Sous ce réglage, toute page qui lit la session était reprise d'une coque vide : `notFound()` et `redirect()` appelés par une page répondaient 200, et sans JavaScript un formulaire refusé revenait vide. Attendu après retrait : « Location introuvable » en 404, redirections de page en vrais 307, erreurs de formulaire réaffichées sans JavaScript, routes protégées en `ƒ`.

**Retrait fait et commité** : `next.config.ts` sans `cacheComponents` ni `partialPrefetching`, plus aucun `export const instant`. Routes : `○ /`, `○ /connexion`, `○ /inscription`, `ƒ` pour `/tableau-de-bord` et tout `/locations`. Mesuré par le développeur : « Location introuvable » répond 404 avec un corps identique dans tous les cas ; chaque page protégée redirige elle-même en 307 sans session ; les erreurs de `/locations/nouvelle` se réaffichent sans JavaScript ; aucune page protégée servie depuis un cache ; plus de page précédente masquée dans le DOM. Suites : lint propre, 2148 Vitest, 62 d'intégration, 215 e2e et 1 ignoré.

**Décision attendue de l'utilisateur** : `notFound()` répond bien 404, mais son document est vide sans JavaScript (coque d'erreur de Next, l'écran est posé par le script). Options : (A) garder ainsi ; (C) faire lire la location par le proxy, qui réécrit vers une page ordinaire avec le code 404, ce qui rompt la règle « le proxy ne lit jamais une location ».

À faire avec T6 : page 404 générale en français (`app/not-found.tsx`, aujourd'hui la page anglaise de Next) ; ne donner de valeur à un champ de date que si elle est valide (avertissement de console) ; mémoriser `readOwner` du tableau de bord par requête.

À surveiller : le test e2e « Fixation de session » (`e2e/connexion.spec.ts`) a échoué une fois sur trois passages chez le développeur, cause non établie.

À reconsidérer, rendus possibles par le retrait (rien n'est changé) : lire `retour` dans l'adresse de `/connexion` plutôt que dans `Referer` ; retirer du proxy la redirection sans session et celle de `/locations`, que les pages font elles-mêmes.

Étape en cours : recette `qa` de T5 et non-régression de l'espace connecté. Puis T6.

Prompts des quatre agents ajustés avant de lancer (`02eade7`) : secrets, base de test et ports ; dossier de travail propre à chaque agent ; mutations avec `perl` ; liens internes en `next/link` ; critère d'isolation négatif dans chaque spécification.

### Ensuite

- **Avant toute ouverture au public** (Q8 de la spécification 02) : limitation des tentatives de connexion et d'inscription ; réinitialisation du mot de passe et vérification de l'adresse (demandent le service d'envoi d'e-mails) ; écart de temps de réponse entre adresse inconnue et mot de passe faux ; mentions légales et information sur les données personnelles ; suppression de compte.
- **Limites connues** : environ 10 s avant l'écran de panne quand la base ne répond pas du tout (proxy puis page, 5 s chacun) ; sans en-tête `Referer`, le retour vers la page demandée est perdu ; sans JavaScript, une déconnexion pendant une panne de base affiche « Internal Server Error » ; avertissement `sslmode` du pilote `pg` au démarrage.
- **Reportés de la fonctionnalité 01** : tokens de taille en `px` (agrandir le texte seul dans le navigateur n'a pas d'effet, envisager `rem`) ; seul Chromium est configuré dans Playwright (Safari, Firefox et un vrai téléphone ne sont pas vérifiés) ; `hover:` de Tailwind 4 inactif sur écran tactile ; contraste des couleurs sémantiques `success` et `warning` pour du texte (à traiter avec les statuts de loyer).
- Choix techniques à expliquer et décider le moment venu : génération de PDF, envoi d'e-mails, tâches planifiées.
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

## Notions à couvrir

Server et Client Components, hydratation, modes de rendu (SSG, SSR, ISR, streaming, PPR), cache et revalidation, data fetching, Server Actions et formulaires, hooks et cycle de rendu, gestion d'état, tests unitaires, d'intégration et e2e, accessibilité, performance et Core Web Vitals, sécurité.
