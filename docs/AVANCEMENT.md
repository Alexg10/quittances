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

### Prochaine étape

Choisir la **deuxième fonctionnalité** et la confier au `chef-de-projet`. Elle demandera les premiers choix techniques, à expliquer et décider avant la spécification : base de données (un serveur MCP Neon est disponible dans la session) et authentification. Suggestion : inscription et connexion du propriétaire, puisque tout le reste (locations, quittances, tableau de bord) dépend d'un compte et de l'isolation des données entre comptes.

Points laissés ouverts par la recette, à reprendre dans une prochaine spécification :

- Tokens de taille en `px` : agrandir le texte seul dans le navigateur n'a pas d'effet. Envisager `rem`.
- Seul Chromium est configuré dans Playwright : Safari (flou d'arrière-plan, listes sans puces avec VoiceOver) et Firefox ne sont pas vérifiés.
- `hover:` de Tailwind 4 est inactif sur écran tactile : les tests de survol vérifient le comportement à la souris.
- Contraste des couleurs sémantiques (Q5 de la spécification 01) et mentions légales (Q3).

### Ensuite

- Ajuster les prompts des agents selon ce qu'on observe. À faire : dire à `qa` de ranger ses captures hors de `test-results/` (vidé par Playwright), et à tous d'éprouver leurs tests par mutation avec `perl` plutôt que le `sed` de macOS.
- Quand l'inscription existera : remplacer l'appel à l'action « Voir comment ça marche » par « Créer mon compte » et retirer la section « Les inscriptions ouvrent bientôt » (R18 de la spécification 01).
- Choix techniques à expliquer et décider le moment venu : base de données, authentification, génération de PDF, envoi d'e-mails, tâches planifiées.

## Décisions prises

- Le paiement est pointé manuellement par le propriétaire ; une quittance ne part qu'après confirmation.
- Le locataire n'a pas de compte.
- WhatsApp, paiement en ligne et connexion bancaire sont reportés.
- Les agents communiquent par les spécifications de `docs/specs/` ; la session principale orchestre.
- Thème clair uniquement. Polices Google uniquement (Plus Jakarta Sans pour les titres, DM Sans, JetBrains Mono), chargées avec `next/font/google`.
- Couleur primaire `#4F46E5` (survol `#4338CA`) : `#6366F1` n'atteignait pas 4.5:1 avec le blanc.
- Page d'accueil : appel à l'action « Voir comment ça marche » (ancre), tant que l'inscription n'existe pas.
- Les routes internes passent par `next/link`, jamais par un `<a>` natif : pas de rechargement complet de la page.
- Agents de développement en `sonnet` par défaut ; l'orchestrateur demande `opus` à l'appel pour les tâches difficiles (authentification, isolation des données, logique de dates).

## Notions déjà vues (fiches)

- 01 — Création du projet : App Router, layout et page, statique ou dynamique, `cacheComponents`.
- 02 — Agents IA : contexte séparé, outils, choix du modèle, orchestration.
- 03 — Stratégie de tests : niveaux, pyramide et trophée, Vitest, RTL, limites avec les Server Components.
- 04 — Recette et e2e : vérification et validation, Playwright, accessibilité, rapport de bug.
- 05 — Polices et tokens : `next/font`, CLS, `font-display`, `@theme` de Tailwind 4, contraste.
- 06 — Server Components : frontière `"use client"`, hydratation, HTML sémantique (liens, titres, repères, listes).
- 07 — Accessibilité au clavier : lien d'évitement, `:focus-visible`, ancres sous un en-tête fixe, techniques de masquage, `next/link`.

## Notions à couvrir

Server et Client Components, hydratation, modes de rendu (SSG, SSR, ISR, streaming, PPR), cache et revalidation, data fetching, Server Actions et formulaires, hooks et cycle de rendu, gestion d'état, tests unitaires, d'intégration et e2e, accessibilité, performance et Core Web Vitals, sécurité.
