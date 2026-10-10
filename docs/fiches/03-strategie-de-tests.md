# Fiche 03 — Stratégie de tests

## Les trois niveaux

| Niveau | Ce qu'on teste | Outil ici | Vitesse | Confiance |
| --- | --- | --- | --- | --- |
| **Unitaire** | Une fonction pure, isolée (calcul du montant, date d'échéance) | Vitest | Millisecondes | Faible sur l'ensemble, forte sur la logique |
| **Intégration / composant** | Un composant ou un formulaire, avec ses enfants, manipulé comme par un utilisateur | Vitest + React Testing Library + jsdom | Dizaines de ms | Bonne |
| **Bout en bout (e2e)** | L'application réelle dans un vrai navigateur, sur un parcours complet | Playwright (à installer) | Secondes | Très forte, mais lent et plus fragile |

**Pyramide de tests** : beaucoup d'unitaires, moins d'intégration, peu d'e2e. Plus on monte, plus un test coûte cher à écrire, à exécuter et à maintenir.

**Trophée de tests** (Kent C. Dodds) : variante répandue en front, qui met le plus gros de l'effort sur l'intégration. Argument : c'est là que le rapport confiance / coût est le meilleur pour de l'interface. Devise associée : « plus vos tests ressemblent à la façon dont le logiciel est utilisé, plus ils vous donnent confiance ».

## Les outils et leur rôle

- **Vitest** : le lanceur de tests (trouve les fichiers, exécute, fournit `describe`, `it`, `expect`, `vi`). Même API que Jest, mais bâti sur Vite : démarrage rapide, TypeScript et ESM sans configuration.
- **jsdom** : une imitation du DOM en JavaScript, dans Node. Pas de vrai navigateur : pas de mise en page, pas de CSS calculé, pas de navigation.
- **React Testing Library (RTL)** : rend un composant dans jsdom et fournit des requêtes centrées sur l'utilisateur (`getByRole`, `getByLabelText`).
- **user-event** : simule de vraies interactions (un clic déclenche survol, focus, mousedown, mouseup, click), contrairement à `fireEvent` qui n'émet qu'un événement.
- **jest-dom** : assertions lisibles sur le DOM (`toBeInTheDocument`, `toBeDisabled`, `toHaveTextContent`).

## Ce qu'on a configuré

- `vitest.config.mts` : environnement `jsdom`, plugin React (pour le JSX), alias `@/` repris de `tsconfig.json`, tests cherchés dans `src/**/*.test.{ts,tsx}`.
- `vitest.setup.ts` : charge les assertions jest-dom et démonte les composants après chaque test (isolation).
- `pnpm test` : une exécution. `pnpm test:watch` : relance à chaque modification.

## Limite à connaître avec Next

Vitest ne sait pas rendre un **Server Component `async`** (celui qui fait `await` pour charger ses données). On teste donc :

- la logique métier en unitaire, d'où l'intérêt de la sortir des composants dans des fonctions pures ;
- les Client Components et les Server Components synchrones avec RTL ;
- les pages `async` et les parcours complets en e2e.

## Principes

- **Tester le comportement, pas l'implémentation.** Un test qui vérifie l'état interne ou une classe CSS casse au moindre refactoring sans avoir détecté de bug.
- **Chercher les éléments comme un utilisateur** : par rôle et nom accessible d'abord. Bénéfice secondaire : un élément introuvable par son rôle révèle un défaut d'accessibilité.
- **Ne doubler (mock) que ce qui sort du processus** : réseau, base, e-mail, horloge. Trop de doublures, et on ne teste plus que les doublures.
- **Tests déterministes** : figer l'horloge pour tout ce qui dépend de la date. Capital ici, l'app repose sur des échéances mensuelles.
- **Celui qui écrit les tests part de la spécification**, pas du code. Sinon les tests confirment le code au lieu de le vérifier.

## Questions d'entretien

**Quelle est votre stratégie de test sur une application front ?**
Logique métier en tests unitaires, avec les cas limites. Composants et formulaires en tests d'intégration avec RTL, du point de vue de l'utilisateur. Quelques tests e2e sur les parcours critiques (connexion, action principale). Lint et typage en première ligne, le tout exécuté en CI à chaque pull request.

**Pourquoi `getByRole` plutôt que `getByTestId` ?**
`getByRole` interroge l'arbre d'accessibilité : le test vérifie en même temps que l'élément est utilisable avec un lecteur d'écran, et il survit à un changement de balisage. `data-testid` est invisible pour l'utilisateur et ne prouve rien sur l'accessibilité. À réserver aux cas sans alternative.

**Différence entre `getBy`, `queryBy` et `findBy` ?**
`getBy` lève une erreur si l'élément est absent. `queryBy` renvoie `null` : sert à affirmer une absence. `findBy` renvoie une promesse et réessaie jusqu'à un délai : sert à ce qui apparaît de façon asynchrone.

**Qu'est-ce qu'un test fragile (flaky), et comment l'éviter ?**
Un test qui passe ou échoue sans changement de code. Causes : dépendance à l'heure, au réseau, à l'ordre des tests, attentes fixes (`sleep`). Remèdes : horloge figée, doublures réseau, isolation entre tests, attendre une condition plutôt qu'une durée.

**La couverture de code est-elle un bon indicateur ?**
Elle montre ce qui n'est pas testé, pas la qualité de ce qui l'est : on peut exécuter 100 % des lignes sans rien affirmer d'utile. Utile comme signal, mauvais comme objectif.

**Jest ou Vitest ?**
API quasi identique. Vitest est plus rapide et gère nativement ESM et TypeScript ; Jest reste très présent dans les projets existants. Savoir passer de l'un à l'autre est attendu.

**Qu'est-ce que le TDD ?**
Écrire le test avant le code : rouge (le test échoue), vert (le minimum de code pour passer), refactor. Bénéfice : on conçoit l'interface avant l'implémentation, et chaque ligne de code est justifiée par un test.
