@AGENTS.md

# quittances

Application Next.js pour propriétaires bailleurs : envoi automatisé des quittances de loyer et des relances.

## Produit

- Multi-propriétaires : chaque propriétaire a un compte et gère plusieurs locations. Les données d'un compte ne sont jamais visibles d'un autre.
- Le jour J (réglable par location), le propriétaire reçoit un e-mail et confirme ou non la réception du loyer.
- Si le loyer est confirmé, la quittance PDF part par e-mail au locataire. Sinon, le locataire est relancé.
- Le locataire n'a pas de compte : il ne reçoit que des e-mails.
- Tableau de bord des loyers reçus et impayés, avec exports.
- Hors périmètre pour l'instant : WhatsApp, paiement en ligne, connexion bancaire.

## Projet didactique

Ce projet sert à préparer des entretiens de développeur front senior (React, Next, tests, modes de rendu) et à apprendre à travailler avec des agents IA.

- Avancer une notion à la fois, expliquer avant de faire, attendre la validation avant l'étape suivante.
- À chaque notion, ajouter une fiche dans `docs/fiches/` : explication courte, puis questions d'entretien avec réponses types.
- Répondre en français.

## Reprise d'une session

Au début de chaque session, lire `docs/AVANCEMENT.md` et reprendre à « Prochaine étape ». Le mettre à jour à la fin de chaque étape.

## Chaîne de travail

Pour chaque fonctionnalité, la session principale orchestre les agents dans cet ordre, une tâche à la fois :

1. `chef-de-projet` (opus) rédige la spécification dans `docs/specs/`. L'utilisateur la valide.
2. `developpeur-front` (sonnet ; opus à l'appel pour l'authentification, l'isolation des données et la logique de dates) implémente une tâche.
3. `createur-de-tests` (sonnet) écrit les tests Vitest à partir de la spécification.
4. `qa` (sonnet) fait la recette dans le navigateur et écrit les tests e2e.

Un test rouge ou un bug remonté par les étapes 3 et 4 repart chez le développeur. Les agents ne font pas de commit.

## Repères

- `DESIGN.md` : design system à respecter pour toute interface.
- `docs/specs/` : spécifications des fonctionnalités, rédigées par l'agent `chef-de-projet`. C'est le contrat partagé entre les agents.
- `docs/fiches/` : fiches de révision.
- Tests : fichier `*.test.ts(x)` à côté du fichier testé, rédigés par l'agent `createur-de-tests` à partir de la spécification.

## Commandes

- `pnpm dev` : serveur de développement
- `pnpm build` : build de production (affiche le mode de rendu de chaque route)
- `pnpm lint` : ESLint
- `pnpm test` : tests Vitest, une exécution (`pnpm test:watch` pour le mode veille)
- `pnpm test:integration` : tests d'intégration Vitest (`*.integration.test.ts`) contre la base de test
- `pnpm test:e2e` : tests Playwright dans `e2e/`, contre le build de production servi sur le port 3100 et la base de test (exige `DATABASE_URL_TEST`)
- `pnpm db:generate` : génère une migration SQL dans `drizzle/` à partir de `src/db/schema.ts`
- `pnpm db:migrate` : applique les migrations à la base de développement (`DATABASE_URL`)
- `pnpm email:send <id-quittance>` : envoie une quittance par le transport local, pour le compte qui la possède (base de développement, refuse si `EMAIL_TRANSPORT` n'est pas `local`)
- `pnpm email:export` : écrit les messages du transport local en fichiers `.eml` dans `.emails/` (ignoré par Git)
- `pnpm db:migrate:test` : applique les migrations à la base de test (`DATABASE_URL_TEST`)

Les variables d'environnement sont dans `.env.local` (jamais commité) et documentées dans `.env.example`. Les tests n'utilisent jamais la base de développement.
