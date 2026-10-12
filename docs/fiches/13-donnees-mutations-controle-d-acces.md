# Fiche 13 — Lire, modifier, et contrôler l'accès par identifiant

## Lire des données dans un Server Component

Une page `async` lit directement la base, sans route d'API ni `useEffect` :

```tsx
export default async function Page() {
  const owner = await getCurrentOwner();        // session, sur le serveur
  const rentals = await listRentals(owner);     // requête filtrée
  return <RentalList rentals={rentals} />;
}
```

Le code d'accès et la chaîne de connexion ne quittent pas le serveur (`import "server-only"`). Lire les cookies rend la page dynamique : elle est rendue à chaque requête, donc toujours à jour.

## Modifier : Server Action, puis invalider, puis rediriger

```ts
"use server";
export async function updateRentalAction(rentalId: unknown, prev: State, formData: FormData) {
  const owner = await getCurrentOwner();          // 1. qui ?
  if (!owner) redirect("/connexion");
  const rental = await getRental(owner, rentalId); // 2. a-t-il le droit ?
  if (!rental) notFound();
  const result = validateRentalForm(readRentalFormFields(formData)); // 3. quoi ?
  if (!result.ok) return { fields: result.fields, errors: result.errors };
  await updateRental(owner, rentalId, result.values);                 // 4. écrire
  revalidatePath("/tableau-de-bord");                                 // 5. périmer
  redirect(`/locations/${rentalId}`);                                 // 6. montrer
}
```

- L'ordre compte : identité, autorisation, validation, écriture. Valider avant d'autoriser renseignerait un intrus sur le format attendu.
- `revalidatePath` périme ce que le routeur du navigateur garde en mémoire : sans lui, la liste pourrait montrer l'ancien état.
- `redirect()` et `notFound()` fonctionnent en levant une erreur : on les appelle hors de tout `try`.

## Le contrôle d'accès par identifiant (IDOR)

`/locations/42` : « connecté » ne suffit pas, il faut « propriétaire de 42 ». C'est la faille la plus répandue des applications à comptes (contrôle d'accès défaillant, en tête du classement OWASP).

Ce qu'on a mis en place :

- **Le filtre est dans la requête SQL** : `WHERE id = $1 AND owner_id = $2`. Pas « lire, puis vérifier » : on ne lit jamais la ligne d'un autre.
- **Pour écrire, on compte les lignes affectées** (`UPDATE … RETURNING id`) plutôt que de lire puis d'écrire : aucune fenêtre entre le contrôle et l'écriture.
- **« Pas à moi » et « n'existe pas » donnent la même réponse** : même code 404, même corps. Sinon l'application confirme qu'un identifiant existe.
- **Le propriétaire vient de la session**, jamais d'un champ du formulaire. Un champ `ownerId` envoyé par le navigateur est ignoré.
- **Identifiants non devinables** (UUID) : utile, mais ce n'est pas une protection. Un identifiant fuit par un lien partagé, un historique, un journal.
- **Un seul module** lit et écrit les locations. Tout le reste passe par lui.

### Ce que `bind` ne fait pas

`action.bind(null, rental.id)` passe l'identifiant à l'action sans champ visible dans le formulaire. On pourrait croire qu'il est protégé : **il ne l'est pas**. Next l'écrit en clair dans un champ caché, et le navigateur peut le remplacer. Seules les variables capturées par une action définie *dans* un composant sont chiffrées.

Conclusion à retenir : tout ce qui transite par le navigateur est une demande, jamais une autorisation. La recette a remplacé cet identifiant par celui de la location d'un autre compte : 404, et rien d'écrit, parce que l'écriture filtre sur le propriétaire.

## L'argent et les dates

- **Montants en centimes entiers.** `0.1 + 0.2 !== 0.3` en virgule flottante. On lit la saisie comme du texte (`1 250,50` donne 125 050), sans passer par un nombre à virgule. Trois décimales sont refusées, pour que `1.250` ne soit jamais lu comme 1250.
- **Dates en chaînes `AAAA-MM-JJ`.** `new Date("2026-01-05")` est minuit UTC : affiché à Los Angeles, c'est le 4. Une date de calendrier n'est pas un instant.
- **« Aujourd'hui » se passe en paramètre.** La fonction de statut reçoit la date du jour ; une autre fonction la calcule pour `Europe/Paris`. On teste ainsi minuit, les changements d'heure et le 29 février sans figer l'horloge, et le résultat ne dépend pas du fuseau du serveur.
- **Contraintes en base** (`CHECK`, clé étrangère en cascade) en plus de la validation : si un chemin de code oublie une règle, la base refuse.

## Questions d'entretien

**Comment évitez-vous qu'un utilisateur accède aux données d'un autre ?**
Le filtre sur le propriétaire est dans chaque requête, le propriétaire vient de la session lue sur le serveur, et un seul module accède à la table. La réponse est identique pour une ressource d'autrui et une ressource inexistante. Et je le prouve par des tests à deux comptes, sur chaque opération, y compris en appelant l'action directement.

**Server Action : comment lui passer l'identifiant de l'objet à modifier ?**
Par `bind` ou par un champ caché, peu importe : dans les deux cas il vient du navigateur et peut être modifié. L'action doit revérifier la session et l'appartenance.

**Pourquoi stocker l'argent en centimes ?**
Les nombres à virgule flottante ne représentent pas exactement les décimaux. Les entiers sont exacts, et la base peut les contraindre.

**`revalidatePath`, `revalidateTag`, `router.refresh()` ?**
`revalidatePath` périme une route (ou un segment) après une mutation. `revalidateTag` périme toutes les données portant une étiquette, où qu'elles soient affichées. `router.refresh()` redemande la page courante depuis le navigateur.

**Que renvoyer quand la ressource n'appartient pas à l'utilisateur : 403 ou 404 ?**
404 si l'existence même de la ressource est une information à protéger, ce qui est le cas dès que les identifiants sont privés. 403 quand la ressource est connue de tous et que seul le droit manque.

**Comment tester une règle qui dépend de la date du jour ?**
On injecte la date : la fonction la reçoit en paramètre. Les tests passent des dates choisies, et la suite tourne sous plusieurs fuseaux pour vérifier qu'elle n'en dépend pas.
