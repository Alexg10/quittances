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
11. T1 recettée par `qa` : CA1 à CA10 conformes, aucun bug. Tests e2e durables du socle dans `e2e/socle-design-system.spec.ts` (7 tests, verts sur `bureau` et `mobile`, vérifiés en cassant deux tokens). Pas encore commitée.

### Prochaine étape

T2 (contenu principal de la page d'accueil) : `developpeur-front`, puis `createur-de-tests` (premier appel : CA11 à CA20 et CA22 sont vérifiables avec Vitest), puis `qa`. Avant T2, décider si on commite T1.

### Ensuite

- T3 (en-tête, lien d'évitement, recette complète et e2e durables).
- Ajuster les prompts des agents selon ce qu'on observe (déjà fait : `createur-de-tests` savait Playwright « pas installé »).
- Commit de la fonctionnalité une fois recettée.
- Choix techniques à expliquer et décider le moment venu : base de données, authentification, génération de PDF, envoi d'e-mails, tâches planifiées.

## Décisions prises

- Le paiement est pointé manuellement par le propriétaire ; une quittance ne part qu'après confirmation.
- Le locataire n'a pas de compte.
- WhatsApp, paiement en ligne et connexion bancaire sont reportés.
- Les agents communiquent par les spécifications de `docs/specs/` ; la session principale orchestre.
- Thème clair uniquement. Polices Google uniquement (Plus Jakarta Sans pour les titres, DM Sans, JetBrains Mono), chargées avec `next/font/google`.
- Couleur primaire `#4F46E5` (survol `#4338CA`) : `#6366F1` n'atteignait pas 4.5:1 avec le blanc.
- Page d'accueil : appel à l'action « Voir comment ça marche » (ancre), tant que l'inscription n'existe pas.
- Agents de développement en `sonnet` par défaut ; l'orchestrateur demande `opus` à l'appel pour les tâches difficiles (authentification, isolation des données, logique de dates).

## Notions déjà vues (fiches)

- 01 — Création du projet : App Router, layout et page, statique ou dynamique, `cacheComponents`.
- 02 — Agents IA : contexte séparé, outils, choix du modèle, orchestration.
- 03 — Stratégie de tests : niveaux, pyramide et trophée, Vitest, RTL, limites avec les Server Components.
- 04 — Recette et e2e : vérification et validation, Playwright, accessibilité, rapport de bug.
- 05 — Polices et tokens : `next/font`, CLS, `font-display`, `@theme` de Tailwind 4, contraste.

## Notions à couvrir

Server et Client Components, hydratation, modes de rendu (SSG, SSR, ISR, streaming, PPR), cache et revalidation, data fetching, Server Actions et formulaires, hooks et cycle de rendu, gestion d'état, tests unitaires, d'intégration et e2e, accessibilité, performance et Core Web Vitals, sécurité.
