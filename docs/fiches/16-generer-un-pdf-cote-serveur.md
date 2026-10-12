# Fiche 16 — Générer un PDF côté serveur

## Les trois familles de solutions

| Approche | Principe | Pour | Contre |
| --- | --- | --- | --- |
| Navigateur sans tête (Puppeteer, Playwright) | on rend une page HTML, on l'imprime en PDF | on réutilise son HTML et son CSS | un Chromium à embarquer (lourd, lent à démarrer, mal adapté au serverless) |
| Bibliothèque de dessin (`pdf-lib`, `pdfkit`) | on place texte et traits à des coordonnées | léger, contrôle total | on calcule soi-même les retours à la ligne et la mise en page |
| Moteur de mise en page (`@react-pdf/renderer`) | des composants React (`Document`, `Page`, `View`, `Text`) et un sous-ensemble de flexbox | déclaratif, léger, pas de navigateur | ce n'est ni le DOM ni le CSS : pas de Tailwind, ses propres règles de césure |

Le projet utilise `@react-pdf/renderer`. Ses composants ne sont pas des éléments HTML : c'est React employé comme langage de description, avec un autre moteur de rendu. Même idée que React Native.

`window.print()` dans le navigateur aurait suffi pour un téléchargement, mais pas pour la suite : la quittance partira en pièce jointe d'un e-mail, sans navigateur.

## Séparer le contenu de la mise en page

```
ReceiptSnapshot  →  buildReceiptContent()  →  <ReceiptDocument />  →  renderToBuffer()
(valeurs figées)    (fonction pure : textes)   (mise en page)          (octets)
```

- `buildReceiptContent` décide **quoi écrire** : formats de dates et de montants, phrases, accords. Fonction pure, testée en Vitest sans produire de fichier.
- `ReceiptDocument` décide **où l'écrire**.
- Les tests du fichier lui-même relisent le PDF (`unpdf`) pour en extraire le texte, le nombre de pages et les métadonnées. Ils tournent en `// @vitest-environment node` : la bibliothèque n'a rien à faire d'un DOM simulé.

## Les polices

Un PDF doit **incorporer** ses polices, sinon le lecteur en substitue une autre. Les fichiers TTF (sous licence SIL OFL) sont dans le dépôt et enregistrés auprès de la bibliothèque. Seuls les glyphes utilisés sont incorporés.

Conséquence : un caractère absent de la police s'afficherait comme un carré vide. La règle « texte affichable » refuse donc à la saisie ce que la police ne sait pas dessiner (émojis, alphabets non couverts), et le recontrôle au moment de produire.

## Tenir sur une page

Une quittance de deux pages n'est plus une quittance. Avec des noms et des adresses aux longueurs maximales :

1. on coupe les mots trop longs pour une ligne, en mesurant chaque caractère dans le fichier de police (`advanceWidth / unitsPerEm × corps`) ;
2. on rend le document, on compte ses pages ;
3. s'il y en a plus d'une, on recommence un cran plus petit (1, puis 0,92, 0,84…) ;
4. au plancher de lisibilité, on lève une erreur plutôt que de livrer un document faux.

Rendre plusieurs fois coûte du temps de calcul : acceptable pour un document d'une page, produit à la demande.

## Un fichier reproductible

- **Les valeurs sont figées à la production.** La quittance enregistre le nom du bailleur, l'adresse, les montants tels qu'ils étaient. Si le propriétaire déménage ou corrige le loyer ensuite, la quittance de mars dit toujours ce qu'elle disait en mars. C'est un document, pas une vue sur des données vivantes.
- **Le fichier n'est pas stocké** : il est reconstruit à chaque téléchargement à partir de ces valeurs. Pas de stockage d'objets à gérer, à sécuriser, à purger.
- **L'horloge n'est jamais lue pendant le rendu.** La date de création inscrite dans le fichier est l'instant de production enregistré. Deux téléchargements donnent le même document.

Limite : changer la mise en page change l'apparence des anciennes quittances. Pour une valeur probante stricte, on stockerait les octets et leur empreinte.

## Sur le serveur seulement

`import "server-only"` : la bibliothèque et les polices pèsent plusieurs centaines de kilo-octets et ne doivent jamais entrer dans le JavaScript du navigateur. Le rendu occupe le processeur : sur un serveur Node, il bloque la boucle d'événements le temps du calcul. Pour des documents lourds ou nombreux, on passerait par une file de tâches.

## Questions d'entretien

**Comment générer un PDF dans une application Next ?**
Trois voies : imprimer une page avec un navigateur sans tête, dessiner avec une bibliothèque bas niveau, ou décrire le document avec un moteur de mise en page. Je choisis selon la fidélité attendue au HTML existant, le poids acceptable et l'hébergement : un Chromium tient mal dans une fonction serverless.

**Stocker le fichier ou le régénérer ?**
Régénérer si le document se déduit entièrement de données figées et qu'il est léger : rien à stocker. Stocker si le document doit rester identique à l'octet près pendant des années, ou s'il est coûteux à produire.

**Pourquoi figer les données dans la quittance plutôt que de lire la location ?**
Un document émis atteste d'un état passé. Le lier aux données courantes le ferait changer rétroactivement. On copie les valeurs au moment de l'émission : c'est le même raisonnement que pour une facture.

**Comment tester un PDF ?**
Le contenu par des tests de la fonction pure qui produit les textes. Le fichier par relecture : extraction du texte, nombre de pages, métadonnées. L'apparence à l'œil, sur une image de la page, aux longueurs maximales. Comparer des octets est fragile : un identifiant ou une date interne suffit à les faire varier.

**Que se passe-t-il si un caractère n'existe pas dans la police ?**
Il est remplacé par un glyphe vide. Soit on incorpore des polices de repli couvrant plus d'écritures, soit on restreint la saisie à ce que la police couvre et on le dit à l'utilisateur.

**Composants `@react-pdf` : est-ce du React « normal » ?**
C'est le même modèle de composants avec un autre moteur de rendu. Pas de DOM, pas d'événements, pas de CSS global ; un sous-ensemble de flexbox. Les hooks d'état n'y ont pas de sens : le rendu est une seule passe.
