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

Rien n'est encore commité en dehors du commit initial de `create-next-app`.

### Prochaine étape

Les quatre agents existent mais aucun n'a encore été appelé. Choisir la **première fonctionnalité** et la confier au `chef-de-projet` pour tester la chaîne. Suggestion : page d'accueil publique + mise en place du design system (polices, tokens Tailwind), sans base de données ni authentification, pour valider la chaîne sur quelque chose de simple.

### Ensuite

- Dérouler la chaîne spec → dev → tests → QA, puis ajuster les prompts des agents selon ce qu'on observe.
- Faire un premier commit (rien n'est commité depuis `create-next-app`).
- Choix techniques à expliquer et décider le moment venu : base de données, authentification, génération de PDF, envoi d'e-mails, tâches planifiées, outils de test.

## Décisions prises

- Le paiement est pointé manuellement par le propriétaire ; une quittance ne part qu'après confirmation.
- Le locataire n'a pas de compte.
- WhatsApp, paiement en ligne et connexion bancaire sont reportés.
- Les agents communiquent par les spécifications de `docs/specs/` ; la session principale orchestre.
- Thème clair uniquement. Polices Google uniquement (Plus Jakarta Sans pour les titres, DM Sans, JetBrains Mono), chargées avec `next/font/google`.
- Agents de développement en `sonnet` par défaut ; l'orchestrateur demande `opus` à l'appel pour les tâches difficiles (authentification, isolation des données, logique de dates).

## Notions déjà vues (fiches)

- 01 — Création du projet : App Router, layout et page, statique ou dynamique, `cacheComponents`.
- 02 — Agents IA : contexte séparé, outils, choix du modèle, orchestration.
- 03 — Stratégie de tests : niveaux, pyramide et trophée, Vitest, RTL, limites avec les Server Components.
- 04 — Recette et e2e : vérification et validation, Playwright, accessibilité, rapport de bug.

## Notions à couvrir

Server et Client Components, hydratation, modes de rendu (SSG, SSR, ISR, streaming, PPR), cache et revalidation, data fetching, Server Actions et formulaires, hooks et cycle de rendu, gestion d'état, tests unitaires, d'intégration et e2e, accessibilité, performance et Core Web Vitals, sécurité.
