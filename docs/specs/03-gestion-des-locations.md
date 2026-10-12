# 03 — Gestion des locations

Statut : validée par l'utilisateur le 2026-10-11. Questions tranchées : Q1, Q2, Q3, Q4, Q5, Q8 et Q9 selon les hypothèses recommandées ; Q7 validée (quatre tokens, bouton destructif en `error-text`, confirmation par une page ; `DESIGN.md` mis à jour par l'orchestrateur) ; Q12, **option légère retenue** : ni clé de soumission ni numéro de version (R25, R26). Q6, Q10, Q11, Q13 et Q14 restent telles que recommandées, non bloquantes. Le découpage compte six tâches, les anciennes T6, T7 et T8 étant fusionnées. Les références supprimées (L26, L27, CA6, CA7, CA33) laissent des trous : rien n'a été renuméroté.

**Décision d'architecture du 2026-10-11, après T5** : `cacheComponents` (et `partialPrefetching`) sont retirés de `next.config.ts`, parce que l'utilisateur veut les bons codes HTTP. Sous ce réglage, une page qui lit la session était reprise d'une coque vide : `notFound()` et `redirect()` répondaient 200, et un formulaire refusé revenait vide sans JavaScript. Conséquences pour ce document : « Location introuvable » répond **404** (Q13 tranchée), les redirections des pages sont de vraies redirections HTTP, les erreurs de formulaire se réaffichent sans JavaScript (R34, CA24, CA40 tiennent tels qu'écrits), et les routes protégées sont rendues à chaque requête (`ƒ`). Seule précision : un champ de date du navigateur ne peut pas réafficher une date invalide ; après L20, il revient vide, le message restant affiché (CA24). **Écran « Location introuvable » sans JavaScript (décision du 2026-10-11)** : la réponse est 404 dans tous les cas, mais Next renvoie pour `notFound()` un document dont le contenu est posé par le script ; sans JavaScript, cet écran est vide. C'est accepté : la seule autre voie ferait lire la location par le proxy, ce que R2 de la spécification 02 exclut. L'exigence de fonctionnement sans JavaScript (R30) vaut pour les formulaires, les redirections et les pages, pas pour cet écran d'erreur. **Adresse à l'encodage illisible** (`/locations/%`, `%zz`, `%C0%AF`) : elle répond **400**, corps vide, et non l'écran « Location introuvable » ; c'est le code exact pour une requête mal formée, et aucun identifiant réel ne peut avoir cette forme (précision à R5). **Précisions après T6** : (1) dans CA24 et CA36, « la valeur saisie est conservée » ne vaut pas pour une date inexistante comme `2026-02-30` (L20) : le champ revient vide ; une date réelle hors bornes (L21) est conservée. (2) L'identifiant de la location atteint chaque action par un argument lié sur le serveur (`bind`) ; Next ne le chiffre ni ne le signe, il est visible et modifiable dans le navigateur : il ne vaut pas autorisation, la protection est le filtre sur le propriétaire de R4 et R8 (CA34). (3) Quand une action répond « introuvable » à un envoi fait sans JavaScript, la réponse est bien 404 mais l'écran est la page 404 générale du site, pas « Location introuvable » ; accepté. (4) Page 404 générale du site : en français, lien vers l'accueil, code 404 ; ses textes, validés par l'utilisateur le 2026-10-12 : titre du document `Page introuvable — Quittances`, `h1` `Page introuvable`, phrase `Cette page n'existe pas ou a été déplacée.`, lien `Retour à l'accueil` vers `/`.

Références : `CLAUDE.md` (produit), `DESIGN.md` (design system), `docs/AVANCEMENT.md` (décisions), `docs/specs/02-inscription-et-connexion.md` (compte, session, isolation, formulaires, dont cette spécification modifie une partie, voir « Effet sur la spécification 02 »), `docs/fiches/08` à `12`.

Décisions de l'utilisateur, non rediscutées ici : Postgres chez Neon avec Drizzle ; Better Auth, session en base ; `getCurrentOwner()` est le seul moyen d'obtenir le propriétaire courant ; toute route interne passe par `next/link` ; validation sur le serveur à la soumission ; formulaires utilisables sans JavaScript ; thème clair, textes en français ; aucun envoi d'e-mail.

Les numéros R et CA de ce document lui sont propres. Une règle d'un autre document est toujours citée sous la forme « R2 de la spécification 02 ».

## Objectif

Un propriétaire connecté enregistre ses locations : le logement, le locataire et son adresse e-mail, le loyer et les charges, le jour d'échéance, le début du bail. Il les retrouve sur son tableau de bord, les consulte, les corrige, y met fin quand le locataire part et supprime celles créées par erreur. C'est la première donnée qui appartient à un propriétaire : cette fonctionnalité applique pour la première fois, opération par opération, la règle d'isolation entre comptes. Elle n'envoie rien et ne calcule aucune échéance : elle prépare ce dont les échéances et les quittances auront besoin.

## Périmètre

### Inclus

1. **Données** : schéma et migration des locations, fonctions d'accès aux données qui exigent toutes le propriétaire courant.
2. **Règles pures** : saisie et affichage des montants, jour d'échéance, dates du bail, statut « en cours » ou « terminée », normalisation des textes.
3. **Tableau de bord** : `/tableau-de-bord` affiche la liste des locations du propriétaire et son état vide avec appel à l'action.
4. **Création, détail, modification** d'une location.
5. **Fin de location** (date de fin, modifiable, réversible) et **suppression définitive** après confirmation.
6. **Composants du design system** : liste, chip de statut, bouton destructif, page de confirmation, champs numérique et date, tokens de texte pour `success` et `warning`.

### Exclu

- Tout envoi d'e-mail, toute quittance, tout avis d'échéance, toute relance.
- **Calcul d'une échéance** (prochaine échéance, échéances passées, loyers reçus ou impayés) : reporté à la spécification suivante. Seule la règle des mois courts est arrêtée ici (R18).
- Identité du bailleur (nom, adresse) : elle appartient au compte, pas à la location, et sera demandée par la spécification des quittances (Q10).
- Plusieurs locataires par location, garant, téléphone ou adresse postale du locataire (R2).
- Fiche « bien » réutilisable d'une location à l'autre, libellé du bien, type, surface, meublé ou non (R3).
- Nature des charges (provision ou forfait), dépôt de garantie, révision du loyer, historique des montants, prorata du premier ou du dernier mois.
- Notes libres, pièces jointes, import, export, duplication d'une location.
- Recherche, tri, filtres et pagination de la liste (R37).
- Navigation applicative complète (liens, tiroir mobile, menu du compte) : l'en-tête reste celui de la spécification 02.
- Message de confirmation après une action (« Location ajoutée ») : la page d'arrivée tient lieu de confirmation (R29).
- Sécurité au niveau des lignes dans Postgres (RLS) comme seconde barrière : à étudier plus tard, l'isolation repose ici sur R4 et R8.
- Limitation du nombre de requêtes (déjà reportée par R20 de la spécification 02).
- Adresses hors de France (R12, Q3).

## Règles métier

### Modèle et isolation

**R1 — Données d'une location.** Chaque information est justifiée par un usage certain dans cette version ou la suivante.

| Information | Obligatoire | Format et bornes | Modifiable | Usage |
| --- | --- | --- | --- | --- |
| Identifiant | oui | R6, généré par le système | non, jamais | adresse des pages |
| Propriétaire | oui | identifiant interne du compte (R1 de la spécification 02), tiré de la session | non, jamais | isolation (R4) |
| Adresse du logement | oui | texte, 1 à 200 caractères (R11) | oui | liste, détail, future quittance |
| Complément d'adresse | non | texte, 0 à 100 caractères (R11) ; absent si vide | oui | distinguer deux logements à la même adresse |
| Code postal | oui | 5 chiffres (R12) | oui | liste, détail, future quittance |
| Ville | oui | texte, 1 à 100 caractères (R11) | oui | liste, détail, future quittance |
| Nom du locataire | oui | texte, 1 à 100 caractères (R11) | oui | liste, détail, future quittance et relance |
| Adresse e-mail du locataire | oui | R13 | oui | détail ; destinataire des futurs e-mails |
| Loyer hors charges | oui | centimes entiers, de 1 à 9 999 999 (R14) | oui | liste (total), détail, future quittance |
| Charges | oui | centimes entiers, de 0 à 9 999 999 (R14) | oui | idem ; une quittance distingue le loyer et les charges |
| Jour d'échéance | oui | entier de 1 à 31 (R17) | oui | détail, liste ; futur e-mail du jour J |
| Date de début du bail | oui | date de calendrier (R19) | oui | détail ; première échéance à demander |
| Date de fin du bail | non | date de calendrier, jamais avant la date de début (R21) ; absente à la création | oui, par la page dédiée | statut (R20) |
| Dates de création et de dernière modification | oui | instant, renseignées par le système | par le système | ordre de la liste |

Le total charges comprises n'est jamais enregistré : il est calculé (R14). Aucune autre information n'est demandée. Les tables et colonnes sont du ressort du développeur.

**R2 — Un seul locataire par location.** Une location a un nom de locataire (un seul champ de texte) et une adresse e-mail. Pour un couple ou une colocation à bail unique, le propriétaire peut écrire les noms dans ce champ (`Marie Durand et Paul Martin`) et choisit une seule adresse e-mail. Une colocation à baux individuels se saisit comme plusieurs locations à la même adresse (R3). Ce que cela ferme : pas de quittance ni de relance par colocataire, pas de second destinataire ; passer plus tard à plusieurs locataires demandera une migration, et un nom saisi librement ne pourra pas être découpé automatiquement (Q2).

**R3 — Pas d'entité « bien », aucune unicité.** Le logement n'existe que comme adresse d'une location. Aucune contrainte d'unicité ne porte sur l'adresse, le nom ou l'adresse e-mail du locataire : un même logement peut porter des locations successives (une nouvelle location par nouveau locataire) ou simultanées (baux individuels, logement et parking), et un même locataire peut figurer dans plusieurs locations, chez un ou plusieurs propriétaires. L'adresse e-mail du locataire peut être celle d'un compte propriétaire, y compris celle du propriétaire lui-même : rien n'est vérifié ni révélé à ce sujet. Ce que cela ferme : pas d'historique par logement ; l'adresse est ressaisie à chaque nouvelle location.

**R4 — Isolation : application de R2 de la spécification 02, point par point.**

1. Toute location appartient à exactement un compte, fixé à la création et jamais modifié. Une location ne peut pas exister sans son compte : si le compte disparaît de la base, ses locations disparaissent avec lui.
2. Le propriétaire d'une lecture ou d'une écriture vient uniquement de `getCurrentOwner()`. Aucune adresse, aucun paramètre, aucun champ de formulaire, aucun corps de requête ne désigne le propriétaire ; un champ de ce genre présent dans une requête est ignoré (R7).
3. Chaque page et chaque action de cette spécification vérifie elle-même la session, même si le proxy a déjà redirigé (R28).
4. Opération par opération :

| Opération | Ce qui est garanti |
| --- | --- |
| Liste | ne contient que les locations du propriétaire courant ; le nombre affiché ou déductible ne compte que les siennes |
| Détail | la location d'un autre compte donne exactement la réponse d'une location inexistante (R5) |
| Création | la location créée appartient au propriétaire courant, quel que soit le contenu de la requête |
| Modification, fin, réouverture | n'écrivent que si la location appartient au propriétaire courant ; sinon rien n'est écrit et la réponse est celle de R5 |
| Suppression | idem ; la location d'un autre compte n'est jamais supprimée |

5. Aucune donnée de location n'est conservée dans un cache partagé entre requêtes ou entre comptes (R30).

**R5 — « Pas à moi » et « n'existe pas » sont indiscernables.** Pour un propriétaire connecté, demander une location d'un autre compte, une location supprimée, un identifiant bien formé mais inconnu ou un identifiant mal formé donne la même réponse : l'écran « Location introuvable » (voir « Contenus »), le même code HTTP 404 pour une page demandée en GET, le même contenu. Justification : toute différence (code, texte, redirection, message de validation) confirmerait qu'un identifiant existe chez quelqu'un d'autre, ce qui ouvre la voie à l'énumération et contredit le point 4 de R2 de la spécification 02. La règle vaut pour les quatre pages portant un identifiant (R27) et pour les actions de modification, de fin, de réouverture et de suppression. La recherche d'une location se fait toujours en une seule lecture filtrée à la fois sur l'identifiant et sur le propriétaire : il n'existe aucune lecture par identifiant seul. L'écart de temps de réponse entre les cas n'est pas mesuré dans cette version.

**R6 — Identifiants.** L'identifiant d'une location est un UUID entièrement aléatoire (version 4), généré par le système, sans compteur ni horodatage : il ne révèle ni le nombre de locations, ni leur ordre, ni leur date de création, et ne se devine pas à partir d'un autre. Sa seule forme acceptée dans une adresse ou une requête est la forme canonique : 36 caractères, chiffres hexadécimaux en minuscules, tirets aux positions habituelles. Toute autre forme est un identifiant mal formé (R5) et ne déclenche aucune lecture en base : majuscules, accolades, sans tirets, espaces, encodages, `1`, chaîne vide, chaîne de 10 000 caractères, `../`, apostrophe ou tout texte destiné à une injection. Il n'y a pas de redirection vers la forme canonique : une location n'a qu'une adresse. **Cela ne remplace pas le contrôle d'accès** : un identifiant fuit (historique du navigateur, capture d'écran, lien partagé, journal, en-tête `Referer`) ; « difficile à deviner » n'est pas « autorisé ». R4 et R5 s'appliquent comme si les identifiants étaient publics.

**R7 — Ordre des contrôles d'une action et champs inattendus.** Toute action de formulaire contrôle, dans cet ordre : (1) la session, sinon redirection vers `/connexion` sans paramètre `retour`, rien n'est écrit ; (2) pour les actions portant sur une location existante, la forme de l'identifiant puis l'appartenance au propriétaire courant, sinon R5 ; (3) la validation des champs ; (4) l'écriture, elle-même filtrée sur le propriétaire. Une requête qui vise la location d'un autre compte avec des champs invalides reçoit donc R5, jamais des messages de validation. Une action ne lit que les champs qu'elle attend : tout autre champ est ignoré (identifiant de propriétaire, identifiant de location à la création, date de fin dans le formulaire de création ou de modification, dates système). L'état précédent renvoyé par le navigateur n'est jamais une source de vérité.

**R8 — Accès aux données (contrat de la tâche T1).** Toutes les lectures et écritures de locations passent par un seul ensemble de fonctions : créer, lister, lire une location, modifier, fixer la date de fin, rouvrir, supprimer. Chacune reçoit le propriétaire courant en premier argument, obligatoire ; appelée sans propriétaire ou avec un identifiant de propriétaire vide, elle échoue avant toute requête. Chacune filtre sur ce propriétaire. Aucune fonction ne lit ou n'écrit une location sans propriétaire, et aucun autre code applicatif n'interroge directement les locations. Les fonctions qui visent une location renvoient un résultat « introuvable » identique pour une location inexistante et pour la location d'un autre compte. La base refuse elle-même les valeurs hors des bornes de R1 (loyer nul ou négatif, charges négatives, jour hors de 1 à 31, date de fin antérieure au début, adresse e-mail non normalisée, location sans propriétaire), au cas où un chemin de code oublierait une règle.

**R9 — Limite par compte.** Un compte a au plus 100 locations, en cours et terminées confondues ; les locations supprimées ne comptent pas. La limite est contrôlée à la création : la 101e est refusée avec le message L28 et rien n'est créé. Elle n'est pas une barrière de sécurité : deux créations simultanées à 99 peuvent en laisser passer une de trop, ce qui est accepté. Elle sert à garantir que la liste tient sur une page (R37).

### Validation

**R10 — Où et quand.** Comme R9 de la spécification 02 : validation sur le serveur à la soumission, qui seule fait foi ; pas de validation pendant la frappe ; jamais de bulle native du navigateur. Les règles R11 à R21 doivent pouvoir être vérifiées par des tests sans base ni navigateur. Tous les champs sont validés ensemble : plusieurs peuvent être en erreur à la fois, chacun avec un seul message, le premier applicable dans l'ordre de la table des messages. Une valeur brute de plus de 500 caractères est refusée sans être analysée, avec le message de longueur du champ s'il en a un et son message de format sinon, et le champ est réaffiché vide.

**R11 — Champs de texte** (adresse, complément, ville, nom du locataire). Dans cet ordre : normalisation Unicode NFC ; toute suite d'espaces, quel qu'en soit le type (espace, tabulation, saut de ligne, espace insécable), devient une seule espace ordinaire ; les espaces de début et de fin sont retirées. Si la valeur contient ensuite un caractère de contrôle (catégorie Unicode Cc, dont le caractère nul) ou un caractère de direction du texte (U+202A à U+202E, U+2066 à U+2069), elle est refusée (L25). La longueur se compte en caractères Unicode (points de code) après normalisation. Une valeur vide après normalisation est « vide ». C'est la valeur normalisée qui est enregistrée et affichée. Tout autre caractère est accepté, y compris `<`, `>`, `&`, les guillemets et les emojis : une valeur est toujours affichée comme du texte, jamais interprétée comme du HTML.

Exemples : `  12  rue   des Lilas ` donne `12 rue des Lilas` ; `Marie\tDurand` donne `Marie Durand` ; une adresse de 200 caractères est acceptée, de 201 refusée (L2) ; trois espaces donnent « vide ».

**R12 — Code postal.** Toutes les espaces sont retirées, puis la valeur doit être faite d'exactement 5 chiffres ASCII. Acceptés : `75011`, ` 75011 `, `75 011` (enregistrés `75011`), `01000`, `97400`. Refusés (L5) : `7501`, `750111`, `7501A`, `75-011`, `７５０１１` (chiffres pleine largeur). L'existence du code n'est pas vérifiée. Seules des adresses françaises sont donc saisissables (Q3).

**R13 — Adresse e-mail du locataire.** Normalisation de R4 de la spécification 02 (espaces de début et de fin retirées, minuscules, rien d'autre), puis format de R5 de la spécification 02 (254 caractères au plus, un seul `@`, au moins un caractère avant, domaine avec au moins un point qui ne commence ni ne finit par un point, aucun espace), complété de sa précision : caractères ASCII imprimables seulement, pas deux points consécutifs. C'est la forme normalisée qui est enregistrée et affichée. L'adresse n'est pas vérifiée et rien ne lui est envoyé. Exemples : ` Paul.Martin+loyer@Exemple.FR ` est enregistrée `paul.martin+loyer@exemple.fr` ; `paul`, `paul@`, `@exemple.fr`, `paul@exemple`, `paul..martin@exemple.fr`, `pàul@exemple.fr`, `pa ul@exemple.fr` sont refusées (L11).

**R14 — Montants : stockage, bornes, total.** Un montant est enregistré en centimes entiers d'euro, jamais en nombre à virgule. Le loyer hors charges et les charges sont saisis ; le total charges comprises est leur somme, calculée à chaque affichage et jamais enregistrée. Loyer hors charges : de 0,01 € à 99 999,99 € (1 à 9 999 999 centimes) ; un loyer de zéro est refusé (L14). Charges : de 0 € à 99 999,99 € ; zéro est une valeur normale, qui doit être saisie explicitement (le champ vide est refusé, L16). **Il n'y a aucun arrondi** : une saisie de plus de deux décimales est refusée, pas arrondie, et le total est une somme d'entiers.

**R15 — Montants : saisie.** La valeur saisie est traitée ainsi : (1) les espaces de début et de fin sont retirées, quel qu'en soit le type ; (2) un seul symbole `€` final, précédé ou non d'espaces, est retiré ; (3) le reste doit avoir la forme : partie entière, puis éventuellement une virgule ou un point suivi d'un ou deux chiffres. La partie entière est soit une suite de chiffres ASCII sans zéro initial superflu (`0` seul est permis), soit un groupe d'un à trois chiffres suivi de groupes d'exactement trois chiffres séparés chacun par une seule espace (ordinaire U+0020, insécable U+00A0 ou fine insécable U+202F). Le point et la virgule ne sont jamais des séparateurs de milliers. Tout ce qui ne correspond pas est refusé avec L13 ; une forme correcte hors bornes donne L14 ou L15.

| Saisie | Résultat | Valeur enregistrée (centimes) |
| --- | --- | --- |
| `850` | acceptée | 85000 |
| `850,00` | acceptée | 85000 |
| `850.5` | acceptée | 85050 |
| `850,50 €` | acceptée | 85050 |
| `1250,5€` | acceptée | 125050 |
| `1 250,50` (espace ordinaire, insécable ou fine insécable) | acceptée | 125050 |
| ` 850 ` | acceptée | 85000 |
| `0,01` | acceptée | 1 |
| `99999,99` et `99 999,99 €` | acceptées | 9999999 |
| `0` et `0,00` | acceptées pour les charges (0) ; L14 pour le loyer | 0 |
| champ vide ou fait d'espaces | L12 (loyer) ou L16 (charges) | |
| `100000`, `100 000,00`, `1 000 000` | L15 | |
| `850,555`, `1.250`, `1,250` (trois décimales : jamais lu comme 1250 ni arrondi) | L13 | |
| `1.250,50`, `1,250.50`, `850,5,0` | L13 | |
| `850,`, `850.`, `,50`, `.5` | L13 | |
| `12 50`, `1  250` (deux espaces), `1250 000`, `1 2500` | L13 | |
| `-850`, `+850`, `1e3`, `0x10`, `0850`, `00` | L13 | |
| `€850`, `850 EUR`, `850 euros`, `850€€`, `huit cents` | L13 | |
| `８５０` (chiffres pleine largeur) | L13 | |

**R16 — Montants : affichage.** Partout hors des champs de saisie : format français, toujours deux décimales, virgule décimale, milliers groupés par trois et séparés par une espace fine insécable (U+202F), espace insécable (U+00A0) puis `€`. Exemples : 85000 donne `850,00 €` ; 125050 donne `1 250,50 €` ; 0 donne `0,00 €` ; 9999999 donne `99 999,99 €` ; total maximal 19999998, `199 999,98 €`. Un montant ne se coupe jamais sur deux lignes. Les critères comparent les montants après remplacement de toute espace par une espace ordinaire. Dans un champ de formulaire prérempli (modification), le montant apparaît sans séparateur de milliers ni symbole, avec virgule et deux décimales : `1250,50`, `0,00`. Cette forme est elle-même acceptée par R15 et redonne la même valeur. Les montants affichés utilisent des chiffres tabulaires (`DESIGN.md`).

**R17 — Jour d'échéance : saisie.** Après retrait des espaces de début et de fin, un ou deux chiffres ASCII formant un entier de 1 à 31. Acceptés : `1`, `5`, `05` (enregistré 5), `28`, `31`, ` 15 `. Refusés (L18) : `0`, `00`, `32`, `99`, `005`, `1,5`, `1.0`, `-1`, `+5`, `cinq`, `５`. La valeur saisie est enregistrée telle quelle : un jour 31 reste 31, quel que soit le mois en cours.

**R18 — Jour d'échéance et mois plus courts : règle arrêtée, calcul reporté.** Cette fonctionnalité **ne calcule et n'affiche aucune date d'échéance**, ni prochaine ni passée. Elle fixe la règle que la spécification des échéances devra appliquer : l'échéance d'un mois tombe le jour d'échéance de la location si ce jour existe dans le mois, sinon le dernier jour du mois. Exemples pour un jour 31 : 31/01/2027, 28/02/2027, 31/03/2027, 30/04/2027, 29/02/2028 (année bissextile). Pour un jour 30 : 28/02/2027, 29/02/2028, 30/04/2027. Pour un jour 29 : 28/02/2027, 29/02/2028. Ce que cette règle engage : le jour enregistré n'est jamais réécrit par un mois court (après février, un jour 31 redonne le 31 mars) ; chaque mois a exactement une échéance ; le fuseau de référence sera `Europe/Paris`. Ce qui reste à décider plus tard : ce qui se passe le jour même, avant et après l'échéance, et la première échéance par rapport à la date de début du bail. L'interface de cette version énonce la règle en toutes lettres (texte d'aide du champ, ligne « Jour d'échéance » du détail).

**R19 — Dates du bail : saisie, bornes, affichage.** Une date de bail est une date de calendrier, sans heure ni fuseau. Le serveur n'accepte que la forme `AAAA-MM-JJ` (celle qu'envoie un champ de date), dix caractères, désignant un jour qui existe. Bornes, incluses : du 1950-01-01 au 2099-12-31, pour la date de début comme pour la date de fin. Elles ne dépendent pas de l'horloge : une date de début future est permise (bail signé à l'avance).

| Saisie | Résultat |
| --- | --- |
| `2026-01-05`, `2028-02-29`, `2000-02-29`, `1950-01-01`, `2099-12-31` | acceptées |
| champ vide | L19 (début) ou L23 (fin) |
| `2027-02-29`, `2026-02-30`, `2026-04-31`, `2026-13-01`, `2026-00-10`, `2026-01-00` | L20 |
| `05/01/2026`, `2026-1-5`, `26-01-05`, `2026-01-05T00:00`, `20260105`, `demain` | L20 |
| `1949-12-31`, `2100-01-01`, `9999-12-31` | L21 |

Affichage hors des champs : `JJ/MM/AAAA` (`05/01/2026`). Une date ne passe jamais par une conversion de fuseau : `2026-01-01` s'affiche `01/01/2026` quel que soit le fuseau du serveur ou du navigateur.

**R20 — Statut d'une location.** Deux statuts, calculés et jamais enregistrés. Une location est **terminée** si elle a une date de fin strictement antérieure à la date du jour dans le fuseau `Europe/Paris` ; sinon elle est **en cours**. La date de fin est donc le dernier jour du bail, inclus : le jour même, la location est encore en cours ; elle devient terminée à minuit, heure de Paris, sans aucune action. Une location dont la date de fin est à venir est en cours, avec une fin prévue. Une location dont la date de début est à venir est aussi « en cours » : il n'y a pas de statut « à venir » (Q5). Le calcul ne dépend pas du fuseau du serveur.

| Date de fin | Instant (UTC) | Heure de Paris | Statut |
| --- | --- | --- | --- |
| aucune | n'importe lequel | | en cours |
| 31/10/2026 | 2026-10-31T22:59:59Z | 31/10 à 23:59:59 | en cours |
| 31/10/2026 | 2026-10-31T23:00:00Z | 01/11 à 00:00:00 | terminée |
| 30/06/2027 | 2027-06-30T21:59:59Z | 30/06 à 23:59:59 | en cours |
| 30/06/2027 | 2027-06-30T22:00:00Z (le 30 juin en UTC) | 01/07 à 00:00:00 | terminée |
| 31/12/2026 | 2026-12-31T23:30:00Z (le 31 décembre en UTC) | 01/01/2027 à 00:30 | terminée |
| 01/01/2027 | 2026-12-31T23:30:00Z | 01/01/2027 à 00:30 | en cours |
| 31/12/2099 | 2026-10-11T10:00:00Z | | en cours |

### Vie d'une location

**R21 — Mettre fin, modifier la fin, rouvrir.** Mettre fin à une location, c'est lui donner une date de fin : le dernier jour du bail. Elle peut être passée ou à venir, doit respecter R19 et ne peut pas être antérieure à la date de début (L24) ; égale à la date de début, elle est acceptée (bail d'un jour). Rien n'est supprimé : la location reste dans le compte, consultable et modifiable, et c'est elle qui conservera plus tard ses quittances. La date de fin se modifie par la même page. **Rouvrir** une location retire sa date de fin : elle redevient en cours, sans autre effet. Rouvrir est toujours permis et ne demande pas de confirmation, puisque l'opération se défait en remettant la date. Mettre fin tient donc lieu d'archivage.

**R22 — Modification.** Toutes les informations saisies à la création sont modifiables à tout moment, que la location soit en cours ou terminée, avec les mêmes règles. La date de fin ne se modifie pas par ce formulaire. Si la location a une date de fin, une date de début postérieure à elle est refusée (L22). Enregistrer sans rien changer réussit. Engagement pour la suite : une quittance émise devra conserver ses propres valeurs ; modifier une location ne devra jamais modifier un document déjà envoyé.

**R23 — Suppression.** Supprimer une location l'efface réellement et définitivement de la base, avec le nom et l'adresse e-mail du locataire : il n'y a ni corbeille ni marqueur « supprimée ». La suppression est faite pour les erreurs de saisie ; pour un locataire parti, le bon geste est de mettre fin à la location (R21), et la page de confirmation le dit. Dans cette version, toute location peut être supprimée, quel que soit son statut, puisque rien ne lui est encore attaché. Engagement pour la suite : la spécification qui attachera des quittances à une location devra redéfinir la suppression (la refuser quand des quittances existent, ou dire explicitement ce qu'elles deviennent) ; rien ne doit alors disparaître en cascade sans qu'une règle l'ait décidé (Q4).

**R24 — Confirmation avant suppression.** La suppression passe par une page de confirmation dédiée (R27), et non par une boîte de dialogue : elle fonctionne à l'identique avec et sans JavaScript. La page nomme ce qui va être supprimé (adresse, code postal et ville, nom du locataire). La suppression n'a lieu que par l'envoi en POST du formulaire de cette page. Aucune requête GET ne supprime, ne met fin ni ne rouvre : afficher ou précharger une page ne modifie jamais rien.

**R25 — Double soumission à la création.** Avec JavaScript, le bouton d'envoi est indisponible pendant l'attente (R34, comme R28 de la spécification 02) : deux activations rapides ne créent qu'une location. Aucun autre mécanisme n'empêche un doublon. **Limite acceptée** : faute d'unicité (R3), deux envois du même formulaire sans JavaScript (double activation, retour arrière puis nouvel envoi), ou une requête d'envoi rejouée, créent deux locations identiques ; le propriétaire supprime celle qui est en trop (R23).

**R26 — Modifications concurrentes.** Le dernier enregistrement l'emporte : aucun contrôle ne compare ce qu'un formulaire affichait à son ouverture avec l'état enregistré. **Limite acceptée** : si la même location est ouverte dans deux onglets, l'enregistrement fait depuis celui qui a été ouvert le premier remplace sans avertissement toutes les valeurs de son formulaire, y compris celles que l'autre onglet venait de modifier. Un compte n'ayant qu'un utilisateur, ce cas est jugé rare. Le formulaire de modification ne touche jamais la date de fin, et celui de la date de fin ne touche qu'elle (R22). Une location supprimée entre-temps donne l'écran « Location introuvable » (R5).

### Routes, protection et redirections

**R27 — Routes.** `<id>` est un identifiant de R6.

| Route | Contenu pour le propriétaire connecté | Visiteur non connecté |
| --- | --- | --- |
| `/tableau-de-bord` | liste des locations ou état vide (R35) | `/connexion?retour=…` (inchangé) |
| `/locations` | redirection vers `/tableau-de-bord` | `/connexion?retour=%2Flocations` |
| `/locations/nouvelle` | formulaire de création | `/connexion?retour=%2Flocations%2Fnouvelle` |
| `/locations/<id>` | détail | `/connexion?retour=%2Flocations%2F<id>` |
| `/locations/<id>/modifier` | formulaire de modification | idem, avec le chemin demandé |
| `/locations/<id>/fin` | date de fin et réouverture | idem |
| `/locations/<id>/supprimer` | confirmation de suppression | idem |

Les routes publiques de la spécification 02 ne changent pas. Toute autre adresse sous `/locations/` affiche l'écran « Location introuvable » à un propriétaire connecté.

**R28 — Protection.** Toutes les adresses sous `/locations` sont protégées comme `/tableau-de-bord` (R23 de la spécification 02) : un visiteur non connecté est redirigé vers `/connexion?retour=<chemin et paramètres demandés, encodés>`, que l'adresse existe ou non, avec ou sans JavaScript, et ne reçoit aucun contenu protégé : ni titre de page, ni libellé de champ, ni donnée de location, ni l'écran « Location introuvable ». La session est toujours contrôlée avant l'identifiant : un visiteur non connecté ne peut rien apprendre sur un identifiant. Après connexion, il arrive sur la page demandée (R14 de la spécification 02, déjà en place) ; si la location n'est pas la sienne, il y trouve l'écran de R5. La session est prolongée par la navigation sur ces pages comme sur `/tableau-de-bord` (R16 de la spécification 02).

**R29 — Redirections après une action et cas « déjà là ».**

| Action réussie | Arrivée |
| --- | --- |
| Création | `/locations/<id>` de la location créée |
| Modification | `/locations/<id>` |
| Date de fin enregistrée | `/locations/<id>` |
| Réouverture | `/locations/<id>` |
| Suppression | `/tableau-de-bord` |

La page d'arrivée tient lieu de confirmation : elle s'affiche en haut, avec son titre de document, et montre le nouvel état. Les destinations sont fixes : rien de ce qu'envoie le navigateur ne les choisit, hormis l'identifiant déjà contrôlé. Après un envoi réussi, recharger la page d'arrivée ou revenir en arrière ne renvoie pas le formulaire.

Cas « déjà là » :

- Aucune page ne contient de lien vers elle-même, à l'exception du logo sur `/tableau-de-bord` (R36 de la spécification 02, inchangé). Sur les autres pages, le logo mène à `/tableau-de-bord`.
- Renvoyer la création : avec JavaScript, le bouton indisponible l'empêche ; sans JavaScript, une seconde location est créée (R25). Enregistrer une modification sans changement, ou la même date de fin : réussite, même arrivée.
- Rouvrir une location qui n'a pas de date de fin : aucune erreur, arrivée sur le détail, rien ne change.
- Supprimer une location déjà supprimée (second envoi, autre onglet) : écran « Location introuvable » (R5), dont le texte couvre ce cas.
- Ouvrir `/locations/<id>/fin` pour une location qui a déjà une date de fin : le formulaire est prérempli avec elle.
- Une page restée ouverte sur une location supprimée ailleurs peut encore l'afficher ; toute action depuis cette page aboutit à l'écran « Location introuvable ».

**R30 — Rendu, cache et fraîcheur.** Toutes les routes de R27 sont rendues à chaque requête : dans `pnpm build`, chacune porte un autre symbole que `○`, tandis que `/`, `/connexion` et `/inscription` gardent `○`. Comme `/tableau-de-bord` (précision de R24 de la spécification 02), elles sont rendues d'un bloc sur le serveur et n'ont pas d'état de chargement : tout s'affiche sans JavaScript. Leurs réponses ne sont jamais mises en cache partagé (`Cache-Control` contenant `private` ou `no-store`). Après chaque action réussie, le tableau de bord et le détail montrent le nouvel état dès l'affichage suivant, y compris quand on y arrive par un lien `next/link`, sans rechargement manuel.

**R31 — Panne.** Si la base est injoignable ou ne répond pas dans le délai de la spécification 02, aucune page de R27 n'affiche de donnée : elles affichent l'écran « Service momentanément indisponible » de la spécification 02, avec « Réessayer ». Une liste qui n'a pas pu être lue n'est **jamais** rendue comme l'état vide « Aucune location pour l'instant », et une location illisible n'est jamais rendue comme « Location introuvable ». Une action qui échoue pour cette raison n'écrit rien et réaffiche son formulaire avec le message E8 de la spécification 02 et les valeurs saisies. Aucun message technique n'est montré.

### Formulaires

**R32 — Un formulaire, deux pages.** La création et la modification utilisent le même formulaire : mêmes champs, même ordre, mêmes textes d'aide, mêmes règles, mêmes messages. Seuls changent le titre de la page, le libellé du bouton d'envoi, la destination de « Annuler » et les valeurs de départ (vides à la création, enregistrées à la modification, dans les formes de R16 et R19). La date de fin a son propre formulaire (R21), la suppression le sien (R24).

**R33 — Champs.** Chaque champ a un libellé visible au-dessus de lui, relié au champ, et aucun texte d'exemple (`placeholder`). Les champs sont réunis en trois groupes nommés aux technologies d'assistance (groupe avec son nom). Tous sont déclarés obligatoires aux technologies d'assistance, sauf « Complément d'adresse ». Tous portent `autocomplete="off"` : ils décrivent un tiers et un logement loué, et le remplissage automatique y placerait l'identité du propriétaire lui-même.

| Groupe | Libellé | Type et clavier | Texte d'aide |
| --- | --- | --- | --- |
| `Le logement` | `Adresse` | texte | aucun |
| | `Complément d'adresse (facultatif)` | texte | `Bâtiment, étage, numéro d'appartement.` |
| | `Code postal` | texte, clavier numérique | aucun |
| | `Ville` | texte | aucun |
| `Le locataire` | `Nom du locataire` | texte | `Prénom et nom. Pour un couple ou une colocation à bail unique, indiquez tous les noms.` |
| | `Adresse e-mail du locataire` | `email`, sans majuscule automatique ni correction | `Aucun e-mail n'est envoyé au locataire pour l'instant.` |
| `Le loyer et le bail` | `Loyer hors charges` | texte, clavier décimal | `Montant mensuel en euros, par exemple 850 ou 850,50.` |
| | `Charges` | texte, clavier décimal | `Montant mensuel en euros. Saisissez 0 s'il n'y a pas de charges.` |
| | `Jour d'échéance` | texte, clavier numérique | `Un nombre de 1 à 31. Les mois plus courts, l'échéance tombe le dernier jour du mois.` |
| | `Date de début du bail` | date | aucun |

Les champs de montant et de jour ne sont pas des champs de type `number` : ils doivent accepter la virgule et n'afficher aucune bulle native. Ordre de tabulation : les dix champs dans l'ordre de la table, le bouton d'envoi, puis « Annuler ». À l'ouverture, aucun champ ne prend le focus.

**R34 — Erreurs, saisie conservée, focus, attente, sans JavaScript.** Les règles R25, R27, R28 et R29 de la spécification 02 s'appliquent telles quelles à tous les formulaires de cette spécification, avec ces précisions :

- Erreur de champ : sous le champ, avant son texte d'aide, reliée au champ (`aria-describedby`), champ marqué `aria-invalid="true"`, bordure `error`, texte `error-text`. Erreur de formulaire (L28, E8) : dans le message de formulaire, entre le titre de la page et le premier groupe, avec le rôle `alert`.
- Après une erreur, **toutes** les valeurs sont conservées telles que saisies (il n'y a pas de mot de passe), sauf le cas de R10.
- Focus, avec JavaScript : sur le premier champ en erreur dans l'ordre de R33, ou sur le message de formulaire.
- Attente, avec JavaScript : le bouton d'envoi affiche son libellé d'attente, est indisponible, réduit à 60 % d'opacité, de même taille ; deux activations rapides ne produisent qu'une demande aboutie.
- Sans JavaScript : création, modification, fin, réouverture et suppression aboutissent ; les erreurs s'affichent aux mêmes endroits avec les mêmes textes et les valeurs conservées. Seuls manquent le déplacement du focus et l'état d'attente.
- Tous les formulaires sont envoyés en POST. Aucune valeur saisie n'apparaît jamais dans une adresse.

### Liste

**R35 — Tableau de bord.** `/tableau-de-bord` garde son titre et la phrase « Connecté en tant que … » de la spécification 02, puis affiche :

- **Aucune location** : la carte d'état vide, avec un titre, une phrase et le bouton primaire `Ajouter une location`.
- **Au moins une location** : un titre `Locations en cours` accompagné du bouton primaire `Ajouter une location`, puis la liste des locations en cours ou, s'il n'y en a aucune, la phrase `Aucune location en cours.` ; puis, seulement s'il existe au moins une location terminée, un titre `Locations terminées` et leur liste.

Ordre : les locations en cours par date de création, la plus ancienne d'abord (une nouvelle location apparaît en fin de liste, une modification ne déplace rien) ; les locations terminées par date de fin, la plus récente d'abord, puis par date de création. Les deux listes sont des listes au sens sémantique. La page a toujours un seul bouton primaire.

**R36 — Contenu d'une ligne.** Chaque location affiche, dans cet ordre :

1. l'adresse, suivie d'une virgule et du complément s'il existe : c'est un lien vers le détail, seul lien de la ligne ;
2. le code postal et la ville (`69003 Lyon`) ;
3. le nom du locataire ;
4. `Échéance le N du mois`, N étant le jour d'échéance ;
5. le total charges comprises suivi de `charges comprises` (`900,50 € charges comprises`) ;
6. le chip de statut (R39) ;
7. si la location est en cours avec une date de fin : `Fin prévue le JJ/MM/AAAA` ; si elle est terminée : `Terminée le JJ/MM/AAAA`.

L'adresse e-mail du locataire ne figure pas dans la liste, ni dans le code source de la page (R43). Une valeur longue passe à la ligne sans créer de défilement horizontal.

**R37 — Pas de pagination.** La liste affiche toutes les locations du compte sur une seule page, 100 au plus (R9). Il n'y a ni pagination, ni recherche, ni tri, ni filtre : ils sont reportés au jour où la limite sera relevée.

### Design

**R38 — Couleurs de texte pour `success` et `warning` (réponse à Q5 de la spécification 01).** `success` (`#10B981`) ne donne que 2.54:1 sur `surface` et `warning` (`#F59E0B`) 2.15:1 : aucun des deux ne peut porter du texte (seuil de 4.5:1). Quatre tokens sont ajoutés, exposés comme les autres (R10 de la spécification 01) :

| Token | Valeur | Contraste | Usage |
| --- | --- | --- | --- |
| `success-text` | `#047857` | 5.48:1 sur `surface`, 5.25:1 sur `background`, 5.21:1 sur `success-surface` | texte d'un statut positif |
| `success-surface` | `#ECFDF5` | | fond teinté d'un chip positif |
| `warning-text` | `#B45309` | 5.02:1 sur `surface`, 4.81:1 sur `background`, 4.84:1 sur `warning-surface` | texte d'un statut d'attente ; aucun écran de cette spécification ne l'utilise |
| `warning-surface` | `#FFFBEB` | | fond teinté d'un chip d'attente ; non utilisé ici |

`success` et `warning` restent réservés aux éléments non textuels. `text-secondary` sur `border` ne donne que 4.36:1 : le chip gris n'utilise donc pas `border` comme fond. `DESIGN.md` doit être mis à jour (Q7).

**R39 — Chip de statut.** Forme pilule (rayon 9999px), marge intérieure 4px verticale et 12px horizontale, bordure 1px, texte `caption` (12px) graisse 500, sans icône, jamais cliquable.

| Statut | Libellé | Fond | Bordure | Texte | Contraste du texte |
| --- | --- | --- | --- | --- | --- |
| en cours | `En cours` | `success-surface` | `success-surface` | `success-text` | 5.21:1 |
| terminée | `Terminée` | `background` | `border` | `text-secondary` | 5.11:1 |

Le statut est toujours écrit en toutes lettres : la couleur ne le porte jamais seule. Dans la liste, il est en outre porté par le titre du groupe.

**R40 — Boutons et liens d'action.** En plus de R33 de la spécification 02 :

| Variante | Apparence | Utilisée pour |
| --- | --- | --- |
| Primaire, grande (44px) | celle de la spécification 02 | `Ajouter une location` du tableau de bord (lien) ; bouton d'envoi des formulaires de création, de modification et de date de fin, sur toute la largeur du formulaire |
| Secondaire, petite (32px) | celle de la spécification 02 | liens `Modifier`, `Mettre fin à la location` ou `Modifier la fin de la location` du détail ; bouton `Rouvrir la location` |
| Destructive, petite (32px) | fond transparent, bordure 1px `error`, texte 14px `error-text`, marge intérieure horizontale 12px ; au survol, bordure `error-text` | lien `Supprimer` du détail |
| Destructive, grande (44px) | mêmes couleurs, marge intérieure horizontale 24px, sur toute la largeur du formulaire | bouton `Supprimer définitivement` |

`Annuler` et `Retour au tableau de bord` sont des liens de texte : couleur `primary`, soulignés. Un élément qui mène à une autre page est un lien, un élément qui envoie un formulaire est un bouton, quelle que soit son apparence. La page de confirmation de suppression n'a pas de bouton primaire. Le focus visible de R37 de la spécification 02 s'applique à tous.

**R41 — Mise en page.** Toutes les pages sont dans le conteneur de 1280px, alignées à gauche, sans pied de page, titre `h1` en `title` (32px) à partir de 768px et `subtitle` (24px) en dessous, aucun défilement horizontal de 320px à 1920px.

- **Liste** : une carte (fond `surface`, bordure 1px `border`, rayon 12px, sans ombre) contenant les lignes séparées par un filet de 1px `border`, marge intérieure 12px verticale et 16px horizontale par ligne. À partir de 768px, une ligne place l'adresse, la ville et le locataire à gauche, le montant, l'échéance et le statut à droite, le montant aligné à droite. En dessous, les informations s'empilent sur toute la largeur. Léger changement de fond au survol d'une ligne ; pas d'ombre.
- **Formulaires, détail, confirmation, date de fin** : une colonne de 640px au plus. Champs de R32 de la spécification 02, sur toute la largeur de la colonne, un par ligne ; 16px entre deux champs, 32px entre deux groupes ; nom de groupe en 15px display 700. Le champ de date a la même bordure, le même rayon, le même fond et la même hauteur que les autres.
- **Détail** : chaque information est une paire libellé (`small`, `text-secondary`) et valeur (`text-primary`), dans une liste de description, regroupées sous les mêmes trois noms de groupe que le formulaire, plus un groupe pour les actions.

**R42 — En-tête.** Toutes les pages de R27 ont l'en-tête de `/tableau-de-bord` (R36 de la spécification 02) : logo vers `/tableau-de-bord`, nom accessible `Quittances, tableau de bord`, bouton `Se déconnecter`. L'écran « Location introuvable » garde cet en-tête complet ; l'écran de panne n'a que le logo. Chaque page a les repères `banner` et `main`, un seul `h1`, et aucun niveau de titre sauté.

### Données personnelles et tests

**R43 — Données du locataire.** La fonctionnalité enregistre le nom et l'adresse e-mail d'un tiers qui n'a pas de compte et n'est pas informé par l'application. Dès maintenant :

1. **Minimisation** : seuls le nom et l'adresse e-mail sont demandés. Ni téléphone, ni date de naissance, ni adresse autre que celle du logement, ni champ de notes libres.
2. **Affichage** : le nom apparaît dans la liste, le détail, le formulaire de modification et les pages de date de fin et de confirmation ; l'adresse e-mail seulement dans le détail et le formulaire de modification.
3. **Jamais dans une adresse** : aucune adresse de page, aucun paramètre, aucune valeur de `retour` ne contient une donnée de location ; seul l'identifiant y figure. **Jamais dans un titre de document** : les titres sont génériques (voir « Contenus »).
4. **Jamais dans un journal** : ni les valeurs saisies, ni les paramètres d'une requête SQL, ni un message d'erreur pouvant les contenir. Seul le type d'une erreur est journalisé, comme dans le code existant.
5. **Suppression réelle** (R23) : après suppression, le nom et l'adresse e-mail ne subsistent nulle part dans la base.
6. Après une déconnexion, aucune donnée de location ne subsiste dans le document (R18 de la spécification 02).
7. Rien n'est envoyé à l'adresse du locataire. Elle n'est pas vérifiée : la spécification qui enverra le premier e-mail devra traiter le fait qu'un propriétaire peut saisir l'adresse de n'importe qui.

Reporté avant toute ouverture au public : information du locataire, durée de conservation des locations terminées, exercice de ses droits, suppression du compte (Q11).

**R44 — Tests et base de données.** R40 de la spécification 02 s'applique, étendue ainsi :

1. Chaque test crée lui-même ses comptes (domaine `quittances.test`) et ses locations, avec des données fictives : adresses e-mail de locataire dans `quittances.test`, noms inventés. Aucun test ne dépend d'une location créée par un autre test, d'une base vide ni d'un nombre total de lignes : il ne vérifie que les locations de ses propres comptes.
2. Les locations d'un compte de test sont purgées avec lui.
3. **Chaque critère d'isolation utilise deux comptes distincts, A et B** : deux propriétaires pour un test d'intégration, deux contextes de navigateur pour un test dans le navigateur. Il vérifie à la fois ce que B obtient et que les données de A sont intactes.
4. Un test peut préparer des locations sans passer par l'interface (fonctions de R8 ou base de test), pour les seuls comptes `quittances.test`. La création par le formulaire reste couverte par ses propres critères.
5. Aucun test dans le navigateur ne dépend de l'heure : une location terminée s'obtient avec une date de fin passée. Les limites de R20 se vérifient sur la règle pure, avec un instant fourni.
6. `pnpm test` continue de réussir sans base joignable.

## Contenus

À reprendre mot pour mot, avec l'apostrophe droite (`'`). Les textes évitent deux-points, point-virgule, point d'interrogation et point d'exclamation. Dans les messages, les espaces sont des espaces ordinaires.

### Page `/tableau-de-bord`

- Titre du document, `h1`, phrase « Connecté en tant que » : inchangés (spécification 02).
- **État vide** (carte) : titre `h2` (15px display 700) `Aucune location pour l'instant` ; texte (`text-secondary`) `Ajoutez votre première location pour préparer vos quittances.` ; lien d'apparence bouton primaire `Ajouter une location` vers `/locations/nouvelle`. C'est le seul `h2` de la page.
- **Avec des locations** : titre `h2` `Locations en cours`, lien `Ajouter une location` ; phrase `Aucune location en cours.` si besoin ; titre `h2` `Locations terminées` si besoin. Lignes : R36.

### Formulaire de location (`/locations/nouvelle` et `/locations/<id>/modifier`)

| Élément | Création | Modification |
| --- | --- | --- |
| Titre du document | `Ajouter une location — Quittances` | `Modifier la location — Quittances` |
| Titre `h1` | `Ajouter une location` | `Modifier la location` |
| Bouton d'envoi | `Ajouter la location` ; en attente `Ajout en cours` | `Enregistrer les modifications` ; en attente `Enregistrement en cours` |
| Lien `Annuler` | vers `/tableau-de-bord` | vers `/locations/<id>` |

Groupes, libellés et textes d'aide : R33.

### Page `/locations/<id>` (détail)

- Titre du document : `Location — Quittances`
- Lien en haut de page : `Retour au tableau de bord`
- Titre `h1` : l'adresse du logement, suivie du chip de statut
- Groupe `Le logement` : `Adresse`, `Complément d'adresse` (ligne absente s'il n'y en a pas), `Code postal et ville` (`69003 Lyon`)
- Groupe `Le locataire` : `Nom`, `Adresse e-mail`
- Groupe `Le loyer et le bail` : `Loyer hors charges`, `Charges`, `Total charges comprises`, `Jour d'échéance`, `Date de début du bail`, `Date de fin du bail` (ligne absente s'il n'y en a pas)
- Valeur de « Jour d'échéance » : `Le N de chaque mois` pour N de 1 à 28 ; `Le N de chaque mois, ou le dernier jour du mois s'il est plus court` pour 29, 30 et 31
- Actions, dans cet ordre : lien `Modifier` ; lien `Mettre fin à la location` (sans date de fin) ou `Modifier la fin de la location` (avec date de fin), vers `/locations/<id>/fin` ; lien `Supprimer` vers `/locations/<id>/supprimer`

### Page `/locations/<id>/fin`

- Titre du document : `Fin de la location — Quittances`
- Titre `h1` : `Fin de la location`
- Rappel (`text-secondary`) : l'adresse, le code postal et la ville, le nom du locataire
- Introduction : `La location reste dans votre compte. Elle passe au statut Terminée le lendemain de la date de fin.`
- Champ : `Date de fin du bail` (date, obligatoire), texte d'aide `Dernier jour du bail. La date peut être à venir.` ; vide si la location n'a pas de date de fin, préremplie sinon
- Bouton d'envoi (primaire) : `Enregistrer la date de fin` ; en attente `Enregistrement en cours`
- Lien `Annuler` vers `/locations/<id>`
- Seulement si la location a une date de fin, un second formulaire : titre `h2` `Rouvrir la location`, texte `La date de fin est retirée et la location redevient En cours.`, bouton secondaire `Rouvrir la location` ; en attente `Réouverture en cours`

### Page `/locations/<id>/supprimer`

- Titre du document : `Supprimer la location — Quittances`
- Titre `h1` : `Supprimer cette location`
- Texte : `Vous allez supprimer définitivement la location suivante.`
- Rappel : l'adresse (et le complément), le code postal et la ville, le nom du locataire
- Texte (`text-secondary`) : `Cette action est irréversible. Pour conserver la location sans la supprimer, mettez-y fin.`
- Bouton destructif : `Supprimer définitivement` ; en attente `Suppression en cours`
- Lien `Annuler` vers `/locations/<id>`

### Écran « Location introuvable »

- Titre du document : `Location introuvable — Quittances`
- Titre `h1` : `Location introuvable`
- Texte (`text-secondary`) : `Cette location n'existe pas ou a été supprimée.`
- Lien : `Retour au tableau de bord`
- Rien d'autre : ni identifiant demandé, ni indication de la raison.

### Messages d'erreur

| Code | Emplacement | Condition | Texte |
| --- | --- | --- | --- |
| L1 | sous « Adresse » | vide | `Saisissez l'adresse du logement.` |
| L2 | sous « Adresse » | plus de 200 caractères | `L'adresse ne peut pas dépasser 200 caractères.` |
| L3 | sous « Complément d'adresse » | plus de 100 caractères | `Le complément d'adresse ne peut pas dépasser 100 caractères.` |
| L4 | sous « Code postal » | vide | `Saisissez le code postal.` |
| L5 | sous « Code postal » | autre chose que 5 chiffres (R12) | `Le code postal doit contenir 5 chiffres.` |
| L6 | sous « Ville » | vide | `Saisissez la ville.` |
| L7 | sous « Ville » | plus de 100 caractères | `La ville ne peut pas dépasser 100 caractères.` |
| L8 | sous « Nom du locataire » | vide | `Saisissez le nom du locataire.` |
| L9 | sous « Nom du locataire » | plus de 100 caractères | `Le nom du locataire ne peut pas dépasser 100 caractères.` |
| L10 | sous « Adresse e-mail du locataire » | vide | `Saisissez l'adresse e-mail du locataire.` |
| L11 | sous « Adresse e-mail du locataire » | format invalide (R13) | `Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.` |
| L12 | sous « Loyer hors charges » | vide | `Saisissez le loyer hors charges.` |
| L13 | sous le champ de montant concerné | forme refusée (R15) | `Saisissez un montant en euros, par exemple 850 ou 850,50.` |
| L14 | sous « Loyer hors charges » | zéro | `Le loyer hors charges doit être supérieur à zéro.` |
| L15 | sous le champ de montant concerné | plus de 99 999,99 € | `Le montant ne peut pas dépasser 99 999,99 euros.` |
| L16 | sous « Charges » | vide | `Saisissez le montant des charges, ou 0 s'il n'y en a pas.` |
| L17 | sous « Jour d'échéance » | vide | `Saisissez le jour d'échéance.` |
| L18 | sous « Jour d'échéance » | autre chose qu'un entier de 1 à 31 (R17) | `Le jour d'échéance doit être un nombre entier de 1 à 31.` |
| L19 | sous « Date de début du bail » | vide | `Saisissez la date de début du bail.` |
| L20 | sous le champ de date concerné | forme ou jour inexistant (R19) | `Saisissez une date valide.` |
| L21 | sous le champ de date concerné | hors bornes (R19) | `La date doit être comprise entre le 1er janvier 1950 et le 31 décembre 2099.` |
| L22 | sous « Date de début du bail » | postérieure à la date de fin existante (R22) | `La date de début ne peut pas être postérieure à la date de fin du bail.` |
| L23 | sous « Date de fin du bail » | vide | `Saisissez la date de fin du bail.` |
| L24 | sous « Date de fin du bail » | antérieure à la date de début (R21) | `La date de fin ne peut pas être antérieure à la date de début du bail.` |
| L25 | sous le champ de texte concerné | caractère refusé (R11) | `Ce champ contient des caractères non autorisés.` |
| L28 | message de formulaire | limite de R9 atteinte | `Vous avez atteint la limite de 100 locations. Supprimez-en une pour en ajouter une autre.` |
| E8 | message de formulaire | panne (R31) | texte de la spécification 02 |

Ordre pour un même champ : vide, puis caractère refusé (L25), puis longueur ou format, puis bornes, puis cohérence entre dates (L22, L24). L28 n'est contrôlé que si tous les champs sont valides. L26 et L27 : supprimés (option légère de Q12), leurs numéros ne sont pas réattribués.

## Parcours utilisateur

### 1. Première location

1. Le propriétaire se connecte et arrive sur `/tableau-de-bord`. **État vide** : carte « Aucune location pour l'instant » et bouton « Ajouter une location ».
2. Il active le bouton : `/locations/nouvelle` s'affiche sans rechargement du document, champs vides, aucun message, aucun champ focalisé.
3. Il remplit les dix champs et active « Ajouter la location ». **Attente** : « Ajout en cours », bouton indisponible.
4. **Succès** : il arrive sur `/locations/<id>`, qui affiche les valeurs normalisées, les montants au format français, le total calculé et le chip « En cours ».
5. **Erreurs de validation** : il reste sur le formulaire ; chaque message est sous son champ, toutes les valeurs sont conservées, le focus est sur le premier champ en erreur.
6. **Panne** : E8 au-dessus des champs, valeurs conservées, rien n'est créé.
7. « Retour au tableau de bord » : la location apparaît dans « Locations en cours ».
8. « Annuler » depuis le formulaire : retour au tableau de bord, rien n'est créé.

### 2. Consulter et corriger

1. Depuis la liste, il active l'adresse d'une location : le détail s'affiche.
2. « Modifier » : le formulaire est prérempli. Il corrige le loyer, active « Enregistrer les modifications », arrive sur le détail à jour. La liste montre le nouveau total.
### 3. Fin de location et réouverture

1. Depuis le détail, « Mettre fin à la location » : la page de date de fin s'affiche, champ vide.
2. Il saisit une date passée et enregistre : le détail affiche « Terminée » et la date de fin ; la liste range la location sous « Locations terminées ».
3. Avec une date à venir : le chip reste « En cours », la liste affiche « Fin prévue le … ».
4. « Modifier la fin de la location » : le champ est prérempli ; « Rouvrir la location » retire la date, la location redevient en cours.
5. Date vide, invalide ou antérieure au début : message sous le champ, rien n'est écrit.

### 4. Supprimer

1. Depuis le détail, « Supprimer » : la page de confirmation nomme la location. Rien n'est encore supprimé.
2. « Annuler » : retour au détail, la location est intacte.
3. « Supprimer définitivement » : arrivée sur `/tableau-de-bord`, la location n'y figure plus ; si c'était la seule, l'état vide revient.
4. Son ancienne adresse affiche « Location introuvable ».

### 5. Location introuvable

Un propriétaire connecté qui ouvre l'adresse d'une location d'un autre compte, d'une location supprimée, d'un identifiant inconnu ou mal formé voit l'écran « Location introuvable », toujours le même, avec « Retour au tableau de bord ».

### 6. Sans être connecté

1. Le visiteur demande `/locations/<id>/modifier` sans session : il arrive sur `/connexion?retour=%2Flocations%2F<id>%2Fmodifier` sans avoir reçu aucun contenu protégé.
2. Après connexion, il arrive sur la page demandée, ou sur « Location introuvable » si la location n'est pas la sienne.
3. Session expirée pendant la saisie : l'envoi du formulaire mène à `/connexion` ; la saisie est perdue et rien n'est écrit.

### États communs

- **Chargement** : aucun (rendu d'un bloc, R30).
- **Panne** : écran « Service momentanément indisponible » sur les pages, E8 sur les formulaires (R31).
- **JavaScript désactivé** : tous les parcours aboutissent, avec un rechargement à chaque envoi (R34).

## Critères d'acceptation

Niveau de vérification : [V] Vitest, sans base ni navigateur ; [I] test d'intégration contre la base de test (`pnpm test:integration`) ; [N] navigateur (Playwright, projets `bureau` et `mobile`, contre la base de test) ; [C] ligne de commande ou lecture du dépôt. « A » et « B » désignent deux comptes créés par le test (R44).

### Données et isolation

- **CA1** [C] Étant donné la base de test dans l'état de la spécification 02, quand on applique les migrations par la commande documentée, alors elle réussit sans toucher aux comptes ni aux sessions ; quand on la relance, alors elle réussit sans rien modifier.
- **CA2** [I] Étant donné un propriétaire A, quand il crée une location avec des valeurs valides puis la relit et liste ses locations, alors la lecture renvoie les valeurs normalisées (R11 à R13), les montants en centimes, le jour, la date de début, aucune date de fin, et la liste contient cette location et elle seule.
- **CA3** [I] Étant donné une location de A, quand B la lit par son identifiant, alors le résultat est strictement le même que pour un identifiant aléatoire inconnu ; et la liste de B ne la contient pas.
- **CA4** [I] Étant donné une location de A, quand B la modifie, lui fixe une date de fin, la rouvre puis la supprime en fournissant son identifiant, alors chaque appel renvoie le même résultat « introuvable » que pour un identifiant inconnu, et la location de A relue ensuite est identique champ par champ, date de dernière modification comprise.
- **CA5** [I] Étant donné les fonctions d'accès de R8, quand on appelle chacune sans propriétaire ou avec un identifiant de propriétaire vide, alors elle échoue sans qu'aucune requête ne parte ; et quand on tente d'écrire directement en base un loyer de 0, des charges négatives, un jour 32, une date de fin antérieure au début, une adresse e-mail en majuscules ou une location sans propriétaire, alors la base refuse chaque écriture.
- **CA6, CA7** : supprimés (option légère de Q12). Les numéros ne sont pas réattribués.
- **CA8** [I] Étant donné un compte A qui a 100 locations et un compte B qui en a une, quand A en crée une de plus, alors la création est refusée et A en a toujours 100 ; quand A en supprime une puis en crée une, alors la création réussit ; et B peut toujours créer.
- **CA9** [I] Étant donné une location de A dont le nom et l'adresse e-mail du locataire sont uniques au test, quand A la supprime, alors ces deux valeurs ne figurent plus nulle part dans la base ; et étant donné un compte avec des locations, quand sa ligne de compte est supprimée de la base de test, alors ses locations n'existent plus et celles des autres comptes sont intactes.

### Règles pures

- **CA10** [V] Étant donné la règle de saisie des montants, quand on lui soumet chaque ligne de la table de R15, pour le loyer puis pour les charges, alors le résultat et la valeur en centimes sont ceux de la table.
- **CA11** [V] Étant donné la règle d'affichage des montants, quand on lui donne 85000, 125050, 0, 1, 9999999 et la somme 9999999 + 9999999, alors elle rend `850,00 €`, `1 250,50 €`, `0,00 €`, `0,01 €`, `99 999,99 €` et `199 999,98 €`, sans espace sécable ; et la forme de préremplissage de chacune de ces valeurs entre 0 et 9999999, resoumise à la règle de saisie, redonne la même valeur.
- **CA12** [V] Étant donné la règle du jour d'échéance, quand on lui soumet chaque exemple de R17, alors les acceptés donnent l'entier indiqué et les refusés L18 ; une valeur vide donne L17.
- **CA13** [V] Étant donné la règle des dates, quand on lui soumet chaque ligne de la table de R19, alors le résultat est celui de la table ; une date de fin égale à la date de début est acceptée, antérieure d'un jour refusée (L24) ; une date de début postérieure d'un jour à une date de fin existante est refusée (L22) ; et `2026-01-01` s'affiche `01/01/2026` quand le processus tourne avec le fuseau `UTC`, `America/Los_Angeles` ou `Pacific/Kiritimati`.
- **CA14** [V] Étant donné la règle de statut, quand on lui donne chaque ligne de la table de R20 (date de fin et instant), alors elle rend le statut indiqué, quel que soit le fuseau du processus.
- **CA15** [V] Étant donné les règles des textes, du code postal et de l'adresse e-mail du locataire, quand on leur soumet les exemples de R11, R12 et R13, une valeur à la longueur maximale de chaque champ puis un caractère de plus, une valeur contenant le caractère nul et une valeur contenant U+202E, alors les résultats sont ceux des règles (valeur normalisée, ou message L1 à L11 et L25 selon le champ).

### Tableau de bord

- **CA16** [N] Étant donné un compte sans location, quand il ouvre `/tableau-de-bord`, alors le titre du document, le `h1` et « Connecté en tant que » sont ceux de la spécification 02 ; la page a un seul `h2`, `Aucune location pour l'instant`, suivi du texte de « Contenus » ; ses seuls liens sont le logo et `Ajouter une location`, son seul bouton `Se déconnecter` ; activer `Ajouter une location` affiche `/locations/nouvelle` sans requête de document.
- **CA17** [N] Étant donné un compte avec trois locations en cours créées dans l'ordre X, Y, Z (Z ayant une date de fin à venir) et deux terminées dont les dates de fin sont le 31/01/2026 et le 30/06/2026, quand il ouvre `/tableau-de-bord`, alors « Locations en cours » liste X, Y, Z dans cet ordre et « Locations terminées » la location finie le 30/06/2026 puis l'autre ; chaque ligne affiche les sept éléments de R36 avec les formats de R16 et R19 ; Z affiche `Fin prévue le` et sa date ; `Ajouter une location` est le seul élément à fond `primary` ; aucune adresse e-mail de locataire ne figure dans le code source de la page.
- **CA18** [N] Étant donné un compte dont toutes les locations sont terminées, quand il ouvre `/tableau-de-bord`, alors « Locations en cours » affiche `Aucune location en cours.`, « Locations terminées » liste ses locations, et le texte `Aucune location pour l'instant` est absent.
- **CA19** [N] Étant donné A avec deux locations et B avec une, chacun dans son contexte de navigateur, quand chacun ouvre `/tableau-de-bord`, alors la page de A ne contient que ses deux locations et celle de B la sienne, et ni l'adresse, ni le nom du locataire, ni l'identifiant d'une location de l'un ne figurent dans le code source de la page de l'autre ; quand A se déconnecte, alors plus aucune donnée de ses locations ne figure dans le document, même masquée.
- **CA20** [N] Étant donné une location en cours et une terminée, quand on inspecte leurs chips sur le tableau de bord et sur le détail, alors `En cours` a le texte `rgb(4, 120, 87)` sur fond `rgb(236, 253, 245)` et `Terminée` le texte `rgb(107, 107, 107)` sur fond `rgb(250, 250, 250)` avec une bordure `rgb(232, 232, 236)`, tous deux en 12px avec un rayon de pilule ; les propriétés `--color-success-text`, `--color-success-surface`, `--color-warning-text` et `--color-warning-surface` de l'élément racine ont les valeurs de R38.

### Création

- **CA21** [V] Étant donné le formulaire de location rendu vide, alors il présente les trois groupes nommés et les dix champs de R33 dans l'ordre, chacun avec son libellé relié, son texte d'aide relié quand il en a un, `autocomplete="off"`, aucun `placeholder`, aucun champ de type `number` ; tous sont déclarés obligatoires sauf « Complément d'adresse » ; quand on le rend avec une erreur sur un champ et un message de formulaire, alors le message du champ est placé avant son texte d'aide, fait partie de sa description accessible, le champ porte `aria-invalid="true"`, et le message de formulaire a le rôle `alert` et précède le premier groupe.
- **CA22** [N] Étant donné un propriétaire connecté, quand il ouvre `/locations/nouvelle`, alors le titre du document, le `h1`, le bouton d'envoi et le lien `Annuler` sont ceux de « Contenus » ; tous les champs sont vides, aucun n'a le focus, aucun message n'est présent ; `Annuler` mène à `/tableau-de-bord` sans requête de document et sans rien créer.
- **CA23** [N] Étant donné `/locations/nouvelle`, quand on envoie `  12  rue des Lilas `, `Bât. B`, `69 003`, ` Lyon `, ` Paul   Martin `, ` Paul.Martin-<unique>@Quittances.test `, `1 250,50 €`, `0`, `05`, `2026-01-05`, alors on arrive sur `/locations/<id>` où `<id>` a la forme de R6 ; le détail affiche `12 rue des Lilas`, `Bât. B`, `69003 Lyon`, `Paul Martin`, l'adresse e-mail en minuscules, `1 250,50 €`, `0,00 €`, un total de `1 250,50 €`, `Le 5 de chaque mois`, `05/01/2026`, le chip `En cours`, aucune ligne « Date de fin du bail » ; et le tableau de bord, atteint par `Retour au tableau de bord` sans requête de document, liste cette location.
- **CA24** [N] Étant donné `/locations/nouvelle`, quand on envoie le formulaire vide, alors on reste sur la page ; L1, L4, L6, L8, L10, L12, L16, L17 et L19 sont chacun sous leur champ ; « Complément d'adresse » n'a pas d'erreur ; le focus est sur « Adresse » ; aucune bulle native n'apparaît ; quand on envoie ensuite des valeurs valides sauf `7501`, `paul@exemple`, `850,555`, `-5`, `32` et `2027-02-29`, alors L5, L11, L13 (loyer), L13 (charges), L18 et L20 remplacent les messages précédents, les autres champs n'ont plus d'erreur, chaque champ contient encore exactement ce qui a été saisi, et le focus est sur « Code postal » ; et aucune location n'a été créée.
- **CA25** [N] Étant donné `/locations/nouvelle` rempli de valeurs valides et une réponse retardée par le test, quand on active deux fois de suite le bouton d'envoi, alors pendant l'attente il affiche `Ajout en cours` et est indisponible, et le tableau de bord ne liste ensuite qu'une location. (Le doublon possible sans JavaScript ou par une requête rejouée est une limite acceptée, R25 : aucun critère ne l'interdit.)
- **CA26** [N] Étant donné A et B connectés chacun dans son contexte, quand B envoie la création en y ajoutant, sous tout nom de champ plausible, l'identifiant du compte de A, l'identifiant d'une location de A et une date de fin, alors la location créée figure au tableau de bord de B et pas à celui de A, a un identifiant nouveau, n'a pas de date de fin, et la location de A est inchangée.
- **CA27** [N] Étant donné une location dont l'adresse est `<img src=x onerror="window.__xss=1">` et le nom du locataire `<script>window.__xss=1</script>`, quand on ouvre le tableau de bord, le détail, le formulaire de modification, la page de date de fin et la page de confirmation de suppression, alors ces textes s'affichent tels quels, lettre pour lettre, et `window.__xss` n'est jamais défini.

### Détail, introuvable et protection

- **CA28** [N] Étant donné une location avec complément et date de fin passée, quand son propriétaire ouvre `/locations/<id>`, alors le titre du document est `Location — Quittances`, le `h1` est l'adresse, le chip est `Terminée`, les groupes et les libellés sont ceux de « Contenus » dans l'ordre, les liens d'action sont `Modifier`, `Modifier la fin de la location` et `Supprimer` avec leurs cibles, et la page ne contient aucun lien vers elle-même ; pour une location au jour 31, la valeur est `Le 31 de chaque mois, ou le dernier jour du mois s'il est plus court`.
- **CA29** [N] Étant donné A connecté et une location de B, quand A demande `/locations/<x>`, `/locations/<x>/modifier`, `/locations/<x>/fin` et `/locations/<x>/supprimer` avec pour `<x>` l'identifiant de la location de B, un UUID aléatoire inconnu, l'identifiant de B en majuscules, `1`, `nouvelle2`, `%27%20or%201%3D1` et une chaîne de 5 000 caractères, alors toutes les réponses ont le code 404 et affichent l'écran « Location introuvable » de « Contenus » ; pour une même route, la réponse obtenue avec l'identifiant de B et celle obtenue avec l'UUID inconnu ne diffèrent que par l'adresse demandée ; aucune ne contient une donnée de la location de B ; et la location de B est intacte.
- **CA30** [N] Étant donné un visiteur sans session, ou avec un cookie de session au jeton inventé, quand il demande `/locations`, `/locations/nouvelle`, puis chacune des quatre routes de CA29 avec l'identifiant d'une location existante et avec un UUID inconnu, alors il aboutit chaque fois sur `/connexion?retour=<chemin encodé>` et aucune réponse reçue ne contient un titre de page de « Contenus », un libellé de champ, `Location introuvable` ni une donnée de location ; quand le propriétaire de la location se connecte depuis `/connexion?retour=%2Flocations%2F<id>%2Fmodifier`, alors il arrive sur ce formulaire prérempli ; quand un autre compte fait de même, alors il arrive sur l'écran « Location introuvable ».
- **CA31** [N] Étant donné un propriétaire connecté, quand il demande `/locations`, alors il aboutit sur `/tableau-de-bord`.

### Modification

- **CA32** [N] Étant donné une location au loyer de 125050 centimes, aux charges nulles et au début le 05/01/2026, quand son propriétaire ouvre `/locations/<id>/modifier`, alors le titre, le `h1` et le bouton sont ceux de « Contenus », les champs contiennent les valeurs enregistrées, dont `1250,50`, `0,00` et la date `2026-01-05`, et `Annuler` mène au détail ; quand il remplace le loyer par `900` et les charges par `45,5` puis enregistre, alors il arrive sur le détail qui affiche `900,00 €`, `45,50 €` et un total de `945,50 €`, et le tableau de bord affiche `945,50 € charges comprises` sans rechargement manuel ; quand il enregistre sans rien changer, alors il arrive sur le détail, inchangé.
- **CA33** : supprimé (option légère de Q12, R26). Le numéro n'est pas réattribué.
- **CA34** [N] Étant donné A et B connectés chacun dans son contexte et une location de chacun, quand B envoie la modification, la date de fin, la réouverture puis la suppression de sa propre location après que le test a remplacé, partout où il apparaît dans la requête d'envoi, l'identifiant de sa location par celui de la location de A, d'abord avec des champs valides puis avec des champs invalides, alors B obtient chaque fois l'écran « Location introuvable » et jamais un message de validation ; la location de A, relue par A, est identique en tout point et toujours présente ; la location de B n'a pas été modifiée par ces envois.

### Fin de location

- **CA35** [N] Étant donné une location commencée le 05/01/2026 sans date de fin, quand son propriétaire ouvre `/locations/<id>/fin`, alors les textes sont ceux de « Contenus », le champ est vide et le bloc « Rouvrir la location » est absent ; quand il enregistre `2026-06-30`, alors il arrive sur le détail qui affiche `Terminée` et `30/06/2026`, et le tableau de bord range la location sous « Locations terminées » avec `Terminée le 30/06/2026` ; quand il rouvre la page et enregistre `2099-12-31`, alors le détail affiche `En cours` et le tableau de bord `Fin prévue le 31/12/2099` sous « Locations en cours ».
- **CA36** [N] Étant donné la même location, quand on envoie la date de fin vide, `2026-02-30`, `2100-01-01` puis `2026-01-04`, alors L23, L20, L21 puis L24 s'affichent sous le champ, la valeur saisie est conservée, et la location n'a toujours pas de date de fin ; quand on envoie `2026-01-05`, alors elle est acceptée ; quand on modifie ensuite la date de début en `2026-01-06` par le formulaire de modification, alors L22 s'affiche sous « Date de début du bail » et rien n'est écrit.
- **CA37** [N] Étant donné une location terminée, quand son propriétaire ouvre `/locations/<id>/fin`, alors le champ est prérempli avec sa date de fin et le bloc « Rouvrir la location » est présent ; quand il active `Rouvrir la location`, alors il arrive sur le détail, qui affiche `En cours` et plus de date de fin, et le lien d'action redevient `Mettre fin à la location` ; quand le test rejoue la requête de réouverture, alors le résultat est le même, sans erreur.

### Suppression

- **CA38** [N] Étant donné une location, quand son propriétaire active `Supprimer` sur le détail, alors `/locations/<id>/supprimer` affiche les textes de « Contenus » et nomme l'adresse, le code postal, la ville et le locataire, sans son adresse e-mail ; la location figure toujours au tableau de bord après cet affichage, après un rechargement de la page et après le survol de tous les liens de la page ; `Annuler` ramène au détail, intact.
- **CA39** [N] Étant donné la page de confirmation, quand le propriétaire active `Supprimer définitivement`, alors il arrive sur `/tableau-de-bord` où la location ne figure plus (l'état vide revient si c'était la seule) ; ses quatre adresses affichent « Location introuvable » ; quand le test rejoue la requête de suppression, alors il obtient « Location introuvable » et les autres locations du compte sont intactes.

### Robustesse, accessibilité et présentation

- **CA40** [N] Étant donné un navigateur dont JavaScript est désactivé, quand un propriétaire envoie la création vide puis avec des valeurs valides, modifie le loyer, fixe une date de fin passée, rouvre la location puis la supprime, alors on obtient successivement : les messages de CA24 sous leurs champs avec les valeurs conservées ; le détail de la location créée ; le détail à jour ; le chip `Terminée` ; le chip `En cours` ; le tableau de bord sans la location. À aucune étape une valeur saisie n'apparaît dans une adresse.
- **CA41** [N, manipulation manuelle] Étant donné l'application lancée avec une base injoignable et un cookie de session valide, quand on demande `/tableau-de-bord` puis chacune des routes de R27, alors on voit l'écran « Service momentanément indisponible » et jamais `Aucune location pour l'instant`, `Location introuvable` ni un message technique ; étant donné la base coupée après l'affichage d'un formulaire, quand on l'envoie, alors E8 s'affiche dans le message de formulaire, les valeurs sont conservées, et rien n'a été écrit une fois la base revenue.
- **CA42** [N] Étant donné le tableau de bord (vide, puis avec locations en cours et terminées), le formulaire (vide, puis en erreur), le détail, la page de date de fin, la page de confirmation et l'écran « Location introuvable », quand on lance une analyse axe avec les règles WCAG 2.1 A et AA, alors elle ne remonte aucune violation, sur `bureau` comme sur `mobile` ; chaque page a un seul `h1`, les repères `banner` et `main`, et aucun niveau de titre sauté.
- **CA43** [N] Étant donné ces mêmes pages à 320, 412, 768 et 1280px de large, avec une location dont l'adresse fait 200 caractères sans espace, le nom du locataire 100 caractères et les deux montants 99 999,99 €, quand elles sont chargées, alors il n'y a pas de défilement horizontal ; aucun montant n'est coupé sur deux lignes ; le formulaire et le détail font 640px de large au plus ; le champ de date a la hauteur, la bordure et le rayon des autres champs ; `Supprimer définitivement` a une bordure `rgb(239, 68, 68)`, un texte `rgb(185, 28, 28)` et 44px de haut ; à 1280px le montant d'une ligne est aligné à droite.
- **CA44** [N] Étant donné les parcours 1 à 5 déroulés d'un bout à l'autre, erreurs comprises, quand on observe la console et le réseau, alors la console n'affiche ni erreur ni avertissement ; les liens `Ajouter une location`, adresse d'une ligne, `Retour au tableau de bord`, `Modifier`, `Mettre fin à la location`, `Supprimer` et `Annuler` n'entraînent aucune requête de document ; à la tabulation, chaque champ, bouton et lien reçoit le focus dans l'ordre du document (R33 pour le formulaire) avec un indicateur visible ; sur toutes les pages, la première tabulation atteint le logo.
- **CA45** [N] Étant donné les parcours 1 à 4 déroulés avec un nom et une adresse e-mail de locataire uniques au test, quand on relève toutes les adresses demandées par le navigateur et tous les titres de document, alors aucun ne contient le nom, l'adresse e-mail, l'adresse du logement ni un montant ; et [C] quand on relit la sortie du serveur après une erreur de validation et après la panne de CA41, alors elle ne contient ni ce nom ni cette adresse e-mail.
- **CA46** [C] Étant donné le dépôt, quand on lance `pnpm lint`, `pnpm build` et `pnpm test`, alors les trois réussissent, `pnpm test` sans base joignable ; le build liste `/`, `/connexion` et `/inscription` avec `○` et `/tableau-de-bord` ainsi que chaque route de R27 avec un autre symbole ; et [N] la réponse à chacune de ces routes pour un propriétaire connecté porte un `Cache-Control` contenant `private` ou `no-store`.

Quarante-trois critères (CA1 à CA46, moins CA6, CA7 et CA33 supprimés), pour trente-six dans chacune des deux premières spécifications. J'ai hésité à fusionner : CA3 et CA4 (isolation en lecture et en écriture au niveau des données), gardés séparés parce qu'une écriture non filtrée ne se voit pas dans un test de lecture ; CA16 et CA18 (deux états de la liste) ; CA35, CA36 et CA37 (fin, erreurs de fin, réouverture) ; CA38 et CA39 (confirmation sans effet, puis suppression). À l'inverse, CA29 et CA34 regroupent chacun quatre routes ou quatre actions : s'ils se révèlent trop lourds à diagnostiquer, les découper par opération.

## Effet sur la spécification 02 et sur les tests existants

La spécification 02 n'est pas modifiée par ce document. Sur les points ci-dessous, la spécification 03 prime ; une note en tête de la spécification 02 devra y renvoyer (à faire par l'orchestrateur).

### Règles et critères de la spécification 02

| Référence (spécification 02) | Effet |
| --- | --- |
| Périmètre exclu, « Locations, locataires, loyers… » | Levé pour les locations. Le reste tient. |
| R2 | Inchangée, appliquée par R4 à R8. La phrase « la seule donnée privée affichée est l'adresse e-mail » n'est plus vraie. |
| R22 | La table gagne les routes de R27, toutes protégées. |
| R23 | Étendue à `/locations` et à tout ce qui est dessous (R28). |
| R24 | Étendue aux nouvelles pages (R31). Sa précision (rendu d'un bloc, pas d'état de chargement) vaut pour elles. |
| R33 | Complétée par R40 (variantes destructives, liens d'apparence bouton dans l'espace réservé). « Un seul bouton primaire par écran » tient. |
| R36 | Inchangée pour `/tableau-de-bord` ; l'en-tête sert aussi aux nouvelles pages (R42). |
| « Contenus », page `/tableau-de-bord` | L'état vide change : le texte `L'ajout de locations arrivera dans une prochaine version.` disparaît, la carte gagne un bouton. Le titre `Aucune location pour l'instant` est conservé. Le reste (titre, `h1`, « Connecté en tant que ») tient. |
| CA16 | Faux pour « la page ne contient aucun autre lien ni bouton » et pour le texte de l'état vide. Remplacé par CA16 de ce document. Sa partie sur le logo tient. |
| CA17 | Tient. La liste des textes interdits gagne `Ajouter une location`. |
| CA19, CA20 | Tiennent, renforcés par CA19 de ce document. |
| Parcours 3, étape 1 | L'état vide décrit est celui de ce document. |
| Tous les autres | Inchangés, à revérifier en fin de T6. |

### Tests à adapter (en T3, pas avant)

L'effet est le même sur les deux projets Playwright, `bureau` et `mobile` : aucun des tests concernés ne dépend de la largeur.

- `src/app/tableau-de-bord/*.test.tsx` : **aucun test ne devient faux**. `dashboard-header.test.tsx` (4 tests), `retry-button.test.tsx` (2), `sign-out-form.test.tsx` (6) portent sur des composants inchangés. Dans `service-unavailable.test.tsx`, « R24 — aucun contenu protégé : ni titre de la page, ni adresse, ni état vide » reste vrai (`Aucune location` reste absent de l'écran de panne) et gagne à vérifier aussi l'absence de `Ajouter une location`. Si le développeur déplace l'en-tête ou l'écran de panne pour les partager avec `/locations`, leurs tests suivent le fichier.
- `e2e/espace-reserve.spec.ts` :
  - « CA16 : contenus, un seul lien (le logo) et un seul bouton » devient **faux** sur trois assertions : le texte `L'ajout de locations arrivera dans une prochaine version.` n'existe plus ; `getByRole("link")` compte deux liens au lieu d'un (les deux assertions suivantes, sur un lien unique, échouent aussi) ; le titre du test est inexact. L'assertion sur le `h2` `Aucune location pour l'instant` et celle sur l'unique bouton restent vraies. À réécrire selon CA16 de ce document.
  - « CA36 : au clavier seul, le logo puis le bouton… » reste vrai (le logo puis `Se déconnecter` précèdent toujours le contenu) ; une troisième tabulation atteint désormais `Ajouter une location`.
  - « CA36, CA30 : axe sans violation… » reste vrai en principe ; à relancer, la page ayant un bouton primaire de plus.
  - La constante `INTERDITS` reste exacte ; lui ajouter `Ajouter une location`.
  - « Chemins voisins : aucun contenu protégé sans session » reste vrai ; à étendre aux chemins sous `/locations`.
  - « Espace réservé sans JavaScript » reste vrai : `getByRole("heading", { level: 2 })` ne trouve qu'un `h2` pour un compte neuf. Il deviendrait faux si l'état vide gagnait un second `h2`.
  - Tous les autres tests du fichier (CA17 à CA22, R16, R23) restent vrais.
- `e2e/inscription.spec.ts` : **aucun test ne devient faux**. Ceux qui arrivent sur le tableau de bord ne vérifient que l'adresse de la page, le `h1`, « Connecté en tant que » et `Se déconnecter`.
- `e2e/connexion.spec.ts` : **aucun test ne devient faux**. À surveiller : « CA27 » attend zéro champ visible sur le tableau de bord (vrai tant que le tableau de bord n'a pas de champ) ; « CA32 » attend que la première tabulation après connexion atteigne le logo (vrai, CA44).
- `e2e/accueil-connexion.spec.ts` : **aucun test ne devient faux** : il ne vérifie du tableau de bord que son adresse.
- `e2e/aide-comptes.ts` : `inscrire`, `connecter` et `ouvrirTableauDeBord` restent exacts.
- `e2e/socle-design-system.spec.ts` : aucun test ne devient faux ; « CA5 » peut recevoir les quatre tokens de R38.

## Découpage

Six tâches, à réaliser et recetter dans cet ordre, une à la fois. La colonne « Sensible » dit si la tâche touche à l'isolation des données, à la logique de dates ou à l'authentification : l'orchestrateur la confie alors au modèle le plus puissant.

| Tâche | Sensible | Critères |
| --- | --- | --- |
| T1 — Schéma et accès aux données | oui : isolation | CA1 à CA5, CA8, CA9 |
| T2 — Règles pures | oui : dates, montants | CA10 à CA15 |
| T3 — Tableau de bord et composants d'affichage | non | CA16 à CA18, CA20, tests existants |
| T4 — Formulaire de location (composant) | non | CA21 |
| T5 — Création, détail, introuvable, protection | oui : isolation, authentification | CA19, CA22 à CA31 |
| T6 — Modification, fin, réouverture, suppression, recette complète | oui : isolation, dates | CA32, CA34 à CA46 |

### T1 — Schéma et accès aux données (sans interface)

Table des locations et sa migration (R1, R3), contraintes de base, fonctions d'accès de R8, limite (R9), suppression réelle et disparition avec le compte (R4, R23). Ni clé de soumission ni numéro de version (R25, R26) : une modification remplace les valeurs sans comparaison. Aucune page, aucune action, aucune modification du tableau de bord. Les fonctions reçoivent des valeurs déjà validées : la validation des saisies est l'objet de T2.

Comment on sait qu'elle est terminée : par CA1 à CA5, CA8 et CA9. Le développeur livre la migration et des tests d'intégration rejouables par `pnpm test:integration`, où chaque critère d'isolation met en jeu deux propriétaires. Il indique où une location est lue ou écrite hors des fonctions de R8 : la réponse attendue est « nulle part ». Il n'y a pas de recette dans le navigateur : la QA exécute CA1 et relit que chaque fonction de R8 exige le propriétaire.

### T2 — Règles pures (sans interface, sans base)

Saisie et affichage des montants (R14 à R16), jour d'échéance (R17), dates et leur affichage (R19), cohérence début et fin (R21, R22), statut (R20), textes, code postal, adresse e-mail (R11 à R13), messages L1 à L25 et L28. Aucun calcul d'échéance (R18).

Critères couverts : CA10 à CA15, tous en Vitest. T2 ne dépend pas de T1 : l'orchestrateur peut inverser les deux.

### T3 — Tableau de bord et composants d'affichage

Tokens de R38, chip (R39), liste et ligne (R35, R36, R41), état vide et son bouton, groupes « en cours » et « terminées ». La page lit les locations par la fonction de liste de T1, sans nouvelle requête. Le lien `Ajouter une location` mène à une adresse qui n'existe pas avant T5, ce qui est attendu. Adaptation des tests existants listés plus haut. Pour la recette, les locations sont préparées sans interface (R44, point 4).

Critères couverts : CA16 (sauf l'arrivée sur `/locations/nouvelle`), CA17, CA18, CA20. `DESIGN.md` doit avoir été mis à jour (Q7).

### T4 — Formulaire de location (composant)

Le formulaire de R32 et R33 comme composant d'affichage : groupes, champs, textes d'aide, emplacement des erreurs, message de formulaire, champ de date. Aucune action, aucune page, aucune lecture de données.

Critère couvert : CA21, en Vitest. Il n'y a pas de recette dans le navigateur.

### T5 — Création, détail, introuvable, protection

Pages `/locations/nouvelle` et `/locations/<id>`, redirection de `/locations`, action de création (R7, R25), écran « Location introuvable » (R5, R6), protection de toutes les adresses sous `/locations` (R28), en-tête (R42), panne (R31). Les liens `Modifier`, `Mettre fin à la location` et `Supprimer` du détail mènent jusqu'à T6 à l'écran « Location introuvable », ce qui est attendu.

Critères couverts : CA19, CA22 à CA31. CA29 et CA30 se vérifient ici pour `/locations/<id>` et pour les adresses inconnues ; pour les trois autres routes, en T6. CA16 se complète.

### T6 — Modification, fin, réouverture, suppression, recette complète

Les quatre opérations qui visent une location existante partagent le même contrôle d'accès (R5, R7) :

- page `/locations/<id>/modifier` et son action (R22, R26), fraîcheur de la liste et du détail (R30) ;
- page `/locations/<id>/fin`, actions de date de fin et de réouverture (R20, R21), contrôle L22 du formulaire de modification ;
- page `/locations/<id>/supprimer` et son action (R23, R24).

C'est à la fin de cette tâche que la QA déroule la recette complète des parcours 1 à 6 et écrit les tests e2e durables.

Critères couverts : CA32, CA34 à CA46, et CA29, CA30 pour les trois routes restantes. À revérifier sur l'ensemble : CA19, CA27, et les critères de la spécification 02 marqués « inchangés ».

## Questions ouvertes

**Q1 — Liste des informations (bloque T1).** Hypothèse recommandée et appliquée (R1) : dix informations saisies, sans libellé du bien, sans nature des charges, sans nom du bailleur. Deux choix méritent confirmation : la date de début du bail est obligatoire (elle servira à savoir à partir de quel mois demander le loyer) ; les charges sont obligatoires, zéro devant être saisi explicitement, pour qu'un oubli ne devienne pas « pas de charges ».

**Q2 — Un seul locataire (bloque T1).** Hypothèse recommandée et appliquée (R2) : un nom en texte libre et une adresse e-mail. Autre option : plusieurs locataires dès maintenant (nom et adresse e-mail chacun), ce qui ajoute une liste dans le formulaire, des règles de suppression du dernier locataire et des critères d'isolation supplémentaires.

**Q3 — Adresses françaises seulement (bloque T1).** Hypothèse recommandée et appliquée (R12) : code postal de 5 chiffres, pas de champ « pays ». Un logement à l'étranger ne peut pas être saisi.

**Q4 — Supprimer et mettre fin (bloque T1).** Hypothèse recommandée et appliquée (R21, R23) : mettre fin archive et se défait ; supprimer efface réellement, ce qui est permis sans condition tant qu'aucune quittance n'existe. Autre option : aucune suppression réelle, seulement un marqueur « supprimée », ce qui garde des données personnelles que le propriétaire croit effacées. La durée pendant laquelle un bailleur doit ou peut conserver ses quittances et les données d'un ancien locataire n'est pas affirmée ici : à faire vérifier avant la spécification des quittances.

**Q5 — Statut (bloque T2).** Hypothèse recommandée et appliquée (R20) : la date de fin est le dernier jour du bail, inclus ; elle peut être à venir ; pas de statut « à venir » pour un bail qui n'a pas commencé. Autre option : interdire une date de fin future, ce qui rend le statut indépendant de l'horloge mais empêche d'enregistrer un départ annoncé.

**Q6 — Mois plus courts (à confirmer avant la spécification des échéances).** Hypothèse recommandée et appliquée (R18) : dernier jour du mois. Autre option : limiter le jour d'échéance à 1 à 28, ce qui supprime la question mais interdit une échéance « fin de mois ». Le texte d'aide du champ et le détail énoncent la règle : la changer plus tard changera des textes déjà testés.

**Q7 — Tokens et `DESIGN.md` (bloque T3).** `DESIGN.md` doit être complété par l'utilisateur ou l'orchestrateur : tokens `success-text`, `success-surface`, `warning-text`, `warning-surface` (R38) ; chips en « texte de la variante `-text` sur fond `-surface` » ; bouton destructif en `error-text` ; confirmation par une page plutôt que par une boîte de dialogue. À confirmer aussi : le chip `En cours` en vert. Quand les statuts de loyer arriveront sur la même ligne, il pourra être confondu avec « Payé » ; l'alternative est un chip gris pour les deux statuts de bail, distingués par leur seul libellé.

**Q8 — Limite de 100 locations et absence de pagination (bloque T1).** Hypothèse recommandée et appliquée (R9, R37). Autre option : pas de limite et une pagination dès maintenant, soit une règle d'ordre stable entre pages et plusieurs critères de plus.

**Q9 — La liste vit sur le tableau de bord (bloque T3).** Hypothèse recommandée et appliquée (R35) : le tableau de bord est la liste des locations, comme le prévoit la carte de location de `DESIGN.md` (adresse, locataire, loyer, statut du mois), et `/locations` y redirige. Le tableau de bord des loyers reçus et impayés enrichira ces lignes. Autre option : une page `/locations` distincte, qui laisserait le tableau de bord vide jusqu'à la fonctionnalité suivante.

**Q10 — Droit locatif, pour la spécification des quittances.** Je tiens pour sûr qu'une quittance distingue le loyer et les charges, d'où deux montants séparés. Je n'affirme pas la liste complète des mentions attendues (identité et adresse du bailleur, période, date du paiement), ni les conditions d'un envoi par e-mail plutôt que sur papier (un accord du locataire me semble requis, à vérifier), ni l'effet de la nature des charges (provision ou forfait) sur le libellé. Hypothèse recommandée : traiter ces points, et l'identité du bailleur, dans la spécification des quittances ; le modèle de cette version n'en préjuge pas.

**Q11 — Données personnelles avant ouverture au public.** L'application enregistre désormais des données d'un tiers. Hypothèse recommandée : s'en tenir à R43 tant que le projet reste local, et ajouter à la future spécification « mise en ligne » (Q8 de la spécification 02) l'information du locataire, la durée de conservation, l'exercice de ses droits et la suppression du compte. Les obligations exactes sont à faire vérifier, je ne les affirme pas.

**Q12 — Double soumission et modifications concurrentes (tranchée).** L'utilisateur a retenu l'option légère, appliquée en R25 et R26 : le bouton indisponible pendant l'attente, et « le dernier enregistrement l'emporte ». Deux limites sont acceptées : un doublon possible sans JavaScript, et un retour silencieux à une ancienne valeur entre deux onglets. Les deux informations du modèle, les messages L26 et L27 et les critères CA6, CA7 et CA33 que prévoyait l'autre option ont été retirés.

**Q13 — Code 404 de l'écran « Location introuvable ».** R5 exige le code 404 pour les pages. Je n'ai pas vérifié que la version de Next du projet le renvoie pour une page rendue d'un bloc. Hypothèse recommandée : l'exiger ; si le cadre ne le permet pas, le développeur le signale avant de continuer, et l'exigence qui ne se négocie pas reste l'identité des réponses entre « pas à moi » et « n'existe pas ».

**Q14 — Textes des écrans.** Titres, textes d'aide et messages sont une proposition. Hypothèse recommandée : les valider tels quels ; toute retouche se fait dans cette spécification avant la tâche concernée, les tests s'appuyant sur le texte exact.
