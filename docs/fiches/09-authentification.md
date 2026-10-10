# Fiche 09 — Authentification : sessions, cookies, autorisation

## Trois questions distinctes

- **Authentification** : qui es-tu ? (inscription, connexion)
- **Session** : comment le serveur s'en souvient-il d'une requête à l'autre ? HTTP est sans état.
- **Autorisation** : qu'as-tu le droit de voir et de faire ? (ici : uniquement les données de ton compte)

## Le mécanisme par session en base

1. **Inscription** : le mot de passe n'est jamais stocké. On stocke son **hachage** par une fonction lente et salée, conçue pour les mots de passe (argon2, scrypt, bcrypt). Un hachage rapide comme SHA-256 se casse par force brute.
2. **Connexion** : le serveur compare le mot de passe au hachage, crée une ligne `session` en base (identifiant aléatoire, propriétaire, expiration) et renvoie l'identifiant dans un **cookie**.
3. **Chaque requête** : le navigateur renvoie le cookie, le serveur retrouve la session, donc l'utilisateur.
4. **Déconnexion** : la ligne de session est supprimée ; le cookie ne vaut plus rien.

## Les attributs du cookie de session

| Attribut | Effet | Protège contre |
| --- | --- | --- |
| `HttpOnly` | illisible par le JavaScript de la page | vol de session par XSS |
| `Secure` | envoyé seulement en HTTPS | interception sur le réseau |
| `SameSite=Lax` | non envoyé sur les requêtes POST venant d'un autre site | CSRF |
| `Max-Age` / `Expires` | durée de vie | session éternelle |

## Session en base ou JWT

- **Session en base** : le cookie ne contient qu'un identifiant. Révocable à tout moment (déconnexion, changement de mot de passe), au prix d'une lecture en base par requête.
- **JWT** : le jeton signé contient les informations. Aucune lecture en base, mais il reste valide jusqu'à son expiration : la révocation demande une liste noire, donc… une lecture en base.

Pour une application avec des comptes et des données sensibles, la session en base est le choix simple et sûr.

## Ce qu'on a choisi

**Better Auth**, e-mail et mot de passe. La bibliothèque gère le hachage, les sessions, les cookies et la protection CSRF ; les comptes et les sessions vivent dans notre base Postgres, dans des tables décrites avec Drizzle. Nous écrivons les écrans (formulaires, Server Actions) et les contrôles d'accès.

Pourquoi pas à la main : les erreurs classiques (comparaison non constante, session non renouvelée à la connexion, message qui révèle si un e-mail existe) sont faciles à commettre et invisibles en test. Pourquoi pas un service géré : les comptes seraient hébergés ailleurs, et on apprendrait surtout l'API du fournisseur.

## Protéger une page dans l'App Router

- **Vérifier au plus près des données** : chaque Server Component, Server Action et Route Handler qui lit ou écrit des données privées vérifie lui-même la session. Une Server Action est un point d'entrée HTTP public : elle se protège comme une API.
- **Le proxy (ancien middleware) ne suffit pas** : il sert à rediriger tôt un visiteur non connecté, pas à garantir l'accès. Le contrôle réel reste côté données.
- **Isolation** : l'identifiant du propriétaire vient toujours de la session lue sur le serveur, jamais d'un paramètre d'URL ou d'un champ de formulaire.
- **Rendu** : lire les cookies rend la page dynamique (`ƒ` dans `pnpm build`).

## Questions d'entretien

**Où stocker un jeton de session côté navigateur ?**
Dans un cookie `HttpOnly`, `Secure`, `SameSite`. Pas dans `localStorage` : tout script de la page peut le lire, donc une faille XSS suffit à voler la session.

**Qu'est-ce qu'une attaque CSRF et comment s'en protéger ?**
Un autre site fait émettre au navigateur de la victime une requête vers notre application, cookies compris. Protections : `SameSite` sur le cookie, vérification de l'en-tête `Origin`, jeton anti-CSRF. Les Server Actions de Next comparent `Origin` et `Host`.

**Et XSS ?**
Injection de script dans la page. React échappe le texte par défaut ; le danger vient de `dangerouslySetInnerHTML`, des URL `javascript:` et des scripts tiers. Défense en profondeur : une Content Security Policy.

**Pourquoi répondre « identifiants incorrects » sans préciser lequel ?**
Dire « e-mail inconnu » permet d'énumérer les comptes existants. Même logique pour l'inscription et la réinitialisation du mot de passe.

**Authentification et autorisation : quelle différence ?**
La première établit l'identité, la seconde décide de l'accès. Une faille fréquente est le contrôle d'accès défaillant (IDOR) : `/locations/42` affiche la location d'un autre, parce que le code vérifie « connecté » mais pas « propriétaire de 42 ».

**Comment tester une application avec authentification ?**
Unitaire : les règles de validation et d'autorisation, session simulée. Bout en bout : un vrai parcours inscription puis connexion, contre une base de test, avec un état de session réutilisé entre les tests pour ne pas se reconnecter à chaque fois. Et toujours un test négatif : un compte ne voit pas les données d'un autre.
