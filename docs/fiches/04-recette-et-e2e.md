# Fiche 04 — Recette, tests e2e et accessibilité

## Tests automatisés et recette : deux questions différentes

- **Vérification** : « le code fait-il ce que le développeur a voulu ? » → tests unitaires et d'intégration. Ils ne trouvent que ce qu'on a pensé à écrire.
- **Validation (recette)** : « le produit fait-il ce dont l'utilisateur a besoin ? » → on utilise l'application réelle, critère d'acceptation par critère, puis on sort du chemin prévu.

Les deux se complètent. Une suite de tests entièrement verte n'empêche pas un bouton invisible sur mobile, une erreur dans la console ou un formulaire inutilisable au clavier.

**Test exploratoire** : tester sans script, en cherchant activement à casser. Cibles habituelles : valeurs limites, double soumission, bouton retour, rechargement, URL saisie à la main, autre taille d'écran.

## Playwright

Outil de test de bout en bout : il pilote un vrai navigateur (Chromium, Firefox, WebKit).

Ce qu'il apporte par rapport à Vitest + jsdom :

- vraie mise en page, vrai CSS, vraie navigation, vrais cookies ;
- le serveur Next tourne : les Server Components `async`, les Server Actions et l'authentification sont réellement exercés ;
- **attente automatique** : avant d'agir sur un élément, Playwright attend qu'il soit visible et actif ; les assertions `expect(...)` réessaient jusqu'à un délai. Pas besoin de `sleep` ;
- **trace** en cas d'échec : enregistrement pas à pas (DOM, réseau, console) rejouable.

## Ce qu'on a configuré

- `playwright.config.ts` :
  - tests dans `e2e/` ;
  - deux projets, `bureau` (Chrome) et `mobile` (Pixel 7) : chaque test tourne dans les deux ;
  - `webServer` : lance `pnpm build && pnpm start` sur le port 3100. On teste le **build de production**, pas le serveur de développement, parce que le cache et le pré-rendu ne s'y comportent pas de la même façon ;
  - langue `fr-FR` et fuseau `Europe/Paris`, pour des dates et des montants stables ;
  - trace et capture conservées en cas d'échec.
- `pnpm test:e2e` : lance la suite.
- `@axe-core/playwright` : audit d'accessibilité automatisé d'une page.

## Accessibilité : ce que l'outil voit et ne voit pas

Un audit automatique (axe, Lighthouse) détecte environ un tiers des problèmes : contraste, label manquant, attribut ARIA invalide, image sans alternative.

Il ne détecte pas : un ordre de focus incohérent, un piège au clavier, un texte alternatif présent mais faux, un message d'erreur non annoncé. D'où le contrôle manuel : parcourir l'écran au clavier seul.

Repères WCAG à connaître : niveau visé AA, contraste de texte 4.5:1, tout est utilisable au clavier, focus visible, l'information ne passe jamais par la couleur seule.

## Un bon rapport de bug

Gravité, étapes pour reproduire, résultat attendu (avec la référence du critère), résultat observé (message exact, capture). Sans étapes de reproduction, un bug n'est pas corrigeable.

## Questions d'entretien

**Que testez-vous en e2e plutôt qu'en unitaire ?**
Les parcours critiques de bout en bout (connexion, action principale du produit), ce qui dépend du serveur et du navigateur réels, et ce que jsdom ne sait pas faire. Peu de tests, parce qu'ils sont lents et plus fragiles. Les cas limites restent en unitaire.

**Comment rendre des tests e2e fiables ?**
Sélecteurs par rôle plutôt que par classe CSS, attente d'une condition plutôt que d'une durée, données créées par le test lui-même, tests indépendants et exécutables dans n'importe quel ordre, environnement figé (langue, fuseau, horloge).

**Pourquoi tester contre le build de production ?**
Le mode développement compile à la demande, désactive une partie du cache et ajoute des vérifications. Un comportement de cache ou de pré-rendu ne se constate que sur le build.

**Playwright ou Cypress ?**
Playwright : plusieurs moteurs dont WebKit, parallélisme natif, plusieurs onglets et origines, traces. Cypress : s'exécute dans le navigateur, très bon confort de débogage, écosystème ancien. Les deux sont répandus.

**Comment intégrez-vous l'accessibilité dans votre travail ?**
HTML sémantique d'abord, ARIA seulement quand le HTML ne suffit pas. Règles ESLint `jsx-a11y`, requêtes par rôle dans les tests, audit axe en e2e, et vérification manuelle au clavier et au lecteur d'écran sur les parcours principaux.

**Qu'est-ce qu'une erreur d'hydratation ?**
Le HTML rendu par le serveur ne correspond pas au premier rendu du client (date, valeur aléatoire, accès à `window`, HTML invalide). React le signale dans la console et re-rend côté client. On la surveille en recette parce qu'aucun test unitaire ne la montre.
