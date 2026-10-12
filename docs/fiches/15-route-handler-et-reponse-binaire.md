# Fiche 15 — Route Handler : répondre par un fichier

## Ce qu'est un Route Handler

Un fichier `route.ts` exporte une fonction par méthode HTTP (`GET`, `POST`…) et renvoie une `Response` standard du Web. Pas de page, pas de layout, pas de React : c'est le serveur HTTP à l'état nu.

```ts
// src/app/quittances/[id]/pdf/route.ts
export async function GET(
  _request: Request,
  context: RouteContext<"/quittances/[id]/pdf">,
): Promise<Response> {
  const owner = await getCurrentOwner();          // 1. qui ?
  if (owner === null) return signInRedirectResponse();
  const { id } = await context.params;
  const receipt = await getReceipt(owner, id);    // 2. a-t-il le droit ?
  if (receipt === null) return notFoundResponse();
  const pdf = await renderReceiptPdf(receipt, receipt.producedAt); // 3. le fichier
  return pdfResponse(pdf, getReceiptFileName(receipt.id, receipt.month));
}
```

Un dossier contient soit `page.tsx`, soit `route.ts`, jamais les deux.

## Page, Server Action ou Route Handler

| Besoin | Outil |
| --- | --- |
| Afficher du HTML | page (Server Component) |
| Modifier une donnée depuis l'interface | Server Action |
| Rendre autre chose que du HTML (fichier, flux, JSON pour un tiers), recevoir un webhook | Route Handler |

Une Server Action ne peut pas servir un téléchargement : elle répond toujours à un POST, par une charge RSC ou une redirection. Un fichier se demande par un GET, que le navigateur peut suivre depuis un simple lien.

## Les en-têtes d'une réponse binaire

| En-tête | Valeur | Rôle |
| --- | --- | --- |
| `Content-Type` | `application/pdf` | le type du corps |
| `Content-Disposition` | `attachment; filename="quittance-2026-09-ab12cd34.pdf"` | enregistrer le fichier plutôt que l'afficher ; `inline` l'ouvrirait dans l'onglet |
| `Content-Length` | taille en octets | barre de progression, détection d'un fichier tronqué |
| `Cache-Control` | `private, no-store` | ni le navigateur ni un intermédiaire ne garde un document personnel |
| `X-Content-Type-Options` | `nosniff` | le navigateur s'en tient au type annoncé |

Le nom de fichier est fabriqué par le serveur (mois et début de l'identifiant), jamais à partir d'un texte saisi : un nom de locataire dans un en-tête ouvrirait la porte à l'injection d'en-têtes et aux problèmes d'encodage.

## Ce qu'un Route Handler ne reçoit pas

- **Aucun `error.tsx`, aucun `not-found.tsx`, aucun layout.** Une erreur qui remonte donne un 500 vide, et Next l'écrit en entier dans le journal. Chaque erreur est donc attrapée et traduite en réponse : 404, 503 (base muette), 500 (PDF impossible à construire).
- **Aucune feuille de styles.** Nos pages d'erreur du téléchargement sont des documents HTML autonomes, sans mise en forme. Accepté.
- **Aucune protection CSRF intégrée**, contrairement aux Server Actions. Sans gravité ici : un GET ne modifie rien. Un Route Handler qui écrirait devrait contrôler l'origine lui-même.

## Les choix du projet

- **Le contrôle d'accès est dans le handler.** C'est une adresse publique : session, puis lecture filtrée sur le propriétaire. « Pas à moi », « supprimée », « inconnue », « identifiant mal formé » : la fonction `notFoundResponse()` ne prend aucun argument, la réponse ne peut donc pas dépendre de la demande.
- **307 vers la connexion, sans paramètre `retour`.** Revenir après connexion sur une adresse qui télécharge laisserait l'utilisateur devant le formulaire, sans comprendre. Et 307 plutôt que 401 : le navigateur afficherait une page nue.
- **Le fichier est construit en entier avant de répondre** (`await`). Diffuser le PDF en flux irait plus vite pour un gros fichier, mais une erreur en cours de route livrerait un PDF tronqué avec un code 200. C'est la même tension que dans la fiche 14 : une fois les en-têtes partis, on ne change plus de code.
- **405 explicite** pour les autres méthodes, avec `Allow: GET, HEAD` et le même `Cache-Control`.
- **Le lien de téléchargement est un `<a>` natif**, pas un `next/link` : `Link` tenterait une navigation RSC (préchargement compris) vers une adresse qui ne rend pas de page.
- **Rien n'est écrit par un GET.** Un préchargement, un robot ou un antivirus qui suit le lien ne change aucun état.

## Questions d'entretien

**Route Handler ou Server Action ?**
Server Action pour une mutation déclenchée par l'interface : formulaire, amélioration progressive, revalidation. Route Handler pour une réponse qui n'est pas du HTML de l'application : fichier, flux, API pour un tiers, webhook. Un téléchargement est un GET : c'est un Route Handler.

**Comment forcer le téléchargement d'un fichier ?**
`Content-Disposition: attachment; filename="…"`. L'attribut `download` du lien fait de même côté navigateur, mais seulement pour une adresse de même origine, et le serveur garde la main sur le nom avec l'en-tête.

**Un Route Handler `GET` est-il mis en cache ?**
Pas par défaut dans les versions récentes de Next, et jamais s'il lit la requête (`cookies()`, `headers()`) ou a un segment dynamique. Pour un document personnel, on ajoute `Cache-Control: private, no-store` afin que ni le navigateur ni un intermédiaire ne le conserve.

**Comment gérer les erreurs dans un Route Handler ?**
À la main : pas de limite d'erreur au-dessus. On attrape, on journalise le type de l'erreur seulement (son message peut contenir du SQL et des valeurs), et on renvoie le code juste : 404 pour l'absence, 503 pour une dépendance indisponible, 500 pour l'imprévu.

**Faut-il diffuser un gros fichier en flux ?**
Oui si sa taille l'exige : on renvoie un `ReadableStream`, la mémoire reste bornée et le premier octet part tôt. En échange, une erreur tardive ne peut plus changer le code de réponse. Pour un PDF d'une page, construire puis répondre est plus simple et plus sûr.

**Pourquoi 404 et pas 403 pour la quittance d'un autre compte ?**
403 confirmerait que l'identifiant existe. Les identifiants étant privés, l'existence est déjà une information.
