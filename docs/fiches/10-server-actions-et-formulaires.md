# Fiche 10 — Server Actions et formulaires

## Ce qu'est une Server Action

Une fonction asynchrone marquée `"use server"`, exécutée sur le serveur, qu'un formulaire ou un composant client peut appeler sans écrire de route d'API. Next génère pour elle un point d'entrée HTTP (un POST vers la page, identifié par un en-tête).

Conséquence à ne jamais oublier : **c'est une API publique**. N'importe qui peut lui envoyer un POST sans passer par le formulaire. Elle valide donc tout ce qu'elle reçoit, vérifie elle-même la session quand il y a des données privées, et ne fait confiance à aucun champ caché.

## Ce qu'on a écrit

`src/app/(auth)/inscription/` :

- `page.tsx` : Server Component, pré-rendu (`○ /inscription`).
- `sign-up-form.tsx` : Client Component, parce qu'il utilise `useActionState`.
- `actions.ts` : la Server Action `signUp(previousState, formData)`.

```tsx
const [state, formAction, isPending] = useActionState(signUp, EMPTY_STATE);
<form action={formAction}>…</form>
```

- `state` : ce que l'action a renvoyé (e-mail à réafficher, messages d'erreur).
- `isPending` : vrai pendant l'envoi, pour désactiver le bouton et empêcher la double soumission.
- L'action renvoie un objet d'état en cas d'erreur, et appelle `redirect()` en cas de succès.

## Amélioration progressive

`<form action={fonction}>` fonctionne **sans JavaScript** : le navigateur envoie un POST classique, le serveur exécute l'action et renvoie la page avec les erreurs, ou une redirection 303. Avec JavaScript, React intercepte l'envoi, évite le rechargement et met à jour l'état.

C'est pourquoi la validation vit sur le serveur : elle est la seule à s'exécuter dans tous les cas. Une validation côté navigateur est un confort, jamais une protection.

## Pièges rencontrés

- **`redirect()` lève une erreur** pour interrompre le rendu : appelé dans un `try`, il est intercepté par le `catch`. On l'appelle après le bloc.
- **Types des champs** : `formData.get()` peut renvoyer `null` (champ absent) ou un `File`. On lit les champs par une fonction qui ne renvoie qu'une chaîne.
- **Ne jamais renvoyer le mot de passe** dans l'état : il partirait dans la réponse. L'e-mail est réaffiché, le mot de passe est vidé.
- **Journal** : on n'écrit que le nom de l'erreur, son message pouvant contenir la requête SQL et ses valeurs.
- **`instanceof` entre paquets** : une erreur levée par une autre copie de la classe ne passe pas le test. On a lu le code de l'erreur (`error.body.code`) plutôt que sa classe.
- **`server-only`** : un fichier qui l'importe ne se charge pas dans Vitest. Les règles pures de validation vivent dans des fichiers séparés, testables sans serveur.

## Accessibilité d'un formulaire

- Un `label` visible par champ, relié par `htmlFor` ; pas de `placeholder` en guise de libellé.
- `autocomplete` : `email`, `new-password` à l'inscription, `current-password` à la connexion. Les gestionnaires de mots de passe s'en servent.
- En erreur : `aria-invalid="true"` sur le champ, message relié par `aria-describedby`, et le focus déplacé sur le premier champ en erreur.
- Une erreur qui ne concerne aucun champ (panne) s'affiche dans un élément `role="alert"`, annoncé aussitôt.
- L'état d'attente est annoncé (`role="status"`), pas seulement montré.

## Questions d'entretien

**Server Action ou Route Handler ?**
Server Action pour une mutation déclenchée par l'interface de l'application : pas de route à écrire, amélioration progressive, intégration avec le cache et les redirections. Route Handler pour une API consommée par un tiers, un webhook, ou une réponse qui n'est pas du HTML.

**Comment une Server Action est-elle protégée contre le CSRF ?**
Seule la méthode POST est acceptée, et Next compare l'en-tête `Origin` à l'hôte : une requête venue d'un autre site est refusée. Le cookie de session en `SameSite=Lax` n'est de toute façon pas envoyé sur un POST intersite.

**Où valider les données d'un formulaire ?**
Toujours sur le serveur. En plus côté navigateur si on veut un retour immédiat, avec les mêmes règles partagées dans un module pur.

**`useActionState`, `useFormStatus`, `useOptimistic` : à quoi servent-ils ?**
`useActionState` : l'état renvoyé par l'action et l'indicateur d'attente. `useFormStatus` : l'état d'attente du formulaire parent, lisible depuis un composant enfant comme le bouton. `useOptimistic` : afficher tout de suite le résultat attendu, puis le corriger si le serveur refuse.

**Pourquoi le formulaire est-il un Client Component alors que la page est serveur ?**
Parce qu'il utilise un hook d'état. La frontière `"use client"` est placée sur le formulaire seul : la page, sa mise en page et ses textes restent serveur et pré-rendus.

**Que se passe-t-il après une mutation pour les données affichées ?**
Il faut invalider ce qui a changé : `revalidatePath`, `revalidateTag`, ou une redirection vers une page rendue à la demande. Sans cela, l'interface peut montrer des données périmées.
