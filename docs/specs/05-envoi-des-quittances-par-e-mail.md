# 05 — Envoi d'une quittance au locataire par e-mail

> **Avertissement de droit.** Je ne peux pas affirmer le droit locatif. L'accord du locataire (R1) repose sur l'article 21 de la loi du 6 juillet 1989, lu sur des fiches pratiques seulement. Le point est en Q1, à faire vérifier avant une ouverture au public. Cette spécification ne dit rien de la valeur juridique d'un PDF envoyé par e-mail.

## Objectif

Le propriétaire envoie en un geste une quittance déjà produite à son locataire, en pièce jointe d'un e-mail, au lieu de la télécharger et de la transmettre lui-même. L'envoi n'est possible que si le propriétaire atteste que le locataire accepte de recevoir ses quittances par voie électronique. La quittance garde la trace de l'envoi.

## Périmètre

**Inclus**
- Une case d'accord par location, avec sa date (R1, R2).
- Un module d'envoi unique, un transport interchangeable choisi par variable d'environnement, et un transport **local** qui n'envoie rien (R16 à R20).
- Le message : objet, HTML, texte, PDF joint (R21 à R24).
- Une fonction du domaine « envoyer cette quittance », indépendante de l'interface (R5), et son écran manuel (R26).
- La trace d'envoi sur la quittance, l'état « en cours », l'échec, le renvoi (R6 à R15).

**Exclu**
- Resend et tout service tiers : seule l'interface du transport est fixée (R17, R18).
- Échéances, e-mail du jour J, envoi automatique : la fonction R5 est écrite pour qu'ils l'appellent plus tard, rien de plus. Note pour cette suite : un lien d'e-mail est un GET que les messageries suivent seules, il ne doit rien écrire sans confirmation.
- E-mails au propriétaire, réinitialisation du mot de passe, vérification d'adresse, envoi groupé, suivi d'ouverture ou de clic, confirmation de l'accord par le locataire (lien dans un e-mail), copie au propriétaire, relances.
- Domaine d'expédition (SPF, DKIM, DMARC) : à régler avant l'ouverture au public, avec Resend.

## Règles métier

Les références R… sans précision sont celles de cette spécification ; « 04 R18 » désigne la règle R18 de la spécification 04.

### Accord du locataire

**R1 — Accord, par location.** Une location gagne une information : la date d'accord, absente tant que le propriétaire n'a rien attesté. Le formulaire de location (création et modification) gagne, dans le groupe `Le locataire`, après l'adresse e-mail, une case jamais cochée d'avance à la création, préremplie selon l'état enregistré à la modification :
- libellé exact : `Mon locataire a accepté de recevoir ses quittances de loyer par e-mail.`
- aide : `Vous attestez avoir recueilli cet accord. Sans lui, la quittance ne peut pas être envoyée par e-mail ; elle reste téléchargeable.`
La date d'accord est l'instant où la case est enregistrée cochée. Décocher puis enregistrer l'efface (accord retiré, effet immédiat). Enregistrer en laissant la case cochée sans changer l'adresse e-mail ne change pas la date. La case est facultative : sans elle, la location s'enregistre comme avant. La valeur vient de la case seule, jamais d'un champ de date de la requête (tout champ de date d'accord reçu est ignoré).

**R2 — L'accord suit l'adresse.** Si l'adresse e-mail du locataire est modifiée et que la case reste cochée, c'est une nouvelle attestation : la date d'accord est renouvelée. Si l'adresse est modifiée et que la case est décochée, l'accord est effacé. Le nom du locataire ne joue pas. Le détail de la location affiche, dans le groupe `Le locataire`, `Accord pour l'envoi par e-mail : donné le JJ/MM/AAAA` (jour à `Europe/Paris`) ou `Accord pour l'envoi par e-mail : non donné`. Une location terminée garde son accord ; une location archivée ne se modifie pas (04 R39).

### Quand l'envoi est possible

**R3 — Conditions.** Un envoi n'est accepté que si, relus en base dans la transaction de R6 : la quittance existe et appartient au propriétaire (R25) ; sa location n'est pas archivée (R14) ; la location porte une date d'accord (R1) ; l'adresse du locataire est une adresse unique et bien formée (R4) ; le transport est configuré (R20) ; aucun envoi récent n'est en cours (R8). Les contrôles se font dans cet ordre ; le premier qui échoue donne le résultat de R5, sans rien écrire. Une location terminée, mais non archivée, peut envoyer (R14).

**R4 — Destinataire.** Le destinataire est l'adresse e-mail de la location, relue en base au moment de l'envoi. Elle ne vient jamais de la requête, ni d'un champ, ni d'un argument d'action, ni de l'adresse de la page. Elle n'est pas copiée dans la quittance avant l'envoi (04 R6 tient pour les valeurs figées). Avant d'être confiée au transport, elle est recontrôlée : une seule adresse, de 3 à 254 caractères, sans espace, sans caractère de contrôle (U+0000 à U+001F, U+007F), sans `,` `;` `<` `>` `"`. Sinon : résultat `destinataire-refusé` (M3), rien n'est envoyé.

### La fonction du domaine

**R5 — Une fonction, des résultats nommés.** L'envoi est une fonction du domaine qui reçoit le propriétaire courant en premier argument, l'identifiant de la quittance et l'instant présent. Elle ne dépend ni d'une page, ni d'un cookie, ni d'une requête. Résultats, et seulement ceux-là :

| Résultat | Sens | Message |
| --- | --- | --- |
| `envoyée` | transport a accepté, trace enregistrée | aucun (arrivée R26) |
| `quittance-introuvable` | autre compte, inexistante, supprimée, id mal formé (04 R22) | écran « Quittance introuvable » |
| `location-archivée` | R14 | redirection vers le détail |
| `accord-manquant` | R1 | bloc « Accord manquant » |
| `envoi-en-cours` | R8 | redirection vers le détail |
| `non-configuré` | R20 | M4 |
| `destinataire-refusé` | R4 ou refus permanent du transport | M3 |
| `échec-transport` | délai dépassé ou refus temporaire | M2 |
| `envoyée-non-enregistrée` | R10 | M5 |

Une erreur de base de données est une erreur inattendue (E8 de la spécification 02) ; elle ne transporte aucune donnée personnelle.

### Ordre des opérations et concurrence

**R6 — Trois temps.** Un envoi est un effet extérieur qu'aucune annulation de transaction ne reprend. Ordre fixe :
1. **Réserver** (transaction d'écriture, verrou de la location comme `lockRentalForWrite`) : relire la location, vérifier R3, puis marquer la quittance « envoi en cours » avec l'instant de début ; **valider**. Le verrou est relâché.
2. **Envoyer**, hors transaction et sans verrou tenu : relire les valeurs figées de la quittance, produire le PDF, composer le message (R21 à R24), appeler le transport (R17). Le destinataire est celui lu en 1 (il n'est pas relu en 2).
3. **Enregistrer** (nouvelle transaction) : « envoyée » (date, adresse du destinataire) ou « échec ». L'écriture ne vise que la quittance encore « en cours » pour ce même début d'envoi (R8).
Aucun appel au transport, aucun rendu de PDF et aucune attente d'un tiers ne se fait pendant qu'un verrou est tenu.

**R7 — Délais.** Le transport a un délai total de 15 secondes (R18) ; au-delà, l'appel est abandonné et compte comme `échec-transport`. Les transactions de R6 gardent les délais de verrou de `runWriteTransaction`. Les trois temps ne se retiennent jamais l'un l'autre.

**R8 — Double activation, deux onglets, requête rejouée.** Tant qu'une quittance est « en cours » depuis moins de 2 minutes, tout nouvel envoi la concerne comme `envoi-en-cours` : il n'envoie rien et n'écrit rien. Deux envois simultanés produisent donc exactement un appel au transport. Avec JavaScript, le bouton est indisponible pendant l'attente (R34 de la spécification 03) ; sans JavaScript, R6 suffit. Un renvoi demandé après le succès d'un envoi (R11) est un nouvel envoi, pas un rejeu : les deux messages partent.

**R9 — Envoi resté « en cours » (plantage du serveur entre 1 et 3).** Un « en cours » vieux de 2 minutes ou plus est périmé : il s'affiche `Envoi interrompu le JJ/MM/AAAA. Le message est peut-être parti.` et un nouvel envoi est permis. Rien ne le corrige à l'arrière-plan.

**R10 — Envoi réussi, enregistrement échoué.** Si le transport a accepté le message mais que l'écriture « envoyée » échoue, l'application la retente une fois aussitôt. Si elle échoue encore : résultat `envoyée-non-enregistrée`, la quittance reste « en cours » puis devient périmée (R9). L'application ne prétend pas savoir ; elle le dit (M5). Un message envoyé deux fois est préférable à un message perdu sans que le propriétaire le sache.

### Cas particuliers

**R11 — Renvoi.** Une quittance déjà envoyée peut être renvoyée autant de fois que voulu, sans limite. Chaque renvoi réussi remplace la date et l'adresse de la trace. La page de renvoi dit que la quittance a déjà été envoyée, quand et à qui. Un renvoi qui échoue ne détruit pas la trace du dernier envoi réussi : le détail montre les deux (R27).

**R12 — Adresse modifiée après envoi.** La trace garde l'adresse à laquelle le message est parti. Modifier l'adresse de la location ne change pas la trace. Un renvoi part à l'adresse courante de la location (R4), et exige l'accord courant (R2).

**R13 — Supprimer une quittance déjà envoyée (redéfinit 04 R18 pour ce cas).** La suppression d'une quittance envoyée est permise, réelle et définitive, comme une autre (04 R18) : la trace disparaît avec elle ; l'application ne peut pas retirer le message de la messagerie du locataire. La page de suppression ajoute une phrase (« Contenus »). Une quittance « en cours » depuis moins de 2 minutes ne peut pas être supprimée : l'action redirige vers le détail sans rien supprimer. Les messages du transport local liés à la quittance sont supprimés avec elle (R19).

**R14 — États de la location.** Location **terminée** : l'envoi est permis, comme la production. Location **archivée** : consultation seule (04 R39) ; ni le lien d'envoi, ni la page, ni l'action ne l'acceptent ; la page et l'action redirigent vers le détail de la location (cas « déjà là » de R26). L'enregistrement du temps 3 de R6 n'est pas refusé par un archivage survenu pendant l'envoi : le message est parti, la trace doit le dire.

**R15 — Ce que la quittance enregistre.** 04 R6 est précisé : les valeurs figées de la quittance ne changent jamais ; seules les quatre informations d'envoi sont modifiables, par la fonction de R5 et par aucun autre code : l'état (`aucun`, `en cours`, `échec`), l'instant de début du dernier envoi, la date et l'adresse du dernier envoi réussi. Tous les envois n'ont pas d'historique : une seule trace, la dernière. Migration additive : trois colonnes nullables sur la quittance et une sur la location ; aucune ligne existante n'est modifiée.

### Module d'envoi et transport

**R16 — Un seul module.** Toute l'application envoie ses e-mails par un module unique, qui ne compose rien de métier : il reçoit un message complet et le confie au transport choisi par la variable d'environnement `EMAIL_TRANSPORT` (valeur de cette spécification : `local`). Valeur absente ou inconnue : `non-configuré` (R20). Le gabarit de la quittance (R23) est hors du module.

**R17 — Interface du transport (entrée).** Un message : destinataire (une adresse), expéditeur (adresse et nom), adresse de réponse (adresse et nom), objet, corps HTML, corps texte, pièces jointes (nom de fichier, type, octets). Aucune autre donnée.

**R18 — Interface du transport (résultat, erreurs).** Le transport rend soit `accepté` (avec un identifiant du message facultatif), soit un échec classé : `refusé-définitivement` (adresse ou message refusé, réessayer ne servira à rien), `refusé-temporairement` (service indisponible, limite atteinte), `délai-dépassé` (R7). Une exception inattendue du transport est classée `refusé-temporairement`. `refusé-définitivement` donne `destinataire-refusé`, les deux autres `échec-transport`. Le transport ne journalise rien de personnel (R27). Resend, plus tard, implémente cette interface sans rien changer d'autre.

**R19 — Transport local.** Il n'envoie rien. Il enregistre chaque message dans une table de la base (destinataire, expéditeur, adresse de réponse, objet, HTML, texte, pièce jointe, date), liée à la quittance et au propriétaire, supprimée avec l'une ou l'autre. Justification : la base est déjà isolée par compte, supprimée avec le compte, lisible par les tests d'intégration, sans disque à gérer ni fichier de données personnelles hors dépôt oublié ; des fichiers n'offriraient ni suppression avec le compte ni lecture par test. Pour le relire, le développeur fournit une commande qui écrit chaque message de la base de développement en fichier `.eml` dans un dossier ignoré par Git, ouvrable dans un client de messagerie. Aucune page de l'application ne les affiche.

**R20 — Pas en production par accident.** Le transport local refuse d'envoyer et répond `non-configuré` quand une variable d'environnement déclare un environnement de production réel (nom au choix du développeur, documentée dans `.env.example`, absente par défaut). Le build de production servi par les tests e2e n'est pas un environnement de production réel : il garde le transport local. `.env.example` documente `EMAIL_TRANSPORT` et l'adresse d'expédition (R21). Sans transport configuré : la page d'envoi affiche le bloc « Envoi indisponible » et l'action répond M4.

### Contenu et sécurité du message

**R21 — Expéditeur et réponse.** Expéditeur : l'adresse de l'application (variable d'environnement), nom affiché `Quittances`. Adresse de réponse : l'adresse e-mail du compte du propriétaire, nom affiché le nom du bailleur figé dans la quittance. Le locataire qui répond écrit donc au propriétaire, jamais à l'application (Q2). L'adresse du compte est lue en base pour le propriétaire courant ; aucune valeur de la requête n'entre dans un en-tête.

**R22 — Objet et en-têtes.** Objet exact : `Quittance de loyer, <mois en minuscules et année>` (`Quittance de loyer, octobre 2026`). Aucun nom de personne ni adresse dans l'objet. Tout texte placé dans un en-tête (nom du bailleur, nom du locataire, objet) est assaini : les sauts de ligne et tous les caractères de contrôle (U+0000 à U+001F, U+007F, U+2028, U+2029) sont remplacés par une espace, puis les espaces répétées réduites ; un nom ainsi vidé devient la valeur par défaut `Quittances`. Une valeur contenant `\r\n` ne peut jamais ajouter un en-tête.

**R23 — Gabarit.** Un composant rendu en HTML sur le serveur, avec sa version texte brut de même contenu (« Contenus »). Le développeur vérifie d'abord la compatibilité de React Email avec React 19.3 et Next 16.4 ; repli si elle échoue : le même composant rendu par le rendu serveur de React, avec styles en ligne et mise en page en tableau, texte écrit à la main. Toute valeur insérée est échappée (un nom `<script>`, `&`, `"` s'affiche tel quel). Aucun contenu distant : ni image, ni police, ni feuille de style, ni lien, ni pixel de suivi. Langue du document : français.

**R24 — Pièce jointe.** Un seul PDF, octet pour octet le contenu du téléchargement de la même quittance (04 R31), sous le nom de fichier de 04 R32, type `application/pdf`.

### Isolation, routes, formulaires, données

**R25 — Isolation.** 04 R21 et R22 s'appliquent. Le propriétaire vient de `getCurrentOwner()`. L'envoi d'une quittance d'un autre compte ou inexistante donne `quittance-introuvable`, sans qu'aucune écriture, aucun appel au transport et aucun message local n'ait lieu. « Appartenance » est contrôlée avant « état » (archivée, accord, en cours). L'accord et la date d'accord se lisent et s'écrivent avec la location, donc comme elle (03 R5 à R8).

**R26 — Routes, arrivées, cas « déjà là ».**

| Adresse | Nature | Propriétaire connecté | Visiteur non connecté |
| --- | --- | --- | --- |
| `/quittances/<q>/envoyer` | page, et action en POST | page d'envoi ou l'un de ses états | `/connexion?retour=%2Fquittances%2F<q>%2Fenvoyer` |

Page rendue à chaque requête, hors cache partagé ; un GET n'écrit rien (ni état, ni message). Identifiant mal formé, inconnu, d'un autre compte : écran « Quittance introuvable », code 404. États, dans cet ordre : sans session, redirection ; quittance introuvable, 404 ; location archivée, redirection 307 vers `/locations/<id>` ; accord manquant, bloc ; envoi en cours (moins de 2 minutes), bloc ; transport non configuré, bloc ; sinon le formulaire. Les trois blocs répondent 200. Action : mêmes contrôles dans le même ordre (R3), l'action ne lit aucun champ. Arrivées : `envoyée` : 303 vers `/locations/<id>`, où la ligne montre `Envoyée le …` ; `envoi-en-cours` et `location-archivée` : 303 vers `/locations/<id>` ; les échecs M2 à M5 : la page d'envoi avec le message, code 200, le bouton disponible (nouvel essai) ; sans session : `/connexion` sans `retour`. Cas « déjà là » : envoyer une quittance déjà envoyée = renvoi (R11) ; ouvrir `/envoyer` d'une quittance supprimée ailleurs = 404 ; envoyer pendant un envoi en cours = arrivée sur le détail, rien envoyé ; ouvrir `/envoyer` depuis une page déjà `/envoyer` : le lien n'existe pas (la page n'a aucun lien vers elle-même). Une adresse sous `/quittances/<q>/envoyer/…` est « Quittance introuvable ».

**R27 — Données personnelles et journal.** L'adresse du locataire, le nom, l'adresse du logement, l'objet, le corps et le PDF n'apparaissent jamais dans une adresse, un titre de page, un journal du serveur ni un message d'erreur. Le journal du serveur reçoit, pour un envoi, le nom du résultat de R5 et sa durée, rien d'autre (pas d'identifiant de quittance). Seule exception : le transport local les écrit en base (R19). Le détail de la location et la page d'envoi affichent l'adresse du locataire : c'est leur objet, sans autre trace. La suppression du compte efface les messages locaux (cascade).

**R28 — Formulaires, design.** 03 R33 et R34 s'appliquent (POST, fonctionnement sans JavaScript, bouton indisponible pendant l'attente, `aria-invalid` pour les champs, message de formulaire avec le rôle `alert`). `DESIGN.md` : un seul bouton primaire par écran. Sur le détail de la location, `Envoyer par e-mail`, `Renvoyer par e-mail` et `Réessayer l'envoi` sont des liens secondaires (comme `Télécharger`), jamais primaires. Les liens vers `/envoyer` sont des `Link` (pas de préchargement qui écrive : la page ne fait que lire).

## Contenus

### Détail de la location, liste des quittances (location active)

Sous la ligne `Référence …` de chaque quittance, une ligne d'état en `text-secondary` :
- jamais envoyée : `Non envoyée par e-mail.`
- envoyée : `Envoyée le JJ/MM/AAAA à <adresse>.`
- en cours (moins de 2 minutes) : `Envoi en cours.`
- échec : `Échec de l'envoi le JJ/MM/AAAA.` (suivie de la ligne « Envoyée… » s'il y a eu un envoi réussi avant)
- périmé : `Envoi interrompu le JJ/MM/AAAA. Le message est peut-être parti.`

Liens d'action, entre `Télécharger` et `Supprimer` : `Envoyer par e-mail` (jamais envoyée), `Renvoyer par e-mail` (envoyée), `Réessayer l'envoi` (échec ou périmé), aucun (en cours). Noms accessibles : `Envoyer la quittance par e-mail, octobre 2026`, `Renvoyer la quittance par e-mail, octobre 2026`, `Réessayer l'envoi de la quittance, octobre 2026`. Location archivée : lignes d'état visibles, aucun lien d'envoi.

### Formulaire de location

Case et aide de R1. L'aide de l'adresse e-mail du locataire devient `Utilisée pour envoyer les quittances, si le locataire a donné son accord ci-dessous.` (remplace `Aucun e-mail n'est envoyé au locataire pour l'instant.`).

### Page `/quittances/<q>/envoyer`

- Titre du document : `Envoyer la quittance — Quittances` ; `h1` : `Envoyer cette quittance` (`Renvoyer cette quittance` si déjà envoyée). Le titre ne contient aucune donnée personnelle.
- Texte : `Vous allez envoyer la quittance suivante par e-mail à votre locataire.`
- Rappel : mois et période (`Octobre 2026, du 01/10/2026 au 31/10/2026`) ; nom du locataire ; `Adresse e-mail : <adresse courante de la location>` ; total charges comprises ; référence.
- Texte (`text-secondary`) : `Le PDF de la quittance est joint au message. Votre locataire pourra vous répondre à <adresse de connexion du propriétaire>.`
- Si déjà envoyée : `Cette quittance a déjà été envoyée le JJ/MM/AAAA à <adresse de la trace>. Le renvoi enverra un second message.`
- Bouton primaire : `Envoyer la quittance` (`Renvoyer la quittance`) ; en attente `Envoi en cours` ; lien `Annuler` vers `/locations/<id>`.
- **Bloc « Accord manquant »** : `Le locataire n'a pas donné son accord pour recevoir ses quittances par e-mail. Si c'est le cas, indiquez-le dans la location. Sinon, téléchargez la quittance et remettez-la vous-même.` Liens : `Modifier la location` (vers `/locations/<id>/modifier`), `Télécharger la quittance` (`<a>` vers `/quittances/<q>/pdf`), `Retour à la location`. Aucun formulaire.
- **Bloc « Envoi en cours »** : `Un envoi de cette quittance est en cours. Revenez dans un instant.` ; lien `Retour à la location`.
- **Bloc « Envoi indisponible »** : texte de M4 ; lien `Retour à la location`.

### Page `/quittances/<q>/supprimer`, quittance envoyée

S'ajoute avant le texte final de 04 : `Cette quittance a été envoyée par e-mail à <adresse de la trace> le JJ/MM/AAAA. La supprimer ici ne la retire pas de la messagerie de votre locataire, et l'application n'en gardera aucune trace.`

### Messages

| Code | Emplacement | Condition | Texte |
| --- | --- | --- | --- |
| M2 | message de formulaire | `échec-transport` | `Le message n'a pas pu être envoyé. Rien n'est perdu : réessayez dans quelques instants.` |
| M3 | message de formulaire | `destinataire-refusé` | `L'adresse e-mail du locataire a été refusée. Vérifiez-la dans la location, puis réessayez.` |
| M4 | message de formulaire, texte du bloc | `non-configuré` | `L'envoi par e-mail n'est pas disponible pour le moment. Vous pouvez télécharger la quittance.` |
| M5 | message de formulaire | `envoyée-non-enregistrée` | `Le message est probablement parti, mais l'envoi n'a pas pu être enregistré. Vérifiez auprès de votre locataire avant de le renvoyer.` |
| E8 | message de formulaire | panne de base | texte de la spécification 02 |

### E-mail envoyé

Objet : R22. Texte brut, mot pour mot (`<…>` : valeurs figées de la quittance ; le HTML a le même contenu, mis en forme) :

```
Bonjour <nom du locataire>,

<nom du bailleur> vous transmet la quittance de loyer de <mois en minuscules et année> pour le logement situé <adresse>, <code postal> <ville>.
Elle est jointe à ce message au format PDF.

Total, charges comprises : <total>
Paiement reçu le <JJ/MM/AAAA>
Référence : <référence>

Pour répondre, utilisez simplement la réponse de votre messagerie : votre message sera adressé à <nom du bailleur>.

Vous recevez ce message parce que votre bailleur a indiqué que vous acceptez de recevoir vos quittances de loyer par e-mail. Si ce n'est pas le cas, dites-le-lui en répondant à ce message.
```

## Parcours utilisateur

1. **Donner l'accord.** Modifier la location, cocher la case, enregistrer : le détail affiche `donné le JJ/MM/AAAA`.
2. **Envoyer.** Détail, ligne de la quittance, `Envoyer par e-mail` ; page d'envoi ; `Envoyer la quittance` ; retour sur le détail, ligne `Envoyée le … à …`, lien devenu `Renvoyer par e-mail`.
3. **Sans accord.** Même lien : bloc « Accord manquant » avec `Modifier la location` et `Télécharger`.
4. **Échec.** Message M2 ou M3 sur la page ; le bouton reste disponible ; le détail montre `Échec de l'envoi`, lien `Réessayer l'envoi`.
5. **Attente.** Avec JavaScript, bouton `Envoi en cours`, indisponible. Sans JavaScript, la page répond après l'appel (au plus environ 15 s).
6. **Supprimer une quittance envoyée.** La page ajoute la phrase de R13.
7. **États communs.** Sans session : connexion ; quittance d'un autre : 404 ; location archivée : retour au détail sans lien d'envoi.

## Critères d'acceptation

**Accord**
- **CA1.** Étant donné une location sans accord, quand le propriétaire coche la case et enregistre, alors le détail affiche `Accord pour l'envoi par e-mail : donné le` suivi de la date du jour à Paris.
- **CA2.** Étant donné un accord daté, quand le propriétaire enregistre sans toucher à la case ni à l'adresse, alors la date est inchangée.
- **CA3.** Étant donné un accord, quand il décoche et enregistre, alors le détail affiche `non donné` et l'envoi est refusé (CA10).
- **CA4.** Étant donné un accord, quand il change l'adresse e-mail en laissant la case cochée, alors la date d'accord est celle du jour ; quand il la change en décochant, alors l'accord est effacé.
- **CA5.** Étant donné un formulaire de location, quand la requête contient en plus un champ de date d'accord forgé, alors il est ignoré (la date enregistrée est celle de R1).
- **CA6.** Étant donné un formulaire de création, alors la case n'est pas cochée ; créer sans la cocher réussit.

**Envoi nominal**
- **CA7.** Étant donné une quittance, une location avec accord et le transport local, quand le propriétaire envoie, alors la réponse est 303 vers `/locations/<id>`, la ligne affiche `Envoyée le … à <adresse>` et exactement un message local existe.
- **CA8.** Étant donné ce message local, alors son destinataire est l'adresse de la location, son expéditeur `Quittances <adresse de l'application>`, sa réponse l'adresse du compte du propriétaire avec le nom du bailleur, son objet `Quittance de loyer, octobre 2026`, et il contient un HTML, un texte et une seule pièce jointe `application/pdf` identique octet pour octet au téléchargement.
- **CA9.** Étant donné ce message, alors le HTML ne contient ni `http`, ni `<img`, ni `<link`, ni `<script`, ni `<a ` ; le texte est celui de « E-mail envoyé » avec les valeurs de la quittance.
- **CA10.** Étant donné une location sans accord, quand l'action est appelée, alors le résultat est `accord-manquant`, aucun message local n'est créé et la quittance reste « jamais envoyée ».
- **CA11.** Étant donné une location terminée non archivée, quand le propriétaire envoie, alors l'envoi réussit.

**Ordre, concurrence, échecs**
- **CA12.** Étant donné un transport qui attend, quand l'envoi est en cours, alors l'état « en cours » est déjà validé en base et visible d'une autre connexion, et aucune transaction n'est ouverte pendant l'appel (une modification de la location, faite pendant l'appel, aboutit sans attendre).
- **CA13.** Étant donné deux envois simultanés de la même quittance, alors le transport est appelé une seule fois, l'un répond `envoyée`, l'autre `envoi-en-cours`.
- **CA14.** Étant donné une quittance « en cours » depuis moins de 2 minutes, quand on ouvre `/envoyer`, alors le bloc « Envoi en cours » s'affiche et le détail n'offre aucun lien d'envoi.
- **CA15.** Étant donné une quittance « en cours » depuis 2 minutes ou plus, alors le détail affiche `Envoi interrompu le … Le message est peut-être parti.` et un envoi est permis.
- **CA16.** Étant donné un transport en refus temporaire, quand le propriétaire envoie, alors la page affiche M2 avec le bouton disponible, la quittance est en « échec », le détail affiche `Échec de l'envoi le …` et `Réessayer l'envoi`, et un nouvel envoi réussi remplace l'échec.
- **CA17.** Étant donné un transport en refus définitif, alors la page affiche M3 et l'état est « échec ».
- **CA18.** Étant donné un transport qui dépasse 15 secondes, alors le résultat est `échec-transport` en moins de 20 secondes et l'état est « échec ».
- **CA19.** Étant donné un transport qui accepte et une écriture « envoyée » qui échoue deux fois, alors le résultat est `envoyée-non-enregistrée`, la page affiche M5, le message a été remis au transport une fois.
- **CA20.** Étant donné une quittance envoyée, quand le propriétaire renvoie avec succès, alors deux messages locaux existent et la trace porte la date du second ; quand le renvoi échoue, alors le détail montre à la fois `Échec de l'envoi` et `Envoyée le … à …` du premier.
- **CA21.** Étant donné une quittance envoyée à `a@quittances.test`, quand l'adresse de la location devient `b@quittances.test`, alors le détail affiche encore `a@quittances.test` ; un renvoi part à `b@quittances.test`.

**Suppression et états de la location**
- **CA22.** Étant donné une quittance envoyée, quand le propriétaire ouvre sa page de suppression, alors la phrase de R13 figure avec l'adresse et la date de la trace ; quand il confirme, alors la quittance et ses messages locaux n'existent plus et son mois peut recevoir une nouvelle quittance.
- **CA23.** Étant donné une quittance « en cours » depuis moins de 2 minutes, quand l'action de suppression est appelée, alors elle redirige vers le détail sans rien supprimer.
- **CA24.** Étant donné une location archivée avec une quittance, alors le détail n'a aucun lien d'envoi ; la page `/envoyer` et l'action redirigent (307 et 303) vers le détail, sans message local.
- **CA25.** Étant donné un transport non configuré (variable absente ou environnement de production réel), alors `/envoyer` affiche « Envoi indisponible » et l'action répond M4, sans message.

**Isolation et routes**
- **CA26.** Étant donné les comptes A et B et une quittance de A, quand B ouvre `/quittances/<q>/envoyer` ou appelle l'action avec cet identifiant, alors la réponse est 404 « Quittance introuvable », identique à celle d'un identifiant inconnu ou mal formé, aucun message local n'est créé et l'état de la quittance de A ne change pas, même si sa location est archivée, sans accord, ou en cours d'envoi.
- **CA27.** Étant donné un visiteur, quand il ouvre `/envoyer` ou appelle l'action, alors page : 307 vers `/connexion?retour=%2Fquittances%2F<q>%2Fenvoyer` ; action : `/connexion` sans `retour`.
- **CA28.** Étant donné un POST dont le corps contient `to`, `email`, `destinataire`, `subject`, `ownerId`, alors ils sont ignorés : le message part à l'adresse de la location.
- **CA29.** Étant donné un GET, un HEAD ou un préchargement de `/envoyer`, alors aucun état de quittance ni message local n'est écrit.

**Sécurité et données**
- **CA30.** Étant donné un nom de bailleur ou de locataire contenant `\r\nBcc: x@quittances.test`, alors aucun en-tête `Bcc` n'est produit et les sauts de ligne sont remplacés par des espaces ; étant donné `<script>alert(1)</script>` ou `&` dans un nom, alors le HTML les contient échappés.
- **CA31.** Étant donné une adresse de destinataire avec espace, virgule, point-virgule ou `<`, alors le résultat est `destinataire-refusé` sans appel au transport.
- **CA32.** Étant donné un envoi (réussi ou échoué), alors le journal du serveur ne contient ni adresse e-mail, ni nom, ni adresse du logement, ni objet.
- **CA33.** Étant donné un compte qui disparaît de la base, alors ses messages locaux disparaissent aussi ; étant donné une location archivée supprimée définitivement, alors les messages de ses quittances disparaissent.
- **CA34.** Étant donné les écrans d'envoi, de renvoi et de détail, alors chacun a au plus un bouton primaire, fonctionne sans JavaScript, et ne déborde pas à 320 px.

## Effet sur les spécifications précédentes et sur les tests existants

| Référence | Effet |
| --- | --- |
| Spécification 03, R33 (table des champs) | Gagne la case de R1 ; « les dix champs » devient onze ; l'aide de l'adresse e-mail change ; l'ordre de tabulation gagne la case après l'adresse. |
| Spécification 03, « Contenus », détail | Gagne la ligne d'accord dans `Le locataire`. |
| Spécification 04, R6 | Précisée par R15 : la quittance n'est plus entièrement immuable, seules les informations d'envoi changent. |
| Spécification 04, R18 | Redéfinie par R13 pour une quittance envoyée (« Engagement pour la suite » tenu). |
| Spécification 04, R24, R36 | Gagne `/quittances/<q>/envoyer` ; la liste gagne l'état et les liens d'envoi. |
| Spécification 04, page de suppression | Gagne la phrase de R13. |

**Tests rendus faux, sur les projets Playwright `bureau` et `mobile` pour l'e2e (aucune ne dépend de la largeur).** J'ai vérifié par recherche. **Le développeur ne lance aucune suite de tests** (décision de l'utilisateur du 2026-10-13) : il corrige par lecture les tests cités ci-dessous, et l'utilisateur lance lui-même `pnpm test`, `pnpm test:integration` et `pnpm test:e2e` avant la fusion dans `main`.
- `src/components/rental-form.test.tsx` : la définition attendue de l'aide (ligne 39) et le test qui cherche le texte `Aucun e-mail n'est envoyé au locataire pour l'instant.` (ligne 331) deviennent faux ; tout test qui compte les champs ou parcourt l'ordre de tabulation gagne la case.
- `src/rentals/rental-form-layout.ts` (non-test) porte le texte de l'aide : à changer avec ces deux tests.
- `src/app/locations/[id]/receipt-list.test.tsx` : tout test qui compte les liens d'une ligne (aujourd'hui `Télécharger`, `Supprimer`) devient faux, la ligne gagnant la ligne d'état et un lien d'envoi.
- `src/receipts/receipt-store.integration.test.ts`, `src/rentals/rental-store.integration.test.ts`, `src/rentals/rental-archive.integration.test.ts` : tout `toEqual` sur une quittance ou une location complète devient faux si le type gagne les nouvelles colonnes. Le développeur les liste.
- `e2e/quittances.spec.ts`, `e2e/archivage*.spec.ts`, `e2e/locations*.spec.ts` : tout test qui lit le texte entier d'une ligne de quittance ou qui crée une location par le formulaire sans la case reste vrai (case facultative) ; ceux qui relèvent les liens d'une ligne ou la phrase d'aide e-mail deviennent faux.
- Les tests d'intégration de 04 qui affirment « aucune opération ne modifie une quittance » n'existent pas sous cette forme à ma connaissance ; s'il y en a, ils sont à nuancer par R15.

## Découpage

Trois tâches, toutes `developpeur-front` en `sonnet`, livrées une à une. Pas de tâche de tests ni de recette (agents suspendus à la demande de l'utilisateur). Migrations additives seulement. Le développeur lit d'abord `node_modules/next/dist/docs/` pour les actions et les redirections.

**T1 — Accord du locataire (R1, R2, R25 pour la location ; CA1 à CA6).** Colonne de date d'accord sur la location, case dans les formulaires de création et de modification, ligne d'accord du détail, nouvelle aide de l'adresse e-mail, mise à jour des tests cités. Pas encore d'envoi.
*À vérifier à la main :* (1) créer une location sans cocher : elle s'enregistre ; (2) la modifier en cochant : le détail dit `donné le` (date du jour) ; (3) enregistrer sans rien changer : même date ; (4) changer l'adresse en laissant cochée : date renouvelée ; (5) décocher : `non donné`.

**T2 — Module d'envoi, transport local, gabarit, fonction du domaine (R3 à R24, R27 ; CA7 à CA9, CA12 à CA21, CA25, CA28 à CA33).** D'abord vérifier React Email avec React 19.3 et Next 16.4 (repli : R23). Colonnes d'envoi de la quittance, table des messages locaux (cascade), module et interface du transport (R16 à R18), transport local avec sa garde (R19, R20), gabarit HTML et texte, fonction R5 en trois temps (R6 à R10), commande de relecture des `.eml`, `.env.example`. Sans interface : le développeur la déclenche par un script court de développement.
*À vérifier à la main :* (1) lancer le script sur une quittance d'une location avec accord : une ligne dans la table, sans rien de réel envoyé ; (2) ouvrir le `.eml` généré : objet, texte, mise en page, PDF joint qui s'ouvre ; (3) relancer sur une location sans accord : refus, aucune nouvelle ligne ; (4) mettre la variable de production réelle : refus `non-configuré` ; (5) lire la console du serveur : aucune adresse ni aucun nom.

**T3 — Écran d'envoi, état sur le détail, suppression d'une quittance envoyée (R11 à R15, R26, R28 ; CA10 à CA11, CA14 à CA17, CA22 à CA27, CA34).** Page `/quittances/<q>/envoyer` avec ses blocs et son action (M2 à M5), lignes d'état et liens d'envoi de la liste, phrase de suppression, refus de supprimer pendant un envoi, redirection des locations archivées, protection de l'adresse.
*À vérifier à la main :* (1) envoyer depuis le détail : retour sur le détail, `Envoyée le … à …` ; (2) renvoyer : second message dans le `.eml` ; (3) sans accord : bloc « Accord manquant » et lien `Télécharger` ; (4) double clic rapide : un seul message ; (5) archiver la location : plus de lien d'envoi, `/envoyer` revient au détail ; avec un second compte, le même lien donne « Quittance introuvable ».

## Questions ouvertes

**Q1 — Accord par voie électronique (droit, à faire vérifier).** Je n'ai pas pu établir la forme que l'accord du locataire doit prendre (écrit, daté, signé), ni si une case cochée par le propriétaire suffit. Recommandation : garder l'option A décidée (attestation du propriétaire, date, retrait possible), et faire vérifier avant l'ouverture au public ; la confirmation par le locataire (lien) reste l'évolution prévue.

**Q2 — Adresse de réponse.** Recommandation appliquée : Reply-To = adresse du compte du propriétaire, dite sur la page d'envoi. Alternative : adresse saisie par location (non retenue : un champ de plus).

**Q3 — Texte du message (droit, à faire vérifier).** La phrase `Vous recevez ce message parce que votre bailleur a indiqué…` n'affirme rien de juridique ; je n'ai pas vérifié si une mention sur la valeur du document ou la conservation est attendue. Recommandation : garder le texte tel quel pour la version locale.

**Q4 — Copie au propriétaire.** Aucune copie n'est envoyée au propriétaire (la trace de la quittance suffit). Recommandation : ne pas l'ajouter ici ; à reprendre avec les e-mails au propriétaire.

**Q5 — Fraîcheur de l'état « en cours ».** Le détail ne se rafraîchit pas seul ; le seuil de 2 minutes est une estimation (envoi plus 15 secondes de délai, avec marge). Recommandation : garder 2 minutes, sans actualisation automatique, et revoir à l'arrivée de Resend.
