# 04 — Quittance de loyer en PDF

Statut : **validée par l'utilisateur le 2026-10-12**. Validés tels quels : le texte final du document (Q1), mention de réserve comprise et sans réserve d'encaissement (Q13, dont la relecture juridique reste à faire avant toute ouverture au public), les textes des écrans (Q12), les arbitrages sur l'archivage (Q14) et la règle « seule une location terminée peut être archivée » (R39). Dernière décision, inscrite en R43 : **une location qui n'a aucune quittance se supprime directement** (Q15 tranchée ; critères CA56 et CA57). Historique de la révision : Décisions intégrées : structure en blocs, phrase d'attestation, absence de signature avec espace à signer (Q2), nom du bailleur en texte libre (Q6), référence aléatoire (R16) et lien de téléchargement natif (R34) validés tels quels ; le mois figure sous le titre ; `Provisions pour charges` remplace `Charges` dans le document ; une mention de réserve courte est ajoutée en pied ; **« supprimer » une location l'archive**, avec restauration et suppression définitive depuis les archives (R19, R39 à R42), ce qui remplace la première version de R19 ; découpage refait. **Correction de l'utilisateur, intégrée ensuite : seule une location terminée peut être archivée** (R39, R40, R42, CA55, Q15). Le critère CA37 est remplacé par CA52 : son numéro n'est pas réattribué. Questions qui touchent au droit : Q1, Q3, Q4, Q5, Q13. Reste ouverte avant T1 : Q7 (polices), que le développeur lève en commençant.

**Précisions après T1 (document PDF), acceptées par l'orchestrateur** : (1) R17 : quinze caractères de la plage U+0100 à U+017F que DM Sans ne dessine pas (Ĉ ĉ Ĝ ĝ Ĥ ĥ Ĵ ĵ ĸ ŉ Ŝ ŝ Ŧ ŧ ſ) sont hors de l'ensemble garanti, donc non affichables ; (2) dans le document, l'espace fine insécable des montants (U+202F), absente de la police, est remplacée par l'espace insécable (U+00A0) ; (3) R28 : pour tenir sur une page aux longueurs maximales, le rendu réduit l'échelle de tout le contenu par paliers (jusqu'à 0,68), l'espace de signature de 25 mm n'étant jamais réduit, et il échoue plutôt que de livrer deux pages ; (4) un mot plus long que la ligne est coupé par une espace ordinaire, sans trait d'union : le texte extrait d'un champ sans espace peut donc contenir des espaces (CA16 les retire) ; (5) les tests du PDF tournent dans l'environnement `node` de Vitest, jsdom produisant un PDF sans texte.

**Avertissement qui vaut pour tout le document** : cette spécification décrit un document et un comportement. Elle n'affirme nulle part que la quittance produite est conforme à la loi, et aucun écran, aucun texte, aucun nom de fichier ne doit le promettre à l'utilisateur. Ce qui est tenu pour acquis en droit se limite à ce que l'orchestrateur a pu vérifier dans des fiches pratiques : la quittance distingue le loyer et les charges ; les sources s'accordent sur l'identité du bailleur et du locataire, l'adresse du logement, la période, le détail, le total et la date ; un paiement partiel ne donne pas lieu à une quittance. Tout le reste est en question ouverte, mention de réserve comprise.

Références : `CLAUDE.md`, `DESIGN.md` (dont la section « Documents »), `docs/AVANCEMENT.md`, `docs/specs/02-inscription-et-connexion.md`, `docs/specs/03-gestion-des-locations.md` (dont cette spécification modifie une partie, voir « Effet sur les spécifications précédentes »), `docs/fiches/13` et `14`.

Décisions de l'utilisateur, non rediscutées ici : Postgres chez Neon avec Drizzle ; Better Auth ; `getCurrentOwner()` seul moyen d'obtenir le propriétaire ; `cacheComponents` non activé, donc pages protégées rendues à chaque requête, `notFound()` répond 404 et `redirect()` 307 ; toute écriture passe par `runWriteTransaction` ; liens internes en `next/link` ; validation sur le serveur ; formulaires utilisables sans JavaScript ; thème clair, textes en français ; PDF produit sur le serveur (composants React pour PDF, repli sur un dessin bas niveau si la bibliothèque n'est pas compatible) et servi par un Route Handler ; informations du bailleur sur une page « Mes informations » ; une quittance fige ses montants ; production manuelle ; pas de quittance pour un paiement partiel ; aucun e-mail.

Les numéros R, CA et Q de ce document lui sont propres. Une règle d'un autre document est citée sous la forme « R5 de la spécification 03 ». Les messages L1 à L28 et E8 sont ceux des spécifications 03 et 02, repris avec leur texte exact.

## Objectif

Un propriétaire connecté renseigne une fois son nom et son adresse de bailleur, puis, pour une de ses locations et un mois donné, atteste avoir reçu le loyer et les charges en totalité et produit une quittance. La quittance est enregistrée avec tout ce qu'elle affiche, apparaît dans la page de la location et se télécharge en PDF autant de fois que voulu, toujours avec le même contenu, même si la location ou les informations du bailleur changent ensuite. Parce qu'une location porte désormais des documents, « supprimer » une location ne l'efface plus : une fois terminée, elle peut être archivée avec ses quittances, puis restaurée, et ne disparaît que par une suppression définitive faite depuis les archives. C'est la première brique du produit visé : rien ici n'envoie d'e-mail ni ne se déclenche seul.

## Périmètre

### Inclus

1. **Informations du bailleur** : page `/mes-informations`, accès depuis le tableau de bord.
2. **Règles pures** : mois proposés, période d'une quittance, référence, nom de fichier, validation des deux formulaires, contenu de la quittance comme données.
3. **Document PDF** : une page A4, produite à partir des données figées d'une quittance.
4. **Données** : informations du bailleur, quittances et archivage, fonctions d'accès qui exigent toutes le propriétaire courant, unicité par location et par mois garantie par la base.
5. **Écrans des quittances** : section « Quittances » du détail d'une location, page de production, page de confirmation de suppression d'une quittance, écran « Quittance introuvable ».
6. **Téléchargement** : Route Handler `/quittances/<id>/pdf`.
7. **Archivage des locations** (redéfinit R23 et R24 de la spécification 03) : archiver, page « Archives », détail d'une location archivée, restaurer, supprimer définitivement.

### Exclu

- Tout envoi d'e-mail, tout déclenchement automatique, toute échéance, toute relance, l'accord du locataire pour un envoi électronique.
- **Reçu de paiement partiel** : reporté. Un paiement incomplet ne donne lieu à aucun document dans cette version. Le document n'a donc ni ligne « Paiement locataire » ni ligne « Solde à payer ».
- **Mentions propres à un professionnel** (carte professionnelle, garantie financière, mandat pour le compte d'un propriétaire) : exclues. Évolution possible si l'application s'ouvre aux professionnels de la gestion locative (V2).
- Numérotation suivie des quittances : la référence de R16 la remplace.
- Calcul automatique d'un prorata, d'une révision de loyer ou d'une régularisation de charges : le propriétaire corrige lui-même les montants (R12).
- Modification d'une quittance produite ; annulation qui garde une trace ; historique des quittances supprimées (R18).
- Page de consultation d'une quittance à l'écran, aperçu avant production, envoi groupé, production de plusieurs mois à la fois, export.
- Signature manuscrite numérisée, signature électronique, logo, somme en toutes lettres (Q2, Q4).
- Bailleur décrit comme une société (forme, siège, représentant, numéro d'immatriculation) : un seul champ de nom en texte libre (R2).
- Liste des quittances de tout le compte, recherche, tri, pagination (R23, R41).
- Purge automatique des archives, archivage automatique d'une location terminée (R39).
- PDF balisé pour l'accessibilité (PDF/UA) : seule l'accessibilité minimale de R30 est exigée.
- Navigation complète dans l'en-tête, menu du compte : l'en-tête ne change pas (R24).
- Suppression du compte par l'utilisateur, durée de conservation, information du locataire (R37, Q5).
- Limitation du nombre de téléchargements (reportée comme R20 de la spécification 02).

## Règles métier

### Informations du bailleur

**R1 — Données.** Un compte a zéro ou un jeu d'informations de bailleur. Il est complet ou absent : il n'existe pas d'état partiel.

| Information | Obligatoire | Format et bornes |
| --- | --- | --- |
| Nom du bailleur | oui | texte, 1 à 100 caractères (R11 de la spécification 03) |
| Adresse | oui | texte, 1 à 200 caractères |
| Complément d'adresse | non | texte, 0 à 100 caractères ; absent si vide |
| Code postal | oui | 5 chiffres (R12 de la spécification 03, mêmes exemples) |
| Ville | oui | texte, 1 à 100 caractères |

Les règles de normalisation, de longueur et de caractères refusés sont exactement celles de la spécification 03 (R10, R11, R12), y compris le refus d'une valeur brute de plus de 500 caractères. Rien d'autre n'est demandé : ni téléphone, ni adresse e-mail de contact, ni date de naissance. L'adresse e-mail du compte ne figure jamais sur une quittance.

**R2 — Un seul champ de nom, pour tous les cas.** Le nom du bailleur est un texte libre. Un particulier y écrit son prénom et son nom ; une société sa dénomination (`SCI des Lilas`) ; plusieurs bailleurs (couple, indivision) tous leurs noms (`Marie Durand et Paul Durand`). Aucun type de bailleur n'est enregistré. Ce que cela ferme : aucune mention propre à une société, pas de signataire distinct du bailleur, et les textes du document évitent tout accord en genre ou en nombre avec le nom (R27). Seules des adresses françaises sont saisissables, comme pour un logement (Q6).

**R3 — Où et quand.** Les informations se créent et se modifient sur la seule page `/mes-informations`, à tout moment. L'inscription ne change pas. Une fois enregistrées, elles ne peuvent plus être effacées, seulement remplacées. Enregistrer sans rien changer réussit. Entre deux onglets, le dernier enregistrement l'emporte.

**R4 — Sans informations, pas de quittance.** Tant que le compte n'a pas d'informations de bailleur, aucune quittance ne peut être produite : la page de production affiche un bloc qui y renvoie à la place du formulaire (« Contenus »), et l'action de production, appelée quand même, répond Q7 sans rien écrire. Rien d'autre n'est bloqué : locations, tableau de bord, archives et quittances déjà produites restent utilisables.

**R5 — Figées dans la quittance.** Les informations du bailleur sont copiées dans chaque quittance à sa production. Les modifier ensuite ne change aucune quittance existante : une quittance de janvier garde l'adresse de janvier si le bailleur déménage en mars. Justification : la quittance est un document remis à un tiers, daté, et la règle « toujours identique » de R31 ne tiendrait pas autrement ; c'est aussi l'engagement pris par R22 de la spécification 03. Conséquence acceptée : une faute dans le nom du bailleur se corrige en supprimant puis en reproduisant chaque quittance concernée (R18). La page `/mes-informations` le dit.

### La quittance

**R6 — Ce qu'une quittance fige.** À sa production, une quittance enregistre ses propres valeurs. Aucune n'est relue ensuite dans la location ou dans les informations du bailleur, et aucune n'est modifiable : il n'existe aucune opération de modification d'une quittance.

| Information figée | Source au moment de la production |
| --- | --- |
| Identifiant | généré par le système, forme de R6 de la spécification 03 (UUID version 4, forme canonique seule acceptée) |
| Propriétaire | la session, jamais la requête |
| Location | la location visée, relue en base pour ce propriétaire |
| Mois | le mois choisi (R8) |
| Début et fin de la période | calculés (R9) |
| Bailleur : nom, adresse, complément, code postal, ville | informations du bailleur, relues en base |
| Locataire : nom | la location, relue en base |
| Logement : adresse, complément, code postal, ville | la location, relue en base |
| Loyer hors charges, charges | les montants saisis dans le formulaire de production (R12), en centimes entiers |
| Date du paiement | saisie (R13) |
| Date d'émission | date du jour à `Europe/Paris` à l'instant de la production |
| Instant de production | horloge du système |

Le total est la somme du loyer et des charges, calculée à chaque affichage, jamais enregistrée (R14 de la spécification 03). **Ne sont pas copiés** : l'adresse e-mail du locataire, le jour d'échéance, les dates de début et de fin du bail, l'adresse e-mail du compte. Les noms et les adresses viennent toujours de la base, jamais d'un champ de la requête. La lecture de la location, celle des informations du bailleur et l'écriture de la quittance forment une seule opération atomique.

**R7 — Modifier la location ensuite ne touche à rien.** Modifier une location (montants, nom du locataire, adresse, date de début), lui donner une date de fin, la rouvrir, l'archiver ou la restaurer ne modifie aucune de ses quittances, même si la période d'une quittance se retrouve hors du bail. Aucun contrôle de cohérence n'est fait après coup.

**R8 — Mois proposés.** Une quittance porte sur un mois civil, désigné par `AAAA-MM`. Pour une location dont le bail commence à la date D et finit éventuellement à la date F, un mois M peut faire l'objet d'une quittance si et seulement si : M est supérieur ou égal au mois de D ; M est inférieur ou égal au mois courant à `Europe/Paris` ; et, si F existe, M est inférieur ou égal au mois de F. La comparaison se fait par mois, pas par jour. Le calcul ne dépend pas du fuseau du serveur et reçoit l'instant en paramètre.

| Début du bail | Fin du bail | Instant (UTC) | Heure de Paris | Mois acceptés |
| --- | --- | --- | --- | --- |
| 15/01/2026 | aucune | 2026-10-12T10:00:00Z | 12/10 | 2026-01 à 2026-10 (dix mois) |
| 15/01/2026 | aucune | 2026-10-31T22:59:59Z | 31/10 à 23:59:59 | jusqu'à 2026-10 |
| 15/01/2026 | aucune | 2026-10-31T23:00:00Z | 01/11 à 00:00:00 | jusqu'à 2026-11 |
| 15/01/2026 | aucune | 2027-06-30T21:59:59Z | 30/06 à 23:59:59 | jusqu'à 2027-06 |
| 15/01/2026 | aucune | 2027-06-30T22:00:00Z (le 30 juin en UTC) | 01/07 à 00:00:00 | jusqu'à 2027-07 |
| 15/01/2026 | aucune | 2026-12-31T23:30:00Z (le 31 décembre en UTC) | 01/01/2027 à 00:30 | jusqu'à 2027-01 |
| 15/01/2026 | 20/03/2026 | 2026-10-12T10:00:00Z | 12/10 | 2026-01, 2026-02, 2026-03 |
| 01/01/2025 | 31/03/2027 (à venir) | 2026-10-12T10:00:00Z | 12/10 | 2025-01 à 2026-10 (vingt-deux mois) |
| 01/11/2026 | aucune | 2026-10-31T22:59:59Z | 31/10 à 23:59:59 | aucun |
| 01/11/2026 | aucune | 2026-10-31T23:00:00Z | 01/11 à 00:00:00 | 2026-11 |
| 13/10/2026 (demain) | aucune | 2026-10-12T10:00:00Z | 12/10 | 2026-10 : le bail commence dans le mois courant |
| 12/10/2026 | 12/10/2026 | 2026-10-12T10:00:00Z | 12/10 | 2026-10 |

Ce que la règle engage : le mois en cours est accepté dès son premier jour, parce qu'un loyer se paie souvent en début de mois ; un mois à venir n'est jamais accepté, même si le locataire a payé d'avance (Q3) ; une location terminée garde tous ses mois jusqu'à celui de sa fin. Il n'y a pas de limite d'ancienneté.

**R9 — Période.** La période d'une quittance est la partie du mois couverte par le bail : elle commence au plus tard des deux entre le premier jour du mois et la date de début du bail, et finit au plus tôt des deux entre le dernier jour du mois et la date de fin du bail si elle existe. Elle est calculée à la production à partir des dates du bail lues en base, puis figée. Une période est **complète** si elle couvre tout le mois, **incomplète** sinon. Une quittance reste rattachée à son mois, que sa période soit complète ou non.

| Début du bail | Fin du bail | Mois | Période |
| --- | --- | --- | --- |
| 15/01/2026 | aucune | 2026-01 | du 15/01/2026 au 31/01/2026 (incomplète) |
| 15/01/2026 | aucune | 2026-02 | du 01/02/2026 au 28/02/2026 |
| 15/01/2026 | aucune | 2028-02 | du 01/02/2028 au 29/02/2028 |
| 15/01/2026 | aucune | 2026-12 | du 01/12/2026 au 31/12/2026 |
| 31/01/2026 | aucune | 2026-01 | du 31/01/2026 au 31/01/2026 (incomplète) |
| 29/02/2028 | aucune | 2028-02 | du 29/02/2028 au 29/02/2028 (incomplète) |
| 15/01/2026 | 20/03/2026 | 2026-03 | du 01/03/2026 au 20/03/2026 (incomplète) |
| 10/03/2026 | 20/03/2026 | 2026-03 | du 10/03/2026 au 20/03/2026 (incomplète) |
| 15/01/2026 | 30/06/2026 | 2026-06 | du 01/06/2026 au 30/06/2026 |
| 15/01/2026 | 01/04/2026 | 2026-04 | du 01/04/2026 au 01/04/2026 (incomplète) |

Pour une période incomplète, **aucun montant n'est calculé au prorata** : le formulaire propose les montants de la location et le propriétaire saisit ce qu'il a réellement reçu (R12). Un bail dont les termes ne suivent pas le mois civil (du 15 au 14) n'est pas représentable (Q3).

**R10 — Valeur du mois reçue par le serveur.** Seule la forme `AAAA-MM` est lue : sept caractères, quatre chiffres ASCII, un tiret, un mois de `01` à `12`. Toute autre valeur donne Q1, sans lecture en base : vide, `2026-13`, `2026-00`, `2026-1`, `26-10`, `2026-10-01`, `2026/10`, `octobre 2026`, `２０２６-10`, `../`, une chaîne de 10 000 caractères, plusieurs valeurs pour le même champ. Un mois bien formé qui n'est pas accepté par R8 donne Q2 (`2099-12`, le mois précédant le début du bail, le mois suivant sa fin, le mois prochain). Les mois proposés à l'écran ne sont jamais une autorisation : le serveur recalcule R8 à chaque envoi.

**R11 — Libellés de mois.** Les mois s'écrivent `Janvier`, `Février`, `Mars`, `Avril`, `Mai`, `Juin`, `Juillet`, `Août`, `Septembre`, `Octobre`, `Novembre`, `Décembre`, suivis d'une espace et de l'année (`Octobre 2026`). Dans une phrase, un nom accessible ou un titre de métadonnées, le mois est en minuscules (`octobre 2026`). Dans la liste déroulante, une période incomplète est signalée : `Janvier 2026 (du 15/01/2026 au 31/01/2026)`. Les dates s'affichent partout `JJ/MM/AAAA`, sans conversion de fuseau (R19 de la spécification 03), document compris.

**R12 — Montants.** Le formulaire de production demande le loyer hors charges et les charges réellement reçus pour le mois. Ils sont préremplis avec ceux de la location à l'affichage de la page, dans la forme de préremplissage de R16 de la spécification 03 (`850,00`, `0,00`), et **modifiables** : c'est ce qui permet un premier mois incomplet, un loyer révisé pas encore reporté dans la location ou une régularisation de charges. Règles de saisie, bornes et messages : exactement R14 et R15 de la spécification 03 (centimes entiers, loyer de 0,01 € à 99 999,99 €, charges de 0 € à 99 999,99 €, aucun arrondi, toute la table de R15, messages L12 à L16). Les montants saisis ne modifient jamais la location. Affichage : R16 de la spécification 03. **Le libellé reste `Charges` sur tous les écrans**, comme dans la spécification 03 ; seul le document écrit `Provisions pour charges` (R27, Q4).

**R13 — Date du paiement.** Obligatoire. Forme et bornes de R19 de la spécification 03 (`AAAA-MM-JJ`, jour existant, du 1950-01-01 au 2099-12-31 ; messages L20 et L21), et jamais postérieure à la date du jour à `Europe/Paris`. Elle n'est comparée ni à la période ni aux dates du bail : un loyer peut être payé avant ou après le mois qu'il couvre.

| Instant (UTC) | Date du jour à Paris | `2026-10-31` | `2026-11-01` | `2026-11-02` |
| --- | --- | --- | --- | --- |
| 2026-10-31T22:59:59Z | 31/10/2026 | acceptée | Q5 | Q5 |
| 2026-10-31T23:00:00Z | 01/11/2026 | acceptée | acceptée | Q5 |

**Conséquence voulue : la date d'émission n'est jamais antérieure à la date du paiement attesté.** La date d'émission est la date du jour à Paris à la production (R6) et la date du paiement ne peut pas la dépasser ; la base refuse elle-même l'inverse (R23). Exemple : le 12/10/2026, une production avec un paiement daté du 25/10/2026 est refusée (Q5) ; aucun document ne peut porter `Fait à Paris, le 12/10/2026` et `Paiement reçu le 25/10/2026`, soit une émission treize jours avant le paiement. Le même jour, un paiement daté du 12/10/2026 est accepté.

**R14 — Ce que le propriétaire atteste.** Une quittance n'est produite que si le propriétaire coche une case dont le libellé exact est `Je confirme avoir reçu en totalité le loyer et les charges indiqués ci-dessus pour ce mois.` La case n'est jamais cochée d'avance, et revient décochée après toute erreur. Sans elle : Q6, rien n'est écrit. Le texte d'aide dit qu'un paiement partiel ne donne pas lieu à une quittance. L'application ne vérifie rien : elle enregistre ce que le propriétaire affirme.

**R15 — Une quittance par location et par mois.** Deux quittances ne peuvent pas exister pour la même location et le même mois. La base le garantit par une contrainte d'unicité, et non par un seul contrôle applicatif : deux productions simultanées (double activation, deux onglets, requête rejouée) en créent exactement une. La tentative qui arrive en second reçoit Q3 sous le champ « Mois », rien n'est écrit, et la quittance existante est intacte : il n'y a ni remplacement ni fusion. Deux locations différentes peuvent avoir chacune leur quittance pour le même mois. Après la suppression d'une quittance (R18), son mois peut de nouveau en recevoir une.

**R16 — Référence.** Chaque quittance a une référence, affichée dans la liste et sur le document : le mois, un tiret, puis les huit premiers caractères hexadécimaux de son identifiant, en majuscules. Exemple : identifiant `3f9a1c2e-7b4d-4e8a-9c1f-0a2b3c4d5e6f`, mois 2026-10, référence `2026-10-3F9A1C2E`. Elle sert à désigner un document et à distinguer une quittance reproduite de celle qu'elle remplace. Elle n'est pas un numéro d'ordre : elle ne révèle ni le nombre de quittances du compte ou de la plateforme, ni leur ordre, ni leur date de production. Elle n'est pas garantie unique, n'est jamais lue dans une requête et n'autorise rien.

**R17 — Caractères que le document sait afficher.** Le document ne doit jamais montrer un caractère manquant ou en omettre un. Un texte figé est **affichable** si la police du document a un dessin pour chacun de ses caractères. Sont garantis affichables : U+0020 à U+007E ; U+00A1 à U+00FF sauf U+00AD ; U+0100 à U+017F (dont `œ`, `Œ`, `Ÿ`) ; `‘`, `’`, `“`, `”`, `–`, `—`, `…`, `€`. Ne le sont jamais : les emojis, les idéogrammes, les écritures arabe et hébraïque. Pour tout autre caractère, la règle répond selon la police ; ce qu'elle accepte doit réellement figurer dans le texte du PDF. À la production, si le nom du locataire ou l'adresse du logement n'est pas affichable, l'action répond Q8 ; si ce sont les informations du bailleur, Q9 ; rien n'est écrit. Les formulaires de location et d'informations du bailleur continuent d'accepter tout ce que R11 de la spécification 03 accepte.

**R18 — Supprimer une quittance.** Une quittance produite par erreur (mauvais mois, mauvais montant, mauvaise date) se supprime, puis se reproduit : c'est la seule correction possible. La suppression est réelle et définitive, sans marqueur ni trace, et passe par une page de confirmation envoyée en POST, comme R24 de la spécification 03 : aucune requête GET ne supprime. Elle n'est possible que si la location de la quittance n'est pas archivée (R39). Ce que ce choix implique, et que la page de confirmation dit : l'application ne peut pas reprendre un PDF déjà téléchargé et remis au locataire, et ne garde aucune trace de la quittance supprimée. Les deux autres voies ont été écartées pour cette version : ne rien permettre laisserait une quittance fausse bloquer son mois pour toujours (R15) ; une annulation qui garde une trace demande un statut, un historique et une mention sur le document, et se justifiera quand l'application enverra elle-même les quittances. **Engagement pour la suite** : la spécification de l'envoi par e-mail devra redéfinir cette règle pour une quittance déjà envoyée.

**R19 — Une location qui a des quittances ne se supprime plus directement : elle s'archive (redéfinit R23 et R24 de la spécification 03 pour ce cas).** Une location ne s'efface plus en un geste. Tant qu'elle n'a aucune quittance, une location se supprime encore directement (R43) ; dès qu'elle en a une, elle ne peut plus qu'être archivée. Seule une location **terminée** peut être archivée (R39). **Archiver** une location la retire du tableau de bord et la range dans les archives, avec toutes ses quittances ; rien n'est effacé. Une location archivée peut être **restaurée**, avec ses quittances, tant qu'elle n'a pas été supprimée définitivement. La **suppression définitive** d'une location qui a des quittances n'est possible qu'une fois la location archivée : elle efface réellement, dans une seule opération atomique, la location et toutes ses quittances, après une page de confirmation qui en annonce le nombre, par POST (R24 de la spécification 03 reste la règle de cette confirmation). Justification : une location porte maintenant des documents remis à un tiers, qu'un geste unique ne doit plus pouvoir faire disparaître ; et la suppression définitive reste réelle, pour qu'un nom de locataire ne subsiste pas contre la volonté du propriétaire (R43, point 5, de la spécification 03). Les règles détaillées sont R39 à R42.

**R20 — Disparition du compte.** L'application n'offre toujours pas de suppression de compte. Si un compte disparaît de la base, ses informations de bailleur, ses locations, archivées ou non, et ses quittances disparaissent avec lui (R4, point 1, de la spécification 03).

### Isolation et accès aux données

**R21 — Isolation.** R2 de la spécification 02 et R4 à R8 de la spécification 03 s'appliquent à chaque opération. Le propriétaire vient uniquement de `getCurrentOwner()` ; chaque page, chaque action et le Route Handler vérifient eux-mêmes la session ; le filtre sur le propriétaire est dans la requête ; un identifiant venu du navigateur (adresse, argument lié à une action, champ) n'est jamais une autorisation.

| Opération | Ce qui est garanti |
| --- | --- |
| Lire, enregistrer les informations du bailleur | celles du propriétaire courant seulement ; aucune adresse ni champ ne désigne un compte |
| Produire une quittance | seulement pour une location du propriétaire courant ; sinon rien n'est écrit et la réponse est celle de R5 de la spécification 03, avant toute validation |
| Lister les quittances d'une location | seulement celles du propriétaire courant ; la location d'un autre compte reste « Location introuvable » |
| Télécharger | la quittance d'un autre compte donne la réponse d'une quittance inexistante (R22), que sa location soit archivée ou non |
| Supprimer une quittance | n'écrit que si elle appartient au propriétaire courant ; sinon R22 |
| Lister les archives | ne contient que les locations archivées du propriétaire courant |
| Archiver, restaurer, supprimer définitivement | n'écrivent que si la location appartient au propriétaire courant ; sinon rien n'est écrit et la réponse est celle de R5 de la spécification 03, sans rien révéler de son état d'archivage |

**R22 — « Pas à moi » et « n'existe pas », pour une quittance.** Pour un propriétaire connecté, une quittance d'un autre compte, une quittance supprimée, un identifiant bien formé mais inconnu et un identifiant mal formé (toutes les formes refusées par R6 de la spécification 03) donnent la même réponse : code 404, textes de l'écran « Quittance introuvable », même contenu. Une seule lecture, filtrée à la fois sur l'identifiant et sur le propriétaire ; aucune lecture par identifiant seul ; aucune lecture pour un identifiant mal formé.

**R23 — Accès aux données (contrat de la tâche T3).** Toutes les lectures et écritures passent par un ensemble de fonctions qui reçoivent chacune le propriétaire courant en premier argument, échouent avant toute requête s'il manque ou si son identifiant est vide, et filtrent sur lui : lire et enregistrer les informations du bailleur ; produire une quittance ; lister et compter les quittances d'une location ; lire une quittance ; supprimer une quittance ; et les fonctions d'archivage de R42. Aucun autre code n'interroge ces données. Produire distingue cinq résultats : produite ; location introuvable ; location archivée ; informations du bailleur absentes ; quittance déjà existante. Une erreur de base ne transporte aucune donnée saisie. La base refuse elle-même : un doublon location et mois ; un loyer nul ou négatif ; des charges négatives ; un montant au-dessus de 9 999 999 ; une période dont la fin précède le début ou qui sort de son mois ; une date de paiement postérieure à la date d'émission ; une quittance sans propriétaire ou sans location ; des informations de bailleur hors des bornes de R1. La liste des quittances d'une location est ordonnée par mois, le plus récent d'abord, sans pagination (au plus une par mois).

### Routes, téléchargement et redirections

**R24 — Routes.** `<id>` est l'identifiant d'une location, `<q>` celui d'une quittance.

| Adresse | Nature | Propriétaire connecté | Visiteur non connecté |
| --- | --- | --- | --- |
| `/mes-informations` | page | formulaire, vide ou prérempli | `/connexion?retour=%2Fmes-informations` |
| `/archives` | page | liste des locations archivées ou état vide (R41) | `/connexion?retour=%2Farchives` |
| `/locations/<id>` | page (existante) | détail ; gagne la section « Quittances » ; présentation propre à une location archivée (R39) | inchangé |
| `/locations/<id>/quittances/nouvelle` | page | production, ou l'un de ses états (R25) | `/connexion?retour=<chemin encodé>` |
| `/locations/<id>/archiver` | page | confirmation de l'archivage | `/connexion?retour=<chemin encodé>` |
| `/locations/<id>/supprimer` | page (existante) | confirmation de la suppression définitive, pour une location active sans quittance (R43) ou pour une location archivée (R40) | inchangé |
| `/quittances/<q>/supprimer` | page | confirmation de suppression d'une quittance | `/connexion?retour=<chemin encodé>` |
| `/quittances/<q>/pdf` | Route Handler | le fichier PDF (R32) | `/connexion`, sans paramètre (R33) |

Toute autre adresse sous `/quittances` (dont `/quittances` et `/quittances/<q>`) affiche l'écran « Quittance introuvable » à un propriétaire connecté et redirige un visiteur vers `/connexion?retour=…`. `/locations/<id>/quittances` et toute autre adresse sous `/locations/<id>/` restent « Location introuvable ». Une adresse sous `/archives/` est la page 404 générale pour un propriétaire connecté et une redirection vers la connexion pour un visiteur. Une adresse à l'encodage illisible sous `/quittances/` répond 400, corps vide, comme sous `/locations/`. La protection est celle de R28 de la spécification 03 : session contrôlée avant tout identifiant, aucun contenu protégé envoyé à un visiteur, session prolongée par la navigation. Toutes ces adresses sont rendues à chaque requête et ne sont jamais en cache partagé (R30 de la spécification 03). **L'en-tête de l'espace connecté ne change pas** : les accès à « Mes informations » et aux « Archives » sont deux liens du tableau de bord (« Contenus »), parce que l'en-tête n'a pas la place de les porter à 320px (estimation, Q9).

**R25 — États de la page de production.** Contrôlés dans cet ordre, le premier qui s'applique étant affiché : (1) sans session, redirection ; (2) location introuvable, R5 de la spécification 03 ; puis, si la location est archivée, redirection vers son détail (R40) ; (3) informations du bailleur absentes, bloc « Informations manquantes » ; (4) bail qui commence après le mois courant, bloc « Bail à venir » ; (5) tous les mois acceptés par R8 ont déjà une quittance, bloc « Rien à produire » ; (6) sinon, le formulaire. Les états 3 à 6 répondent 200. La liste déroulante ne propose que les mois acceptés par R8 **sans quittance**, du plus récent au plus ancien, le plus récent étant sélectionné.

**R26 — Ordre des contrôles des actions, redirections, cas « déjà là ».** Toute action suit R7 de la spécification 03 : session (sinon `/connexion` sans `retour`) ; identifiant et appartenance (sinon R5 de la spécification 03 pour une location, R22 pour une quittance) ; état d'archivage (R40) ; pour la production, présence des informations du bailleur (sinon Q7) ; validation de tous les champs ensemble ; pour la production, R17 puis l'écriture, où l'unicité tranche (Q3). Une requête qui vise la location d'un autre compte avec des champs invalides reçoit « Location introuvable », jamais un message de validation. Une action ne lit que ses champs : tout autre champ est ignoré (identifiant de propriétaire, nom du bailleur ou du locataire, adresse, dates de période, date d'émission, référence, date d'archivage).

| Action réussie | Arrivée |
| --- | --- |
| Informations du bailleur enregistrées | `/tableau-de-bord` (destination fixe, Q8) |
| Quittance produite | `/locations/<id>`, où elle figure dans la section « Quittances », à sa place dans l'ordre des mois |
| Quittance supprimée | `/locations/<id>` de sa location |
| Location archivée | `/tableau-de-bord`, où elle ne figure plus |
| Location restaurée | `/locations/<id>` |
| Location archivée supprimée définitivement | `/archives` |
| Location active sans quittance supprimée (R43) | `/tableau-de-bord` |

Cas « déjà là » :

- `/mes-informations` déjà renseignée : formulaire prérempli ; enregistrer sans changement réussit. La page n'a aucun lien vers elle-même ; les liens `Mes informations` et `Archives` n'existent que sur le tableau de bord.
- Produire pour un mois qui a déjà sa quittance (formulaire resté ouvert, second onglet, requête rejouée) : Q3, la quittance existante est intacte. Avec JavaScript, le bouton indisponible pendant l'attente empêche le double envoi (R34 de la spécification 03) ; sans JavaScript, la contrainte de R15 suffit.
- Télécharger plusieurs fois : même contenu à chaque fois (R31). Télécharger une quittance supprimée ailleurs : le navigateur affiche « Quittance introuvable ».
- Supprimer une quittance déjà supprimée : « Quittance introuvable ».
- Produire pour une location supprimée définitivement ailleurs : « Location introuvable ».
- Archiver une location déjà archivée, restaurer une location qui ne l'est pas, supprimer définitivement une location active qui a des quittances : R40 et R43.
- Session expirée au moment de télécharger : arrivée sur `/connexion` ; après connexion, arrivée sur `/tableau-de-bord`.
- Une action refusée sans JavaScript par « introuvable » affiche la page 404 générale, avec le code 404 (limite acceptée par la spécification 03).

### Le document PDF

**R27 — Contenu, bloc par bloc.** Une seule colonne, dans cet ordre. Les valeurs entre chevrons sont les valeurs figées de la quittance ; tout le reste est repris mot pour mot.

| Bloc | Contenu |
| --- | --- |
| 1. Titre | `Quittance de loyer`, puis sur la ligne suivante le mois de la quittance au format de R11 : `<Mois AAAA>` (`Janvier 2026`) |
| 2. Référence | `Référence <référence>` |
| 3. Bailleur | libellé `Bailleur`, puis `<nom du bailleur>`, `<adresse>`, `<complément>` (ligne absente s'il n'y en a pas), `<code postal> <ville>` |
| 4. Locataire | libellé `Locataire`, puis `<nom du locataire>` |
| 5. Logement | libellé `Logement loué`, puis `<adresse>`, `<complément>` (ligne absente s'il n'y en a pas), `<code postal> <ville>` |
| 6. Période | libellé `Période`, puis `Du <début> au <fin>` |
| 7. Détail | trois lignes, libellé à gauche et montant aligné à droite : `Loyer hors charges`, `Provisions pour charges`, `Total` |
| 8. Attestation | `Reçu de <nom du locataire> la somme de <total> au titre du loyer et des charges du logement désigné ci-dessus, pour la période du <début> au <fin>. Le bailleur en donne quittance au locataire.` |
| 9. Paiement | `Paiement reçu le <date du paiement>` |
| 10. Lieu et date | `Fait à <ville du bailleur>, le <date d'émission>` |
| 11. Signature | libellé `Le bailleur`, puis `<nom du bailleur>`, puis un espace vide d'au moins 25mm de haut |
| 12. Mention de réserve | `La présente quittance ne libère le locataire que pour la période indiquée. Elle ne vaut pas quittance des loyers et des charges des périodes antérieures.` |

Précisions :

- **Mois sous le titre** : première lettre en majuscule, le reste en minuscules, année sur quatre chiffres, sans « Loyer de » devant (pas d'élision à gérer). Pour une période incomplète, c'est toujours le mois de rattachement (`Janvier 2026` pour une période du 15/01/2026 au 31/01/2026) ; les dates exactes sont dans le bloc 6. Le titre des métadonnées (R30) reprend le même mois en minuscules.
- **Détail** : la ligne `Provisions pour charges` figure toujours, même à `0,00 €`. Ce libellé ne vaut que pour le document ; il serait inexact pour un bail au forfait de charges, que l'application ne distingue pas (Q4). La phrase d'attestation garde les mots « du loyer et des charges ». Il n'y a ni ligne « Paiement locataire » ni ligne « Solde à payer » : une quittance n'existe que pour un paiement intégral.
- **Montants** : R16 de la spécification 03, avec des espaces insécables que la police sait dessiner ; les critères les comparent après remplacement de toute espace par une espace ordinaire.
- **Signature** : le document ne porte ni image de signature ni mention qui prétendrait en tenir lieu ; l'espace vide permet de signer à la main un exemplaire imprimé (décision de l'utilisateur, Q2).
- **Mention de réserve** : dernier bloc, en pied de document, dans un corps plus petit que le texte courant. C'est la seule formule juridique du document ; elle est calquée sur l'usage observé, ramenée à deux idées (la quittance ne vaut que pour sa période ; elle ne vaut pas pour les périodes antérieures). Ont été écartés parce qu'ils ne s'appliquent pas ici : l'annulation des reçus pour acompte (il n'y a pas de paiement partiel), le congé et l'indemnité d'occupation, les instances judiciaires, la réserve d'encaissement (le propriétaire atteste un paiement reçu). **Elle n'est présentée nulle part comme une garantie**, et sa relecture est une question ouverte (Q13).
- Le document ne contient rien d'autre : ni adresse e-mail, ni jour d'échéance, ni mention de l'application, ni numéro de page, ni mention propre à un professionnel.

**R28 — Format et mise en page.** Une page A4 en portrait (210 × 297mm), marges de 20mm, texte noir sur fond blanc, aucune couleur, aucun fond, aucune image. Le document tient **toujours sur une seule page**, les douze blocs compris, y compris quand tous les textes figés sont à leur longueur maximale (nom de 100 caractères, adresse de 200, complément de 100, ville de 100, pour le bailleur comme pour le logement) et les deux montants à 99 999,99 € ; le corps réduit de la mention de réserve et l'espace de signature de 25mm sont les deux variables d'ajustement, dans cet ordre de préférence. Un texte long passe à la ligne à l'intérieur des marges, même sans espace ; il n'est jamais tronqué, ne sort jamais de la page, et **aucun trait d'union de césure n'est ajouté**. Un montant ne se coupe jamais. Tout texte saisi est dessiné tel quel : `<`, `&`, parenthèses, barre oblique inverse et `%` compris.

**R29 — Polices.** Celles du design system : Plus Jakarta Sans 700 pour le titre, DM Sans 400 et 500 pour le reste, y compris le mois sous le titre, la mention de réserve et la référence (écart assumé avec `DESIGN.md`, qui réserve JetBrains Mono aux références, pour ne pas incorporer une troisième famille). Les polices sont incorporées au fichier à partir de fichiers présents dans le dépôt : la production d'un PDF ne dépend d'aucun service extérieur. Si elles ne peuvent pas être incorporées, le développeur le signale avant de continuer ; le repli est la police standard Helvetica, et l'ensemble garanti de R17 se réduit alors à ce qu'elle sait dessiner (Q7).

**R30 — Métadonnées et accessibilité minimale.** Titre : `Quittance de loyer, <mois en minuscules>` (`Quittance de loyer, octobre 2026`), le même mois que sous le titre du document. Auteur : `<nom du bailleur>`. Application d'origine : `Quittances`. Langue : `fr-FR`. Date de création : l'instant de production de la quittance, jamais l'instant du téléchargement. Ni sujet ni mots-clés ; le nom du locataire ne figure dans aucune métadonnée. Tout le texte est du vrai texte, sélectionnable et extractible, jamais une image.

**R31 — Toujours la même quittance.** Le fichier est reconstruit à chaque téléchargement à partir des valeurs figées, sans rien relire de la location ni des informations du bailleur. Deux téléchargements de la même quittance ont le même texte extrait, le même nombre de pages et les mêmes métadonnées, date de création comprise, quelles que soient les modifications faites entre-temps, archivage et restauration compris. **L'identité octet pour octet n'est pas exigée.** Limite acceptée : si le gabarit du document change dans une version future, les quittances anciennes seront redessinées avec le nouveau gabarit, leurs valeurs restant les mêmes.

**R32 — Téléchargement : réponse réussie.** `GET /quittances/<q>/pdf`, pour le propriétaire de la quittance, que sa location soit archivée ou non : code 200 ; `Content-Type: application/pdf` ; `Content-Disposition: attachment; filename="quittance-<AAAA-MM>-<huit premiers caractères de l'identifiant, en minuscules>.pdf"` (exemple : `quittance-2026-10-3f9a1c2e.pdf`) ; `Cache-Control: private, no-store` ; `X-Content-Type-Options: nosniff`. Le navigateur enregistre le fichier et reste sur la page affichée. Le nom du fichier n'est fait que de `a` à `z`, de chiffres, de tirets et d'un point ; il est construit à partir du mois et de l'identifiant, jamais d'un texte saisi : il ne contient ni nom ni adresse. Le choix du téléchargement plutôt que de l'affichage dans l'onglet est délibéré : comportement identique d'un navigateur à l'autre, et la page de la location reste affichée.

**R33 — Téléchargement : autres réponses.** La session est contrôlée avant l'identifiant, par le Route Handler lui-même.

| Cas | Code | Réponse |
| --- | --- | --- |
| Sans session, session expirée, jeton inventé | 307 | `Location: /connexion`, sans paramètre `retour` ; aucun octet de PDF |
| Quittance d'un autre compte, supprimée, inconnue, identifiant mal formé | 404 | document HTML en français portant les textes de « Quittance introuvable » ; réponses identiques entre elles (R22) |
| Base injoignable ou trop lente | 503 | document HTML portant le titre et la phrase de l'écran de panne de la spécification 02 |
| Erreur pendant la construction du PDF | 500 | même document que pour 503 ; jamais un PDF partiel |
| Adresse à l'encodage illisible | 400 | corps vide |
| Autre méthode que GET et HEAD | 405 | rien n'est lu ni écrit |

HEAD donne le code et les en-têtes de GET, sans corps. Toutes ces réponses portent `Cache-Control` avec `no-store` ; aucune, hors 200, n'a le type `application/pdf` ni d'en-tête `Content-Disposition`. Aucun message technique n'est montré ; seul le type de l'erreur est journalisé. **Pourquoi 307 et non 401** : l'adresse est suivie par la navigation d'un navigateur, qui afficherait une page d'erreur nue pour un 401 ; l'application authentifie par cookie et renvoie partout ailleurs vers la connexion. **Pourquoi sans `retour`** : revenir après connexion sur une adresse qui déclenche un téléchargement laisserait l'utilisateur devant le formulaire de connexion ; il arrive donc sur le tableau de bord. Pour les réponses 404, 503 et 500, un document HTML autonome, sans l'en-tête de l'application, est accepté si le cadre ne permet pas mieux depuis un Route Handler.

**R34 — Le lien de téléchargement n'est pas un `Link`.** La règle « liens internes en `next/link` » vaut pour les pages. `/quittances/<q>/pdf` est une ressource : son lien est un `<a href>` natif, sans attribut `download` (c'est l'en-tête de R32 qui déclenche l'enregistrement, et une réponse 404 s'affiche alors normalement), et **sans préchargement** : aucune requête ne part vers cette adresse avant l'activation du lien, ni au survol, ni à l'affichage de la liste. C'est la seconde exception à la règle, après la déconnexion.

### Formulaires, design, données personnelles, tests

**R35 — Formulaires.** R33 et R34 de la spécification 03 s'appliquent aux deux formulaires (libellé visible relié, pas de `placeholder`, erreur sous le champ avant le texte d'aide, `aria-invalid`, message de formulaire avec le rôle `alert`, focus sur le premier champ en erreur, bouton indisponible pendant l'attente, POST, fonctionnement sans JavaScript, aucune bulle native), avec ces différences :

- **Informations du bailleur** : les champs portent `autocomplete` `name`, `address-line1`, `address-line2`, `postal-code`, `address-level2`, puisqu'ils décrivent le propriétaire lui-même. Tous obligatoires sauf le complément.
- **Production** : les champs portent `autocomplete="off"`. Le mois est une liste déroulante ; les montants des champs de texte à clavier décimal, jamais de type `number` ; la date un champ de date ; l'attestation une case à cocher de 20px (`DESIGN.md`), libellé à sa droite, cliquable.
- Après une erreur, les valeurs saisies sont conservées (précisions de la spécification 03 pour une date inexistante), le mois choisi reste sélectionné s'il est encore proposé, la case revient décochée.
- Ordre de tabulation de la production : mois, loyer, charges, date, case, bouton d'envoi, `Annuler`.

Les formulaires sans champ (archiver, restaurer, supprimer définitivement, supprimer une quittance) suivent les mêmes règles d'attente, de panne (E8) et de fonctionnement sans JavaScript que ceux de réouverture et de suppression de la spécification 03.

**R36 — Design.** Pages dans la colonne de 640px de R41 de la spécification 03, `h1` et boutons comme R40 et R41. `Produire une quittance` (détail), `Renseigner mes informations` (bloc « Informations manquantes ») et `Archiver la location` (page d'archivage) sont d'apparence bouton primaire, seuls primaires de leur page. `Télécharger`, `Archiver` (détail d'une location terminée) et `Restaurer la location` sont d'apparence secondaire petite ; `Supprimer` d'une quittance et `Supprimer définitivement` du détail d'une location archivée sont des liens d'apparence destructive petite ; `Supprimer définitivement` des pages de confirmation est un bouton destructif grand. Le détail d'une location active garde le lien destructif petit `Supprimer` de la spécification 03 tant qu'elle n'a aucune quittance (R43), et n'en a plus dès qu'elle en a une. La section « Quittances » et la page « Archives » sont des listes sémantiques dans une carte, lignes séparées d'un filet (R41 de la spécification 03) ; la référence y est en JetBrains Mono ; les montants en chiffres tabulaires, jamais coupés. Le bandeau d'une location archivée est un texte dans une carte bordée, sans couleur sémantique. Aucun défilement horizontal de 320 à 1920px. Deux liens de même texte visible dans une liste ont des noms accessibles distincts, qui commencent par le texte visible.

**R37 — Données personnelles.** Le document réunit le nom et l'adresse du bailleur, le nom du locataire et l'adresse du logement. Dès maintenant :

1. **Jamais dans une adresse** : seuls des identifiants et le mot `pdf` y figurent. **Jamais dans un titre de page** : titres génériques. **Jamais dans un journal** : ni valeurs saisies, ni paramètres SQL ; seul le type d'une erreur.
2. **Nom de fichier** sans nom ni adresse (R32). Métadonnées limitées à R30.
3. **Jamais en cache partagé** (R32, R33).
4. **Suppression réelle** : après la suppression d'une quittance ou la suppression définitive de sa location, ses valeurs figées ne subsistent nulle part dans la base, pas plus que le nom et l'adresse e-mail du locataire.
5. L'adresse e-mail du locataire ne figure ni dans une quittance, ni dans la section « Quittances », ni dans la page « Archives », ni sur les autres pages nouvelles.
6. Après une déconnexion, aucune de ces données ne subsiste dans le document affiché.
7. **Une location archivée conserve toutes ses données**, y compris l'adresse e-mail du locataire, jusqu'à sa suppression définitive ; les textes des écrans le disent sans détour : archiver n'est pas effacer.

Non affirmé et reporté avant toute ouverture au public : durée de conservation des quittances et des archives, information du locataire, export et suppression du compte (Q5).

**R38 — Tests.** R44 de la spécification 03 s'applique (comptes et données créés par chaque test, domaine `quittances.test`, noms inventés, deux comptes A et B pour tout critère d'isolation, préparation possible sans interface, `pnpm test` sans base joignable). En plus :

1. **Le PDF se vérifie sur le fichier lui-même** : texte extrait, nombre et format des pages, métadonnées, polices incorporées. L'outil d'extraction est libre. Le texte extrait se compare après avoir ramené toute suite d'espaces et de sauts de ligne à une espace ordinaire ; « contient dans cet ordre » ne suppose rien de la mise en lignes.
2. Aucun test dans le navigateur ne dépend de l'heure : les mois s'obtiennent avec un bail entièrement passé (début `2026-01-15`, fin `2026-03-20`), une date future avec `2099-12-31`. Les limites de R8, R9 et R13 et la date d'émission se vérifient sur les règles pures et en intégration, avec un instant fourni. La date d'archivage affichée ne se vérifie dans le navigateur que sur une location préparée avec une date d'archivage fixée.
3. Les quittances d'un compte de test sont purgées avec lui. Un test peut préparer une location archivée sans passer par l'interface, avec une date de fin antérieure à sa date d'archivage (R42). Dans le navigateur, une location terminée s'obtient avec une date de fin passée, une location en cours sans date de fin ou avec `2099-12-31` ; le cas « fin aujourd'hui » se vérifie sur la règle pure et en intégration.

### Archivage des locations

Ces règles prolongent R19. Elles sont numérotées à la suite pour ne rien renuméroter.

**R39 — Ce qu'est une location archivée, et ce qu'on peut en faire.** Une location est **archivée** si elle porte une date d'archivage, **active** sinon. « Terminée » et « archivée » restent deux choses : « terminée » dit que le bail est fini (statut calculé, R20 de la spécification 03), « archivée » dit que le propriétaire a rangé la location. Mais la seconde suppose la première.

**Seule une location au statut « Terminée » peut être archivée** : sa date de fin existe et est strictement antérieure à la date du jour à `Europe/Paris`. Une location en cours ne peut pas l'être, qu'elle n'ait pas de date de fin, que sa date de fin soit à venir ou qu'elle soit égale à aujourd'hui. Une location terminée n'est jamais archivée automatiquement. La date du jour vient du serveur, jamais du navigateur.

| Date de fin | Instant (UTC) | Date du jour à Paris | Archivable |
| --- | --- | --- | --- |
| 11/10/2026 (hier) | 2026-10-12T10:00:00Z | 12/10/2026 | oui |
| 12/10/2026 (aujourd'hui) | 2026-10-12T10:00:00Z | 12/10/2026 | non : le dernier jour du bail est inclus |
| 13/10/2026 (demain) | 2026-10-12T10:00:00Z | 12/10/2026 | non |
| aucune | 2026-10-12T10:00:00Z | 12/10/2026 | non |
| 31/10/2026 | 2026-10-31T22:59:59Z | 31/10/2026 | non |
| 31/10/2026 | 2026-10-31T23:00:00Z | 01/11/2026 | oui |

**Invariant : une location archivée est terminée, et le reste.** Elle avait une date de fin passée au moment de l'archivage, une date passée reste passée, et la consultation seule ci-dessous interdit de modifier cette date ou de rouvrir la location tant qu'elle est archivée. Son chip affiche donc toujours `Terminée`. Après restauration, la location est toujours terminée ; si le propriétaire la rouvre ensuite, ou reporte sa date de fin à aujourd'hui ou plus tard, elle redevient en cours et n'est plus archivable tant qu'elle n'est pas de nouveau terminée.

**Location créée par erreur (Q15, tranchée).** Tant qu'elle n'a aucune quittance, elle se supprime directement, quel que soit son statut, par un seul formulaire (R43) : c'est le cas ordinaire d'une erreur de saisie. Si elle a des quittances, le chemin est : (1) supprimer ses quittances une à une, après quoi elle redevient supprimable directement ; ou bien (2) page `/locations/<id>/fin`, donner une date de fin passée, puis page `/locations/<id>/archiver`, puis, depuis `/archives`, `/locations/<id>/supprimer`. Dans ce second chemin seulement, une location dont le bail commence aujourd'hui ou plus tard doit d'abord voir sa date de début ramenée dans le passé (L24) ; le premier chemin n'a pas cette contrainte, et une issue existe donc toujours sans saisir de date fausse.

Une location archivée est **en consultation seule** :

| Opération | Location active | Location archivée |
| --- | --- | --- |
| Figurer au tableau de bord | oui | non |
| Figurer dans les archives | non | oui |
| Consulter le détail, à la même adresse `/locations/<id>` | oui | oui, avec un bandeau |
| Télécharger ses quittances | oui | oui |
| Modifier, mettre fin, rouvrir | oui | non |
| Produire une quittance, supprimer une quittance | oui | non |
| Archiver | seulement si elle est terminée | sans objet |
| Restaurer | sans objet | oui |
| Supprimer définitivement | seulement si elle n'a aucune quittance (R43) | oui, avec ses quittances |

Justification : une seule règle simple, « rien ne change dans les archives » ; pour corriger ou compléter, on restaure d'abord, ce qui ne coûte qu'un geste et se défait. **Engagement pour la suite** : une location archivée ne recevra ni échéance, ni e-mail, ni relance. Une location archivée **compte dans la limite de 100 locations** de R9 de la spécification 03 : la limite porte sur toutes les locations du compte, ce qui borne aussi la page « Archives », affichée sans pagination. Le texte de L28 (« Supprimez-en une pour en ajouter une autre ») reste exact : seule une suppression définitive libère une place.

**R40 — Archiver, restaurer, supprimer définitivement : déroulement et état inapplicable.**

- **Archiver** : le détail d'une location active et **terminée** porte le lien `Archiver`, qui mène à la page `/locations/<id>/archiver` ; elle explique ce qui va se passer et l'envoi en POST de son formulaire archive. Le détail d'une location **en cours** n'a pas ce lien : à sa place, dans le groupe des actions, une phrase visible dit pourquoi et quoi faire (« Contenus »). Un lien absent et expliqué a été préféré à un lien indisponible, qui est un piège au clavier et au lecteur d'écran. La condition « terminée » est recontrôlée par le serveur à l'envoi, dans la requête d'écriture elle-même, avec la date du jour à Paris du serveur : une location dont la date de fin a été retirée ou reportée dans un autre onglet entre l'affichage et l'envoi n'est pas archivée. La date d'archivage est l'instant de l'envoi, affiché comme une date à `Europe/Paris`. Une page plutôt qu'un bouton direct, bien que l'opération se défasse, parce qu'elle fait quitter le tableau de bord à la location et suspend tout ce qu'on peut en faire.
- **Restaurer** : depuis le détail d'une location archivée, un bouton `Restaurer la location`, sans page de confirmation (l'opération se défait en archivant de nouveau). La date d'archivage est retirée ; la location retrouve sa place au tableau de bord, selon son statut et l'ordre de R35 de la spécification 03 ; ses quittances sont intactes.
- **Supprimer définitivement** : depuis le détail d'une location archivée, le lien `Supprimer définitivement` mène à `/locations/<id>/supprimer`, page de confirmation qui nomme la location et annonce le nombre de ses quittances ; l'envoi en POST efface tout (R19). Le nombre affiché est celui lu à l'affichage ; la suppression emporte les quittances présentes à l'instant de l'envoi. Aucune requête GET n'archive, ne restaure ni ne supprime.
- **État inapplicable** : quand une page ou une action ne s'applique pas à l'état d'archivage de la location de son propriétaire, **rien n'est écrit et la réponse est une redirection vers `/locations/<id>`**, dont le contenu montre l'état réel. Cela vaut pour : `/locations/<id>/modifier`, `/fin`, `/archiver`, `/quittances/nouvelle` et leurs actions, ainsi que la réouverture, sur une location archivée ; `/locations/<id>/archiver` et son action sur une location en cours ; `/quittances/<q>/supprimer` et son action quand la location de la quittance est archivée ; `/locations/<id>/supprimer` et son action sur une location active qui a au moins une quittance (R43) ; la restauration sur une location active. Il n'y a ni message d'erreur ni écran « introuvable » : la location existe et appartient au demandeur. Pour `/archiver` demandée de bonne foi sur une location en cours (adresse gardée en favori), aucun message supplémentaire n'est nécessaire : le détail où l'on arrive porte lui-même la phrase qui explique qu'il faut d'abord que la location soit terminée. Chaque écriture porte elle-même la condition d'état dans sa requête : entre deux onglets, c'est l'état en base à l'instant de l'écriture qui décide.
- Cas « déjà là » qui en découlent : archiver une location en cours n'archive rien ; archiver une location déjà archivée ne change pas sa date d'archivage ; restaurer une location active ne change rien ; supprimer définitivement une location restaurée entre-temps ne supprime rien si elle a des quittances ; chaque fois, arrivée sur le détail. Supprimer définitivement une location déjà supprimée : « Location introuvable ».
- Pour un autre compte, toutes ces adresses et actions donnent « Location introuvable » (R5 de la spécification 03), à l'identique d'un identifiant inconnu, que la location soit archivée ou non, qu'elle ait ou non des quittances : le contrôle d'appartenance précède celui de l'état, et rien ne révèle ni l'état ni le nombre de quittances.

**R41 — Page « Archives ».** `/archives` liste toutes les locations archivées du propriétaire, la plus récemment archivée d'abord, sans pagination, recherche ni tri (au plus 100, R39). Chaque ligne affiche, dans cet ordre : l'adresse, suivie d'une virgule et du complément s'il existe, lien vers `/locations/<id>` et seul lien de la ligne ; le code postal et la ville ; le nom du locataire ; `Archivée le JJ/MM/AAAA` ; le nombre de quittances (`Aucune quittance`, `1 quittance`, `N quittances`). Sans location archivée, la page affiche son état vide (« Contenus »). Une liste illisible n'est jamais rendue comme l'état vide (R31 de la spécification 03). Le tableau de bord ne compte et ne montre que les locations actives : un compte dont toutes les locations sont archivées y retrouve l'état vide « Aucune location pour l'instant », le lien `Archives` restant présent.

**R42 — Données de l'archivage (contrat de la tâche T3).** Une location gagne une information, la date d'archivage, absente tant qu'elle est active, renseignée par le système, jamais par un champ de formulaire. Effet sur les fonctions d'accès de R8 de la spécification 03 :

- **lister** (tableau de bord) ne renvoie que les locations actives ; une nouvelle fonction liste les locations archivées, avec pour chacune sa date d'archivage et son nombre de quittances ;
- **lire une location** renvoie la location qu'elle soit archivée ou non, avec sa date d'archivage : c'est l'appelant qui applique R39 et R40 ;
- **modifier, fixer la date de fin, rouvrir** n'écrivent que sur une location active ; **produire** et **supprimer une quittance** aussi ;
- trois fonctions nouvelles, **archiver**, **restaurer**, **supprimer définitivement** ; archiver reçoit la date du jour à Paris et n'écrit que sur une location active dont la date de fin existe et lui est strictement antérieure, cette condition étant dans la requête ; supprimer définitivement efface une location archivée avec ses quittances, ou une location active qui n'a aucune quittance (R43), en une opération atomique où la condition est évaluée par l'écriture elle-même ; elle remplace la suppression sans condition de la spécification 03 ;
- chaque écriture distingue trois résultats : faite ; introuvable (identique pour une location inexistante et pour celle d'un autre compte) ; état inapplicable (seulement pour le propriétaire de la location) ;
- **créer** compte les locations archivées dans la limite de 100 ;
- **la base garantit elle-même l'invariant de R39** : elle refuse une location archivée sans date de fin, et une location archivée dont la date de fin n'est pas strictement antérieure au jour, à `Europe/Paris`, de son archivage. Le statut « terminée » dépend de la date du jour et ne s'exprime pas tel quel dans une contrainte, mais cette forme, qui ne dépend que de deux valeurs enregistrées, lui équivaut pour une location archivée.

Toutes reçoivent le propriétaire en premier argument et filtrent sur lui dans la requête.

**R43 — Suppression directe d'une location sans quittance (décision de l'utilisateur sur Q15).** Une location active qui n'a **aucune quittance** peut être supprimée définitivement sans passer par l'archivage, quel que soit son statut : en cours ou terminée, avec ou sans date de fin, bail commencé ou à venir. Ici « supprimer » efface réellement, comme dans la spécification 03. Les trois cas :

| Location | Suppression définitive |
| --- | --- |
| Active, sans quittance | directe, depuis son détail, après la page de confirmation ; arrivée sur `/tableau-de-bord` |
| Active, avec au moins une quittance | impossible directement ; elle doit être terminée, archivée, puis supprimée depuis les archives |
| Archivée, avec ou sans quittance | depuis les archives (R40), inchangée ; arrivée sur `/archives` |

Conséquence voulue, et non un oubli : une location dont on supprime toutes les quittances une à une (R18) redevient supprimable directement ; chacune de ces suppressions passe par sa propre confirmation.

**Ce que montre le détail d'une location active**, dans le groupe des actions, après `Modifier` et le lien de fin :

| | Sans quittance | Avec au moins une quittance |
| --- | --- | --- |
| **En cours** | lien `Supprimer` ; phrase A | ni `Archiver` ni `Supprimer` ; phrases A puis B |
| **Terminée** | liens `Archiver` puis `Supprimer` ; aucune phrase | lien `Archiver` ; phrase B |

Phrase A : `Une location ne peut être archivée qu'une fois terminée, c'est-à-dire le lendemain de sa date de fin.` Phrase B : `Une location qui a des quittances ne peut pas être supprimée directement. Archivez-la, puis supprimez-la depuis les archives.` Le lien `Supprimer` est celui de la spécification 03 : même libellé, même apparence destructive petite, même cible `/locations/<id>/supprimer`.

**La page `/locations/<id>/supprimer` sert deux situations** (« Contenus ») : une location active sans quittance, une location archivée. Commun : titre, `h1`, première phrase, rappel, bouton `Supprimer définitivement`, lien `Annuler` vers le détail, envoi en POST. Différent : la phrase finale, l'annonce du nombre de quittances (seulement pour une location archivée qui en a) et l'arrivée.

**Contrôle à l'écriture.** La condition « aucune quittance » fait partie de l'opération de suppression elle-même ; elle n'est jamais établie par une lecture préalable. Cas à ne pas rater : un onglet affiche la page de confirmation d'une location sans quittance, un autre onglet y produit une quittance, puis le premier confirme. **La location n'est pas supprimée et la quittance ne disparaît pas** : c'est l'état inapplicable de R40, le propriétaire arrive sur le détail, où la quittance figure et où le lien `Supprimer` a laissé place à la phrase B. Si la production et la suppression partent au même instant, exactement l'une des deux aboutit : soit la location est supprimée et la production répond « Location introuvable », soit la quittance est produite et la suppression est sans effet.

**Garantie exigée de la base.** Effacer la ligne d'une location ne doit jamais emporter silencieusement ses quittances : la base **refuse** d'effacer une location qui a encore une quittance. La suppression définitive d'une location archivée efface donc explicitement ses quittances, puis la location, dans la même transaction. Un chemin de code qui oublierait la condition de R43 obtient ainsi une erreur de la base, pas une perte de documents. Cette garantie ne doit pas empêcher la disparition d'un compte avec tout ce qu'il possède (R20) ; le moyen appartient au développeur.

## Contenus

À reprendre mot pour mot, avec l'apostrophe droite. Les textes évitent deux-points, point-virgule, point d'interrogation et point d'exclamation.

### Page `/tableau-de-bord`

Inchangée, à un ajout près : sous la phrase « Connecté en tant que », dans un élément distinct, deux liens de texte, dans cet ordre : `Mes informations` vers `/mes-informations`, puis `Archives` vers `/archives`. Ils sont toujours présents, que les informations soient renseignées ou non, qu'il existe des archives ou non. Les listes ne montrent que les locations actives (R41).

### Page `/mes-informations`

- Titre du document : `Mes informations — Quittances` ; `h1` : `Mes informations`
- Introduction (`text-secondary`) : `Votre nom et votre adresse figurent sur les quittances que vous produisez. Une quittance déjà produite garde les informations du jour de sa production.`
- Un groupe nommé `Le bailleur` :

| Libellé | Texte d'aide |
| --- | --- |
| `Nom du bailleur` | `Prénom et nom, ou dénomination pour une société. Pour plusieurs bailleurs, indiquez tous les noms.` |
| `Adresse` | aucun |
| `Complément d'adresse (facultatif)` | `Bâtiment, étage, numéro d'appartement.` |
| `Code postal` | aucun |
| `Ville` | aucun |

- Bouton d'envoi (primaire) : `Enregistrer mes informations` ; en attente `Enregistrement en cours`
- Lien `Annuler` vers `/tableau-de-bord`

### Page `/locations/<id>` : location active

- **Section « Quittances »**, placée entre « Le loyer et le bail » et « Actions » :
  - Titre `h2` `Quittances`, accompagné du lien `Produire une quittance` vers `/locations/<id>/quittances/nouvelle`, toujours présent.
  - Sans quittance : `Aucune quittance pour cette location.`
  - Sinon, une ligne par quittance, mois le plus récent d'abord, avec dans cet ordre : le mois (`Octobre 2026`) ; `Du 01/10/2026 au 31/10/2026` ; le total suivi de `charges comprises` ; `Payé le 03/10/2026` ; `Référence 2026-10-3F9A1C2E` ; le lien `Télécharger` (nom accessible `Télécharger la quittance, octobre 2026`) vers `/quittances/<q>/pdf` ; le lien `Supprimer` (nom accessible `Supprimer la quittance, octobre 2026`) vers `/quittances/<q>/supprimer`. Les valeurs sont celles figées dans la quittance.
- **Actions**, dans cet ordre : `Modifier` ; `Mettre fin à la location` ou `Modifier la fin de la location` ; puis, selon les quatre cas de R43 : le lien `Archiver` vers `/locations/<id>/archiver` si la location est **terminée** ; le lien `Supprimer` vers `/locations/<id>/supprimer` si elle n'a **aucune quittance** ; et, sous les liens, en `text-secondary`, la phrase A `Une location ne peut être archivée qu'une fois terminée, c'est-à-dire le lendemain de sa date de fin.` si elle est **en cours**, puis la phrase B `Une location qui a des quittances ne peut pas être supprimée directement. Archivez-la, puis supprimez-la depuis les archives.` si elle a **au moins une quittance**.

### Page `/locations/<id>` : location archivée

Même titre de document, même `h1`, même chip de statut, mêmes trois groupes d'informations. Différences :

- Lien en haut de page : `Retour aux archives` vers `/archives`, à la place de `Retour au tableau de bord`.
- Sous le `h1`, un bandeau : `Location archivée le JJ/MM/AAAA. Elle n'apparaît plus au tableau de bord et ne peut plus être modifiée. Restaurez-la pour la modifier ou produire une quittance.`
- Section « Quittances » : pas de lien `Produire une quittance` ; chaque ligne garde `Télécharger` et n'a pas de lien `Supprimer`.
- Actions, dans cet ordre : bouton `Restaurer la location` (en attente `Restauration en cours`) ; lien `Supprimer définitivement` vers `/locations/<id>/supprimer`. Ni `Modifier`, ni lien de fin, ni `Archiver`.

### Page `/locations/<id>/quittances/nouvelle`

- Titre du document : `Produire une quittance — Quittances` ; `h1` : `Produire une quittance`
- Rappel (`text-secondary`) : l'adresse et le complément, le code postal et la ville, le nom du locataire (comme sur la page de date de fin)
- **Bloc « Informations manquantes »** : texte `Avant de produire votre première quittance, renseignez votre nom et votre adresse. Ils figureront sur le document.` ; lien `Renseigner mes informations` vers `/mes-informations` ; lien `Annuler` vers `/locations/<id>`. Aucun formulaire.
- **Bloc « Bail à venir »** : texte `Le bail commence le JJ/MM/AAAA. Aucune quittance ne peut être produite avant ce mois.` ; lien `Retour à la location`.
- **Bloc « Rien à produire »** : texte `Tous les mois écoulés de cette location ont déjà une quittance.` ; lien `Retour à la location`.
- **Formulaire** :
  - Introduction : `Le nom et l'adresse du bailleur, le nom du locataire et l'adresse du logement sont copiés dans la quittance tels qu'ils sont enregistrés aujourd'hui.`
  - `Mois` (liste déroulante, R25), sans texte d'aide
  - `Loyer hors charges`, texte d'aide `Montant reçu pour ce mois, en euros. Modifiez-le si le mois est incomplet ou si le loyer a changé.`
  - `Charges`, texte d'aide `Montant reçu pour ce mois, en euros. Saisissez 0 s'il n'y a pas de charges.`
  - `Date du paiement`, texte d'aide `Jour où vous avez reçu le paiement.`
  - Case `Je confirme avoir reçu en totalité le loyer et les charges indiqués ci-dessus pour ce mois.`, texte d'aide `Une quittance atteste un paiement complet. Si le paiement est partiel, ne produisez pas de quittance.`
  - Bouton d'envoi (primaire) : `Produire la quittance` ; en attente `Production en cours`
  - Lien `Annuler` vers `/locations/<id>`

### Page `/locations/<id>/archiver`

- Titre du document : `Archiver la location — Quittances` ; `h1` : `Archiver cette location`
- Texte : `Vous allez archiver la location suivante.`
- Rappel : l'adresse (et le complément), le code postal et la ville, le nom du locataire
- Texte (`text-secondary`) : `La location quitte le tableau de bord et rejoint les archives avec ses quittances, qui restent téléchargeables. Rien n'est effacé et vous pourrez la restaurer à tout moment.`
- Bouton (primaire) : `Archiver la location` ; en attente `Archivage en cours`
- Lien `Annuler` vers `/locations/<id>`

### Page `/locations/<id>/supprimer` (location active sans quittance, ou location archivée)

Commun aux deux situations, et inchangé par rapport à la spécification 03 :

- Titre du document : `Supprimer la location — Quittances` ; `h1` : `Supprimer cette location`
- Texte : `Vous allez supprimer définitivement la location suivante.`
- Rappel : l'adresse (et le complément), le code postal et la ville, le nom du locataire
- Bouton destructif : `Supprimer définitivement` ; en attente `Suppression en cours`
- Lien `Annuler` vers `/locations/<id>`
- Pas de bouton primaire.

Propre à une **location active sans quittance** : aucune phrase sur les quittances ; texte (`text-secondary`) de la spécification 03, inchangé, `Cette action est irréversible. Pour conserver la location sans la supprimer, mettez-y fin.` ; arrivée sur `/tableau-de-bord`.

Propre à une **location archivée** : seulement si elle a au moins une quittance, entre le rappel et le texte final, pour une quittance `Cette location a 1 quittance. Elle sera supprimée avec la location.`, pour N quittances, N valant 2 ou plus, `Cette location a N quittances. Elles seront supprimées avec la location.` ; texte (`text-secondary`) `Cette action est irréversible. Pour conserver la location et ses quittances, laissez-la dans les archives.` ; arrivée sur `/archives`.

### Page `/archives`

- Titre du document : `Archives — Quittances` ; `h1` : `Archives`
- Lien en haut de page : `Retour au tableau de bord`
- Introduction (`text-secondary`) : `Les locations archivées sont conservées ici avec leurs quittances. Ouvrez une location pour télécharger ses quittances, la restaurer ou la supprimer définitivement.`
- État vide : `Aucune location archivée.`
- Sinon la liste de R41.

### Page `/quittances/<q>/supprimer`

- Titre du document : `Supprimer la quittance — Quittances` ; `h1` : `Supprimer cette quittance`
- Texte : `Vous allez supprimer définitivement la quittance suivante.`
- Rappel : le mois et la période (`Octobre 2026, du 01/10/2026 au 31/10/2026`) ; l'adresse du logement, le code postal et la ville ; le nom du locataire ; le total ; la référence. Valeurs figées.
- Texte (`text-secondary`) : `Cette action est irréversible. Si vous avez déjà remis cette quittance à votre locataire, la supprimer ici ne la lui retire pas. Vous pourrez produire une nouvelle quittance pour ce mois.`
- Bouton destructif : `Supprimer définitivement` ; en attente `Suppression en cours`
- Lien `Annuler` vers `/locations/<id>` de la location de la quittance
- Pas de bouton primaire.

### Écran « Quittance introuvable »

Titre du document `Quittance introuvable — Quittances` ; `h1` `Quittance introuvable` ; texte `Cette quittance n'existe pas ou a été supprimée.` ; lien `Retour au tableau de bord`. Rien d'autre. En-tête complet sur les pages ; non exigé dans la réponse du Route Handler (R33).

### Messages d'erreur

| Code | Emplacement | Condition | Texte |
| --- | --- | --- | --- |
| B1 | sous « Nom du bailleur » | vide | `Saisissez le nom du bailleur.` |
| B2 | sous « Nom du bailleur » | plus de 100 caractères | `Le nom du bailleur ne peut pas dépasser 100 caractères.` |
| B3 | sous « Adresse » (bailleur) | vide | `Saisissez votre adresse.` |
| L2, L3, L4, L5, L6, L7, L25 | sous le champ concerné (bailleur) | conditions de la spécification 03 | textes de la spécification 03 |
| Q1 | sous « Mois » | vide ou mal formé (R10) | `Choisissez un mois.` |
| Q2 | sous « Mois » | bien formé mais refusé par R8 | `Ce mois ne peut pas faire l'objet d'une quittance pour cette location.` |
| Q3 | sous « Mois » | une quittance existe déjà (R15) | `Une quittance existe déjà pour ce mois. Supprimez-la depuis la page de la location pour en produire une nouvelle.` |
| L12 à L16 | sous le champ de montant concerné | conditions de la spécification 03 | textes de la spécification 03 |
| Q4 | sous « Date du paiement » | vide | `Saisissez la date du paiement.` |
| L20, L21 | sous « Date du paiement » | conditions de la spécification 03 | textes de la spécification 03 |
| Q5 | sous « Date du paiement » | postérieure à la date du jour à Paris | `La date du paiement ne peut pas être dans le futur.` |
| Q6 | sous la case | non cochée | `Cochez la case pour confirmer que le loyer et les charges ont été reçus en totalité.` |
| Q7 | message de formulaire | informations du bailleur absentes (R4) | `Renseignez vos informations de bailleur avant de produire une quittance.` |
| Q8 | message de formulaire | location non affichable (R17) | `Le nom du locataire ou l'adresse du logement contient des caractères que la quittance ne peut pas afficher. Modifiez la location puis réessayez.` |
| Q9 | message de formulaire | informations du bailleur non affichables (R17) | `Vos informations de bailleur contiennent des caractères que la quittance ne peut pas afficher. Modifiez-les puis réessayez.` |
| E8 | message de formulaire | panne | texte de la spécification 02 |

Ordre pour un même champ : vide, puis forme, puis bornes, puis Q5 ou Q2. Q7 est contrôlé avant tout champ. Q8, Q9 puis Q3 ne sont contrôlés que si tous les champs sont valides. L'archivage n'ajoute aucun message : un état inapplicable est une redirection (R40).

## Parcours utilisateur

### 1. Renseigner ses informations

1. Sur `/tableau-de-bord`, le propriétaire active `Mes informations` : la page s'affiche sans rechargement du document. **État vide** : cinq champs vides, aucun message, aucun champ focalisé.
2. Il remplit et envoie. **Attente** : « Enregistrement en cours ». **Succès** : il arrive sur `/tableau-de-bord`.
3. **Erreurs** : messages sous les champs, valeurs conservées, focus sur le premier champ en erreur. **Panne** : E8, rien n'est écrit.
4. Il revient sur la page : les champs sont préremplis avec les valeurs normalisées.

### 2. Produire une quittance

1. Sur le détail d'une location, section « Quittances » : **état vide** `Aucune quittance pour cette location.` Il active `Produire une quittance`.
2. **Pas encore fait** : sans informations de bailleur, le bloc « Informations manquantes » remplace le formulaire ; `Renseigner mes informations` mène au parcours 1, après quoi il revient à la location par le tableau de bord.
3. Sinon le formulaire s'affiche : mois le plus récent sélectionné, montants de la location préremplis, date vide, case décochée.
4. Il choisit le mois, corrige au besoin les montants, saisit la date, coche la case, envoie. **Attente** : « Production en cours ».
5. **Succès** : il arrive sur le détail, où la quittance figure dans la section, mois le plus récent d'abord.
6. **Erreurs** : messages sous les champs, case décochée. **Déjà fait** : Q3. **Panne** : E8, rien n'est écrit.

### 3. Télécharger

Il active `Télécharger` : le navigateur enregistre `quittance-2026-10-3f9a1c2e.pdf` et la page reste affichée. Il peut recommencer ; le contenu ne change pas, même après modification de la location ou de ses informations.

### 4. Corriger une erreur

`Supprimer` sur la ligne : la page de confirmation décrit la quittance. `Annuler` ramène au détail, rien n'est supprimé. `Supprimer définitivement` ramène au détail, sans la ligne ; le mois est de nouveau proposé à la production ; l'ancienne adresse du PDF répond « Quittance introuvable ».

### 5. Archiver, retrouver, restaurer, supprimer définitivement

1. Une location sans quittance se supprime directement : `Supprimer` sur son détail, page de confirmation, arrivée sur `/tableau-de-bord`. Dès qu'elle a une quittance, ce lien disparaît et une phrase renvoie à l'archivage. Sur le détail d'une location en cours, pas de lien d'archivage : une phrase dit qu'elle doit d'abord être terminée. Il y met fin avec une date passée (parcours 3 de la spécification 03). Sur le détail de la location terminée, `Archiver` : la page d'archivage explique que rien n'est effacé. `Annuler` ramène au détail. `Archiver la location` : arrivée sur `/tableau-de-bord`, la location n'y figure plus.
2. `Archives` sur le tableau de bord : la location y est, avec sa date d'archivage et son nombre de quittances. **État vide** : `Aucune location archivée.`
3. Il ouvre la location : bandeau, quittances téléchargeables, ni modification ni production.
4. `Restaurer la location` : arrivée sur le détail, sans bandeau ; la location est de retour au tableau de bord avec ses quittances.
5. Ou `Supprimer définitivement` : la page de confirmation annonce le nombre de quittances. Après confirmation, arrivée sur `/archives` ; les adresses de la location et de ses quittances répondent « introuvable ».

### 6. Introuvable, sans session, états communs

- Quittance d'un autre compte, supprimée, inconnue ou mal formée : « Quittance introuvable », toujours la même réponse, code 404.
- Sans session : les pages redirigent vers `/connexion?retour=…`, le téléchargement vers `/connexion` ; aucun contenu protégé n'est reçu.
- **Chargement** : aucun (rendu d'un bloc). **Panne** : écran « Service momentanément indisponible » sur les pages, E8 sur les formulaires, 503 pour le téléchargement. **Sans JavaScript** : tous les parcours aboutissent, téléchargement compris.

## Critères d'acceptation

[V] Vitest, sans base ni navigateur ; [I] test d'intégration contre la base de test ; [N] navigateur (Playwright, projets `bureau` et `mobile`) ; [C] ligne de commande ou lecture du dépôt. « A » et « B » sont deux comptes créés par le test. « Location type » : bail du 15/01/2026 au 20/03/2026, loyer 850,00 €, charges 50,00 €. « Bailleur type » : `Marie Durand`, `3 rue de la Paix`, sans complément, `75002`, `Paris`. « Mention de réserve » : les deux phrases du bloc 12 de R27.

### Données et isolation

- **CA1** [C] Étant donné la base de test dans l'état de la spécification 03, quand on applique les migrations par la commande documentée, alors elle réussit sans toucher aux comptes ni aux sessions, et les locations existantes sont intactes et actives ; relancée, elle ne modifie rien.
- **CA2** [I] Étant donné A et B sans informations de bailleur, quand A enregistre `  Marie   Durand `, `3 rue de la Paix`, un complément vide, `75 002`, ` Paris ` puis les relit, alors il obtient `Marie Durand`, `3 rue de la Paix`, aucun complément, `75002`, `Paris` ; un second enregistrement les remplace ; B lit toujours « absentes » et son propre enregistrement ne change pas celles de A ; chaque fonction de R23 et de R42 appelée sans propriétaire ou avec un identifiant vide échoue sans qu'aucune requête ne parte.
- **CA3** [I] Étant donné A avec le bailleur type et la location type, quand il produit la quittance de 2026-01 avec 42550 et 0 centimes, un paiement le 2026-01-20 et l'instant fourni 2026-10-31T23:30:00Z, alors la quittance relue porte le mois, la période du 15/01/2026 au 31/01/2026, les cinq valeurs du bailleur, le nom du locataire, les quatre valeurs du logement, les deux montants, la date du paiement et la date d'émission `2026-11-01` (le jour à Paris, alors que c'est encore le 31 octobre en UTC), et la liste de la location la contient seule ; la location garde ses montants ; quand A modifie ensuite tous les champs de la location, lui retire sa date de fin et remplace ses informations de bailleur, alors la quittance relue est identique champ par champ.
- **CA4** [I] Étant donné une location et une quittance de A, quand B produit une quittance en fournissant l'identifiant de la location de A, puis lit, liste, compte et supprime en fournissant les identifiants de A, alors chaque appel renvoie le même résultat que pour un identifiant aléatoire inconnu, aucune quittance n'est créée chez A ni chez B, et la quittance de A relue est identique.
- **CA5** [I] Étant donné une quittance de A pour une location et 2026-01, quand A en produit une seconde pour la même location et le même mois, alors le résultat est « déjà existante » et la première est intacte ; quand deux productions partent en même temps pour 2026-02, alors exactement une réussit ; quand on insère directement en base un doublon, alors la base refuse ; une quittance pour 2026-01 sur une autre location de A réussit ; après suppression de la première, la production pour 2026-01 réussit de nouveau.
- **CA6** [I] Étant donné A sans informations de bailleur, quand il produit une quittance, alors le résultat est « informations absentes » et rien n'est créé ; et quand on tente d'écrire directement en base un loyer de 0, des charges négatives, une période dont la fin précède le début, une période qui déborde de son mois, une date de paiement postérieure à la date d'émission, une quittance sans propriétaire ou sans location, alors la base refuse chaque écriture.
- **CA7** [I] Étant donné A avec deux locations ayant chacune deux quittances, dont les noms de locataire et de bailleur sont uniques au test, quand A archive puis supprime définitivement la première location, qui est terminée, alors ses deux quittances n'existent plus, le nom et l'adresse e-mail de son locataire ne figurent plus nulle part dans la base et les quittances de l'autre location sont intactes ; quand la ligne de compte de A est supprimée de la base de test, alors ses informations de bailleur, ses locations archivées ou non et ses quittances n'existent plus et celles de B sont intactes.

### Règles pures

- **CA8** [V] Étant donné la règle des mois acceptés, quand on lui donne chaque ligne de la table de R8, alors elle rend exactement les mois indiqués, quel que soit le fuseau du processus (`UTC`, `America/Los_Angeles`, `Pacific/Kiritimati`).
- **CA9** [V] Étant donné la règle de période, quand on lui donne chaque ligne de la table de R9, alors elle rend le début, la fin et le caractère complet ou incomplet indiqués.
- **CA10** [V] Étant donné la lecture du mois et les libellés, quand on soumet chaque valeur de R10, alors les mal formées donnent Q1 et `2026-10` est lu ; 2026-10 donne `Octobre 2026` et `octobre 2026`, 2026-08 `Août 2026`, 2026-02 `Février 2026` ; l'option d'une période incomplète est `Janvier 2026 (du 15/01/2026 au 31/01/2026)`.
- **CA11** [V] Étant donné l'identifiant `3f9a1c2e-7b4d-4e8a-9c1f-0a2b3c4d5e6f` et le mois 2026-10, alors la référence est `2026-10-3F9A1C2E` et le nom de fichier `quittance-2026-10-3f9a1c2e.pdf` ; pour tout identifiant de la forme de R6 de la spécification 03, le nom de fichier ne contient que des lettres minuscules sans accent, des chiffres, des tirets et un point.
- **CA12** [V] Étant donné la validation des informations du bailleur, quand on lui soumet cinq valeurs vides, alors elle rend B1, B3, L4, L6 et aucune erreur pour le complément ; chaque champ à sa longueur maximale est accepté et refusé avec un caractère de plus (B2, L2, L3, L7) ; `7501` donne L5 ; une valeur contenant U+202E donne L25 ; les valeurs de CA2 sont normalisées comme indiqué.
- **CA13** [V] Étant donné la validation du formulaire de production pour la location type et un instant fourni, quand on soumet chaque ligne de la table de R15 de la spécification 03 au loyer puis aux charges, alors les résultats sont ceux de cette table ; les quatre cas de la table de R13 donnent les résultats indiqués ; à l'instant 2026-10-12T10:00:00Z, `2026-10-25` donne Q5 et `2026-10-12` est acceptée ; une date vide donne Q4, `2026-02-30` L20, `1949-12-31` L21 ; la case absente donne Q6 ; le mois `2026-04` donne Q2 ; tout envoyer vide donne Q1, L12, L16, Q4 et Q6 à la fois.
- **CA14** [V] Étant donné une quittance figée (bailleur type, locataire `Paul Martin`, logement `12 rue des Lilas`, `Bât. B`, `69003 Lyon`, mois 2026-01, période du 15/01/2026 au 31/01/2026, 42550 et 0 centimes, paiement le 20/01/2026, émission le 12/10/2026, référence `2026-01-3F9A1C2E`), quand on demande son contenu comme données, alors on obtient les douze blocs de R27 dans l'ordre avec exactement ces textes : `Quittance de loyer` puis `Janvier 2026` ; `Référence 2026-01-3F9A1C2E` ; les blocs du bailleur (sans ligne de complément), du locataire et du logement (avec `Bât. B`) ; `Du 15/01/2026 au 31/01/2026` ; `Loyer hors charges` à `425,50 €`, `Provisions pour charges` à `0,00 €`, `Total` à `425,50 €` ; la phrase `Reçu de Paul Martin la somme de 425,50 € au titre du loyer et des charges du logement désigné ci-dessus, pour la période du 15/01/2026 au 31/01/2026. Le bailleur en donne quittance au locataire.` ; `Paiement reçu le 20/01/2026` ; `Fait à Paris, le 12/10/2026` ; `Le bailleur` puis `Marie Durand` ; la mention de réserve mot pour mot ; aucun bloc ne contient le libellé `Charges` seul ; et le titre de R30 est `Quittance de loyer, janvier 2026`.

### Document PDF

- **CA15** [V] Étant donné la quittance de CA14 et un instant de production fourni, quand on construit le PDF, alors le fichier a une seule page au format A4 portrait ; son texte extrait contient, dans cet ordre, tous les textes de CA14, du titre et de `Janvier 2026` jusqu'à la mention de réserve, qui vient en dernier ; ses métadonnées portent le titre `Quittance de loyer, janvier 2026`, l'auteur `Marie Durand`, la langue `fr-FR` et pour date de création l'instant fourni ; toutes ses polices sont incorporées ; il ne contient ni `quittances.test`, ni adresse e-mail.
- **CA16** [V] Étant donné une quittance dont tous les textes figés sont à leur longueur maximale et sans espace, les deux montants à 9999999 centimes, et dont le nom du locataire contient `<b>&(x)\%`, quand on construit le PDF, alors il a une seule page ; son texte extrait, une fois toutes les espaces et tous les sauts de ligne retirés, contient chaque texte figé en entier, sans trait d'union ajouté, dont `<b>&(x)\%` lettre pour lettre, ainsi que `99999,99€` deux fois, `199999,98€` et la mention de réserve en entier.
- **CA17** [V] Étant donné la règle de R17, quand on lui soumet chacun des caractères garantis, alors chacun est affichable, et un PDF construit avec ces caractères répartis dans ses textes figés (dans le respect des longueurs de R1 et de la spécification 03) les contient tous dans son texte extrait ; `Paul 😀`, `王伟`, `محمد` et `דוד` ne sont pas affichables.
- **CA18** [V] Étant donné la même quittance figée, quand on construit le PDF deux fois à des instants différents, alors les deux fichiers ont le même texte extrait, le même nombre de pages et les mêmes métadonnées, date de création comprise.

### Informations du bailleur et tableau de bord

- **CA19** [N] Étant donné un compte neuf, quand il ouvre `/tableau-de-bord`, alors les liens `Mes informations` puis `Archives` suivent la phrase « Connecté en tant que » et la page a quatre liens (logo, `Mes informations`, `Archives`, `Ajouter une location`) ; quand il active `Mes informations`, alors `/mes-informations` s'affiche sans requête de document, avec le titre, le `h1`, l'introduction, le groupe, les cinq libellés, les textes d'aide et les attributs `autocomplete` de « Contenus » et de R35, les champs vides, aucun champ focalisé, aucun lien vers elle-même ; quand il envoie les valeurs de CA2, alors il arrive sur `/tableau-de-bord` ; quand il rouvre la page, alors les champs contiennent les valeurs normalisées ; quand il enregistre sans rien changer, alors il arrive de nouveau sur `/tableau-de-bord`.
- **CA20** [N] Étant donné `/mes-informations`, quand on envoie le formulaire vide, alors on reste sur la page, B1, B3, L4 et L6 sont sous leurs champs, le focus est sur « Nom du bailleur », aucune bulle native n'apparaît et rien n'est enregistré ; quand on envoie ensuite des valeurs valides sauf `7501`, alors seul L5 reste et chaque champ contient ce qui a été saisi.
- **CA21** [N] Étant donné A et B connectés chacun dans son contexte, A ayant ses informations, quand B envoie le formulaire en y ajoutant, sous tout nom de champ plausible, l'identifiant du compte de A, alors les informations enregistrées sont celles de B ; `/mes-informations` de A affiche toujours les siennes ; et ni le nom ni l'adresse de l'un ne figurent dans le code source d'une page de l'autre.

### Production

- **CA22** [N] Étant donné un compte sans informations de bailleur et une location, quand il ouvre le détail puis active `Produire une quittance`, alors le détail affichait le `h2` `Quittances` entre « Le loyer et le bail » et « Actions » avec `Aucune quittance pour cette location.`, et la page de production affiche le bloc « Informations manquantes » de « Contenus », sans formulaire ; `Renseigner mes informations` mène à `/mes-informations` sans requête de document.
- **CA23** [N] Étant donné le bailleur type et la location type, quand le propriétaire ouvre la page de production, alors le titre, le `h1`, le rappel, l'introduction, les libellés (dont `Charges`), les textes d'aide et le bouton sont ceux de « Contenus » ; la liste propose exactement `Mars 2026 (du 01/03/2026 au 20/03/2026)`, `Février 2026` et `Janvier 2026 (du 15/01/2026 au 31/01/2026)`, dans cet ordre, le premier sélectionné ; les montants contiennent `850,00` et `50,00` ; la date est vide, la case décochée, aucun champ focalisé ; `Annuler` ramène au détail sans rien créer.
- **CA24** [N] Étant donné cette page, quand on choisit janvier, saisit `425,5` et `0`, la date `2026-01-20`, coche la case et envoie, alors on arrive sur `/locations/<id>` ; la section « Quittances » a une ligne avec `Janvier 2026`, `Du 15/01/2026 au 31/01/2026`, `425,50 € charges comprises`, `Payé le 20/01/2026`, une référence de la forme `2026-01-` suivie de huit caractères hexadécimaux en majuscules, et les liens `Télécharger` et `Supprimer` avec les noms accessibles de « Contenus » ; le détail affiche toujours un loyer de `850,00 €` ; quand on rouvre la page de production, alors janvier n'est plus proposé ; quand on produit ensuite mars, alors sa ligne précède celle de janvier.
- **CA25** [N] Étant donné la page de production, quand on envoie sans cocher la case, avec `850,555` pour le loyer, les charges vides et la date `2099-12-31`, alors on reste sur la page ; L13, L16, Q5 et Q6 sont sous leurs champs ; le focus est sur « Loyer hors charges » ; les trois valeurs saisies et le mois choisi sont conservés ; la case est décochée ; aucune quittance n'est créée.
- **CA26** [N] Étant donné la page de production ouverte dans deux onglets du même compte, quand le premier produit février puis le second envoie février, alors le second affiche Q3 sous « Mois » et la location n'a qu'une quittance pour février ; et étant donné une réponse retardée par le test, quand on active deux fois de suite le bouton d'envoi, alors il affiche `Production en cours`, est indisponible, et une seule quittance est créée.
- **CA27** [N] Étant donné une location dont le bail commence le 01/01/2099, quand son propriétaire ouvre la page de production, alors elle affiche le bloc « Bail à venir » avec `01/01/2099` et aucun formulaire ; étant donné une location au bail du 10/03/2026 au 20/03/2026 qui a déjà sa quittance de mars, alors la page affiche le bloc « Rien à produire ».
- **CA28** [N] Étant donné le formulaire affiché puis les informations du bailleur retirées de la base par le test, quand on envoie le formulaire valide, alors Q7 s'affiche dans le message de formulaire et rien n'est créé ; étant donné une location dont le nom du locataire est `Paul 😀`, quand on envoie le formulaire valide, alors Q8 s'affiche et rien n'est créé.
- **CA29** [N] Étant donné A et B connectés chacun dans son contexte, avec chacun ses informations et une location, quand B envoie la production de sa location après que le test a remplacé, partout dans la requête d'envoi, l'identifiant de sa location par celui de la location de A, avec des champs valides puis invalides, alors B obtient chaque fois « Location introuvable » et jamais un message de validation, et aucune quittance n'existe chez A ni chez B ; quand B envoie une production légitime en y ajoutant des champs portant l'identifiant du compte de A, un nom de bailleur, un nom de locataire, des dates de période et une date d'émission, alors la quittance créée appartient à B et ne porte que les valeurs lues en base.

### Téléchargement

- **CA30** [N] Étant donné la quittance de CA24, quand son propriétaire active `Télécharger`, alors le navigateur reçoit un téléchargement nommé `quittance-2026-01-<huit caractères hexadécimaux en minuscules>.pdf` et reste sur le détail ; la réponse a le code 200 et les quatre en-têtes de R32 ; le fichier a une page et son texte extrait contient, dans l'ordre, `Quittance de loyer`, `Janvier 2026`, `Marie Durand`, `3 rue de la Paix`, `75002 Paris`, le nom du locataire, l'adresse du logement, `Du 15/01/2026 au 31/01/2026`, `Loyer hors charges`, `425,50 €`, `Provisions pour charges`, `0,00 €`, `Total`, `425,50 €`, `Paiement reçu le 20/01/2026` et la mention de réserve ; quand le propriétaire modifie ensuite le loyer, le nom du locataire, l'adresse du logement et toutes ses informations de bailleur puis télécharge de nouveau, alors le texte extrait et les métadonnées sont identiques à ceux du premier fichier.
- **CA31** [N] Étant donné une quittance existante, quand un visiteur sans session, puis avec un cookie au jeton inventé, puis avec une session expirée, demande `/quittances/<q>/pdf` en GET puis en HEAD, avec son identifiant puis avec un UUID inconnu, alors chaque réponse a le code 307 et `Location: /connexion` sans paramètre, n'a pas le type `application/pdf` et ne contient aucune donnée de la quittance ; quand le propriétaire connecté envoie POST, PUT ou DELETE à cette adresse, alors la réponse a le code 405 et la quittance est intacte.
- **CA32** [N] Étant donné A et B connectés chacun dans son contexte et une quittance de A, quand B demande `/quittances/<x>/pdf` avec pour `<x>` l'identifiant de la quittance de A, un UUID inconnu, l'identifiant de A en majuscules, `1`, `%27%20or%201%3D1` et une chaîne de 5 000 caractères, alors toutes les réponses ont le code 404, un `Cache-Control` contenant `no-store`, un type autre que `application/pdf`, pas d'en-tête `Content-Disposition`, et les textes de « Quittance introuvable » ; la réponse obtenue avec l'identifiant de A et celle obtenue avec l'UUID inconnu sont identiques ; aucune ne contient une donnée de A ; et A télécharge toujours sa quittance.
- **CA33** [N] Étant donné le détail d'une location qui a deux quittances, quand la page est affichée, que chaque lien est survolé puis reçoit le focus, alors aucune requête n'est partie vers une adresse `/quittances/…/pdf` ; les liens `Télécharger` n'ont pas d'attribut `download` ; quand on demande l'adresse d'une quittance supprimée, alors le navigateur affiche « Quittance introuvable » avec le code 404.

### Suppression d'une quittance

- **CA34** [N] Étant donné une quittance, quand son propriétaire active son lien `Supprimer`, alors `/quittances/<q>/supprimer` affiche les textes de « Contenus » et le rappel avec les valeurs figées, sans adresse e-mail ; la quittance existe toujours après cet affichage, un rechargement et le survol de tous les liens ; `Annuler` ramène au détail de sa location, intact.
- **CA35** [N] Étant donné cette page, quand le propriétaire active `Supprimer définitivement`, alors il arrive sur le détail de la location, où la ligne ne figure plus ; son mois est de nouveau proposé à la production ; son adresse de téléchargement et sa page de suppression répondent 404 ; les autres quittances de la location sont intactes ; quand le test rejoue la requête de suppression, alors il obtient « Quittance introuvable ».
- **CA36** [N] Étant donné A et B connectés chacun dans son contexte, avec chacun une quittance, quand B demande `/quittances/<identifiant de A>/supprimer`, alors la réponse a le code 404 et ne diffère de celle d'un UUID inconnu que par l'adresse demandée ; quand B envoie la suppression de sa propre quittance après que le test a remplacé, partout dans la requête, son identifiant par celui de la quittance de A, alors B obtient « Quittance introuvable », la quittance de A se télécharge toujours et celle de B existe toujours.
- **CA37** : remplacé par CA52 (location archivée) et CA57 (location active sans quittance). Le numéro n'est pas réattribué.

### Protection, robustesse, accessibilité et présentation

- **CA38** [N] Étant donné un visiteur sans session, ou avec un cookie au jeton inventé, quand il demande `/mes-informations`, `/archives`, `/locations/<id>/quittances/nouvelle`, `/locations/<id>/archiver`, `/quittances/<q>/supprimer` et `/quittances/<q>`, avec des identifiants existants puis inconnus, alors il aboutit chaque fois sur `/connexion?retour=<chemin encodé>` et aucune réponse ne contient un titre de « Contenus », un libellé de champ, `Quittance introuvable` ni une donnée ; quand B, connecté, demande `/locations/<location de A>/quittances/nouvelle`, alors il obtient « Location introuvable » avec le code 404, à l'identique d'un UUID inconnu.
- **CA39** [N] Étant donné un navigateur dont JavaScript est désactivé, quand un propriétaire qui a la location type (terminée) enregistre ses informations, envoie la production avec une date valide mais sans cocher la case, puis en la cochant, suit le lien `Télécharger`, supprime la quittance, puis archive la location, la restaure, l'archive de nouveau et la supprime définitivement, alors il obtient successivement : le tableau de bord ; Q6 sous la case, avec le mois, les montants et la date conservés ; le détail avec la ligne ; un fichier PDF ; le détail sans la ligne ; le tableau de bord sans la location ; le détail sans bandeau ; le tableau de bord sans la location ; `/archives` sans la location. À aucune étape une valeur saisie n'apparaît dans une adresse.
- **CA40** [N, manipulation manuelle] Étant donné l'application lancée avec une base injoignable et un cookie de session valide, quand on demande `/mes-informations`, `/archives`, la page de production, la page d'archivage et la page de suppression d'une quittance, alors on voit l'écran « Service momentanément indisponible » et jamais un formulaire vide, `Aucune quittance pour cette location.`, `Aucune location archivée.` ni « Quittance introuvable » ; quand on demande l'adresse d'un PDF, alors la réponse a le code 503 sans type `application/pdf` ; étant donné la base coupée après l'affichage d'un formulaire, quand on l'envoie, alors E8 s'affiche, les valeurs sont conservées et rien n'a été écrit une fois la base revenue.
- **CA41** [N] Étant donné `/mes-informations` (vide puis en erreur), le détail d'une location active (sans quittance puis avec deux), le détail d'une location archivée, la page de production (formulaire, formulaire en erreur, chacun des trois blocs), la page de suppression d'une quittance, la page d'archivage, la page de suppression définitive d'une location avec quittances, `/archives` (vide puis remplie) et l'écran « Quittance introuvable », quand on lance une analyse axe avec les règles WCAG 2.1 A et AA, alors elle ne remonte aucune violation sur `bureau` comme sur `mobile` ; chaque page a un seul `h1`, les repères `banner` et `main` et aucun niveau de titre sauté ; la case à cocher a pour nom accessible le libellé de R14.
- **CA42** [N] Étant donné ces mêmes pages à 320, 412, 768 et 1280px de large, avec un bailleur, une location et une quittance dont tous les textes sont à leur longueur maximale sans espace et les montants à 99 999,99 €, quand elles sont chargées, alors il n'y a pas de défilement horizontal ; aucun montant n'est coupé ; les formulaires font 640px de large au plus ; `Produire une quittance` est le seul élément à fond `primary` du détail d'une location active, `Archiver la location` celui de la page d'archivage ; le détail d'une location archivée et les deux pages de suppression n'en ont aucun ; `Supprimer définitivement` de la page de suppression d'une location a une bordure `rgb(239, 68, 68)`, un texte `rgb(185, 28, 28)` et 44px de haut.
- **CA43** [N] Étant donné les parcours 1 à 5 déroulés d'un bout à l'autre, erreurs comprises, quand on observe la console et le réseau, alors la console n'affiche ni erreur ni avertissement ; les liens `Mes informations`, `Archives`, `Produire une quittance`, `Renseigner mes informations`, `Supprimer` d'une location et d'une quittance, `Archiver`, `Retour aux archives`, `Supprimer définitivement` du détail, `Annuler` et `Retour à la location` n'entraînent aucune requête de document ; à la tabulation, la page de production suit l'ordre de R35 avec un indicateur de focus visible ; sur chaque page, la première tabulation atteint le logo.
- **CA44** [N] Étant donné les parcours 1 à 5 déroulés avec un nom de bailleur, un nom de locataire et des adresses uniques au test, dont l'un vaut `<img src=x onerror="window.__xss=1">`, quand on relève toutes les adresses demandées, tous les titres de document et le nom du fichier téléchargé, alors aucun ne contient l'un de ces textes ni un montant ; les textes s'affichent lettre pour lettre sur chaque page, `/archives` comprise, et `window.__xss` n'est jamais défini ; l'adresse e-mail du locataire ne figure ni sur `/archives` ni sur les pages d'archivage et de suppression ; et [C] la sortie du serveur après une erreur de validation et après la panne de CA40 ne contient aucun de ces textes.
- **CA45** [C] Étant donné le dépôt, quand on lance `pnpm lint`, `pnpm build` et `pnpm test`, alors les trois réussissent, `pnpm test` sans base joignable ni accès au réseau ; le build liste `/mes-informations`, `/archives`, la page de production, la page d'archivage, la page de suppression d'une quittance et `/quittances/[id]/pdf` avec un autre symbole que `○`, et `/`, `/connexion`, `/inscription` toujours avec `○` ; et [N] la réponse à chacune des pages nouvelles pour un propriétaire connecté porte un `Cache-Control` contenant `private` ou `no-store`.

### Archivage

- **CA46** [I] Étant donné A avec une location sans date de fin, une location dont la date de fin est le 12/10/2026 et une location dont la date de fin est le 13/10/2026, quand il archive chacune avec la date du jour 12/10/2026, alors chaque appel répond « état inapplicable » et aucune n'est archivée ; quand on écrit directement en base une date d'archivage sur une location sans date de fin, alors la base refuse ; et étant donné A avec une location terminée le 11/10/2026 qui a deux quittances, quand il l'archive avec la date du jour 12/10/2026, alors la liste du tableau de bord ne la contient plus, la liste des archives la contient avec sa date d'archivage et le nombre 2, sa lecture la renvoie avec sa date d'archivage, et ses quittances se lisent toujours ; quand il tente alors de la modifier, de lui fixer une date de fin, de la rouvrir, d'y produire une quittance et de supprimer une de ses quittances, alors chaque appel répond « état inapplicable » et rien n'est écrit ; quand il l'archive de nouveau, alors sa date d'archivage ne change pas ; quand il la restaure, alors elle revient dans la liste du tableau de bord, sans date d'archivage, identique par ailleurs champ par champ, avec ses deux quittances ; quand il restaure cette location active, ou la supprime définitivement alors qu'elle a ses deux quittances, alors chaque appel répond « état inapplicable » et la location et ses quittances sont intactes.
- **CA47** [I] Étant donné une location en cours, une location terminée et une location archivée de A, quand B archive, restaure et supprime définitivement en fournissant chacun de leurs identifiants, puis liste ses archives, alors chaque écriture renvoie le même résultat « introuvable » que pour un identifiant aléatoire inconnu, jamais « état inapplicable », sans distinguer les trois locations ; la liste d'archives de B est vide ; et les trois locations de A, relues, sont identiques champ par champ, date d'archivage et date de dernière modification comprises.
- **CA48** [I] Étant donné A avec 99 locations actives et une archivée, quand il en crée une, alors la création est refusée (limite de 100) ; quand il supprime définitivement la location archivée puis en crée une, alors la création réussit.
- **CA49** [N] Étant donné une location en cours qui a une quittance (sans date de fin, puis avec la date de fin `2099-12-31`), quand son propriétaire ouvre son détail, alors les actions sont `Modifier` et le lien de fin, sans lien `Archiver` ni lien `Supprimer`, et les phrases `Une location ne peut être archivée qu'une fois terminée, c'est-à-dire le lendemain de sa date de fin.` puis `Une location qui a des quittances ne peut pas être supprimée directement. Archivez-la, puis supprimez-la depuis les archives.` sont visibles ; quand il demande `/locations/<id>/archiver`, alors il est redirigé vers ce détail et la location n'est pas archivée ; et étant donné une location terminée avec deux quittances, quand son propriétaire ouvre son détail, alors les actions sont `Modifier`, `Modifier la fin de la location` et `Archiver`, sans lien `Supprimer` propre à la location, sans la première phrase et avec la seconde ; quand il active `Archiver`, alors `/locations/<id>/archiver` affiche les textes de « Contenus » et le rappel ; la location figure toujours au tableau de bord après cet affichage, un rechargement et le survol de tous les liens ; `Annuler` ramène au détail ; quand il active `Archiver la location`, alors il arrive sur `/tableau-de-bord`, où elle ne figure plus ; `Archives` mène sans requête de document à `/archives`, dont le titre, le `h1`, le lien de retour et l'introduction sont ceux de « Contenus » et dont la ligne de la location affiche l'adresse en lien vers son détail, le code postal et la ville, le nom du locataire, `Archivée le` suivi d'une date et `2 quittances` ; et étant donné la page d'archivage d'une location terminée ouverte dans un onglet, quand le propriétaire rouvre la location dans un autre onglet puis envoie l'archivage depuis le premier, alors il arrive sur le détail de la location, en cours et non archivée.
- **CA50** [N] Étant donné une location archivée, préparée avec une date de fin au 30/06/2026, une date d'archivage fixée au 15/09/2026 et deux quittances, quand son propriétaire ouvre `/locations/<id>`, alors la page affiche le bandeau de « Contenus » avec `15/09/2026`, le lien `Retour aux archives`, le chip `Terminée`, les trois groupes, les deux quittances avec `Télécharger` et sans `Supprimer`, les actions `Restaurer la location` et `Supprimer définitivement`, et aucun des liens `Modifier`, de fin, `Archiver` et `Produire une quittance` ; `Télécharger` livre le PDF avec le code 200 ; quand il demande `/locations/<id>/modifier`, `/fin`, `/archiver`, `/quittances/nouvelle` et `/quittances/<q>/supprimer`, alors chaque réponse est une redirection vers `/locations/<id>` ; quand le test rejoue sur cette location des requêtes de modification, de date de fin, de réouverture, de production et de suppression d'une quittance captées avant l'archivage, alors rien n'est écrit et la location et ses quittances sont identiques.
- **CA51** [N] Étant donné cette location archivée, quand son propriétaire active `Restaurer la location`, alors il arrive sur `/locations/<id>`, sans bandeau, avec le chip `Terminée`, les actions d'une location terminée (dont `Archiver`) et le lien `Produire une quittance` ; quand il la rouvre ensuite par la page de date de fin, alors le détail affiche `En cours`, n'a plus de lien `Archiver` et porte la phrase de CA49 ; elle figure au tableau de bord et plus sur `/archives` ; ses deux quittances sont toujours listées ; quand le test rejoue la requête de restauration, alors il arrive sur le détail, inchangé, sans erreur.
- **CA52** [N] Étant donné trois locations archivées, sans quittance, avec une quittance et avec deux, quand leur propriétaire ouvre leur page `/locations/<id>/supprimer`, alors chacune affiche les textes de « Contenus » ; la première n'a aucune phrase sur les quittances, la deuxième affiche `Cette location a 1 quittance. Elle sera supprimée avec la location.` et la troisième `Cette location a 2 quittances. Elles seront supprimées avec la location.` ; les trois existent toujours après affichage, rechargement et survol des liens ; quand il supprime définitivement la troisième, alors il arrive sur `/archives`, où elle ne figure plus ; ses adresses répondent « Location introuvable » et celles de ses deux quittances 404 ; le rejeu de la requête donne « Location introuvable » ; et étant donné une location active qui a une quittance, quand son propriétaire demande `/locations/<id>/supprimer`, alors il est redirigé vers son détail, et quand le test rejoue sur elle une requête de suppression définitive captée pendant qu'elle était archivée, alors rien n'est supprimé.
- **CA53** [N] Étant donné A et B connectés chacun dans son contexte, A ayant une location en cours sans quittance (donc supprimable par A), une location terminée avec une quittance et une location archivée avec une quittance, B ayant une location terminée et une archivée, quand B envoie l'archivage, la restauration puis la suppression définitive de ses propres locations après que le test a remplacé, partout dans la requête, leur identifiant par celui de chacune des trois locations de A, alors B obtient chaque fois « Location introuvable », jamais une redirection vers un détail, et la réponse est la même pour les trois ; les trois locations de A et la quittance de A sont intactes et dans le même état, celles de B aussi ; quand B demande `/locations/<x>`, `/locations/<x>/archiver` et `/locations/<x>/supprimer` avec les identifiants de A, alors chaque réponse a le code 404 et ne diffère de celle d'un UUID inconnu que par l'adresse demandée ; `/archives` de B ne contient que sa location et aucune donnée de A dans son code source ; et B obtient 404 pour l'adresse de téléchargement de la quittance de la location archivée de A, que A télécharge toujours.
- **CA54** [N] Étant donné un compte sans archive, quand il ouvre `/archives`, alors la page affiche `Aucune location archivée.` et aucune liste ; étant donné un compte dont l'unique location est archivée, alors `/tableau-de-bord` affiche l'état vide `Aucune location pour l'instant` avec le lien `Archives` ; étant donné trois locations archivées préparées avec les dates d'archivage 01/09/2026, 15/09/2026 et 10/09/2026, portant zéro, une et deux quittances, alors `/archives` les liste dans l'ordre 15/09, 10/09, 01/09, chacune avec `Archivée le` et sa date et respectivement `1 quittance`, `2 quittances` et `Aucune quittance`.
- **CA55** [V] Étant donné la règle « archivable », quand on lui donne chaque ligne de la table de R39 (date de fin et instant), alors elle rend le résultat indiqué, quel que soit le fuseau du processus (`UTC`, `America/Los_Angeles`, `Pacific/Kiritimati`).
- **CA56** [I] Étant donné A avec quatre locations actives sans quittance (sans date de fin ; fin à venir ; terminée ; bail qui commence dans le futur), quand il supprime définitivement chacune, alors chaque appel répond « supprimée » et aucune ne subsiste ; étant donné une location active de A avec une quittance, quand il la supprime définitivement, alors l'appel répond « état inapplicable », et la location et sa quittance sont intactes ; quand il supprime cette quittance puis la location, alors la suppression réussit ; quand on efface directement en base la ligne d'une location qui a une quittance, alors la base refuse ; quand une production et une suppression définitive partent en même temps sur une location sans quittance, alors soit la location n'existe plus et la production a répondu « introuvable », soit la location et sa quittance existent toutes deux, jamais une quittance perdue ; et quand B supprime définitivement en fournissant l'identifiant d'une location de A sans quittance puis d'une location de A avec quittance, alors les deux appels renvoient le même résultat « introuvable » que pour un identifiant inconnu et les locations de A sont intactes.
- **CA57** [N] Étant donné une location en cours sans quittance et une location terminée sans quittance, quand leur propriétaire ouvre leur détail, alors la première a le lien `Supprimer` vers `/locations/<id>/supprimer` et la phrase sur l'archivage, sans la phrase sur les quittances, et la seconde les liens `Archiver` puis `Supprimer`, sans aucune des deux phrases ; quand il ouvre la page de suppression de la première, alors elle affiche les textes communs de « Contenus », la phrase `Cette action est irréversible. Pour conserver la location sans la supprimer, mettez-y fin.` et aucune phrase sur les quittances ; quand il active `Supprimer définitivement`, alors il arrive sur `/tableau-de-bord`, où elle ne figure plus, elle ne figure pas sur `/archives` et ses adresses répondent « Location introuvable » ; et étant donné la page de suppression d'une location sans quittance ouverte dans un onglet, quand le propriétaire produit une quittance pour cette location dans un autre onglet puis active `Supprimer définitivement` dans le premier, alors il arrive sur le détail de la location, qui existe toujours, liste la quittance, n'a plus de lien `Supprimer` et porte la phrase sur les quittances, et la quittance se télécharge toujours ; quand il supprime ensuite cette quittance, alors le lien `Supprimer` de la location réapparaît.

Cinquante-six critères (CA1 à CA57, moins CA37 remplacé), pour quarante-trois dans la spécification 03 : l'archivage et la suppression directe, qui refont une partie de la fonctionnalité précédente, en apportent douze. J'ai hésité à fusionner : CA15 et CA18 (contenu du PDF, puis stabilité), gardés séparés parce qu'une date de création prise à l'horloge passe le premier ; CA22, CA27 et CA28 (états bloquants de la production) ; CA34 et CA35 (confirmation sans effet, puis suppression) ; CA31 et CA32 (sans session, puis mauvais compte), dont les codes diffèrent ; CA46 et CA47 (états de l'archivage, puis isolation au niveau des données) ; CA49 et CA54 (archiver, puis états de la page « Archives »). À l'inverse, CA29, CA44, CA50, CA52 et CA53 regroupent chacun plusieurs vérifications : à découper par opération s'ils se révèlent lourds à diagnostiquer.

## Effet sur les spécifications précédentes et sur les tests existants

Les spécifications 01 à 03 ne sont pas modifiées par ce document. Sur les points ci-dessous, la spécification 04 prime ; une note en tête des spécifications 02 et 03 devra y renvoyer (à faire par l'orchestrateur). **L'archivage change le comportement d'une fonctionnalité livrée, mais seulement pour une location qui a des quittances** : une location sans quittance se supprime comme dans la spécification 03 (R43), ce qui laisse vrais presque tous ses tests.

### Règles et critères

| Référence | Effet |
| --- | --- |
| Spécification 02, R1 | Le nom n'est toujours pas demandé à l'inscription. Les informations du bailleur sont une donnée distincte du compte d'authentification. |
| Spécification 02, R22 et R23 | La table gagne les adresses de R24, toutes protégées. Le téléchargement redirige sans `retour` (R33). |
| Spécification 02, R36 | Inchangée : l'en-tête ne change pas. |
| Spécification 02, « Contenus », `/tableau-de-bord` | Gagne les liens `Mes informations` et `Archives`. |
| Spécification 03, périmètre exclu | « Toute quittance » et « Identité du bailleur » sont levés. Le reste tient. |
| Spécification 03, R8 | Complétée par R42 : la liste ne rend que les locations actives, la lecture rend aussi les archivées, les écritures refusent une location archivée, la suppression n'efface une location active que si elle n'a aucune quittance (R43). |
| Spécification 03, R9 | Tient ; précisée : les locations archivées comptent (R39). « Les locations supprimées ne comptent pas » vaut pour la suppression définitive. |
| Spécification 03, R21 | Tient, sauf sa dernière phrase « Mettre fin tient donc lieu d'archivage », remplacée par R39 : mettre fin et archiver sont deux choses distinctes, et mettre fin est le préalable de l'archivage. |
| Spécification 03, R22 (engagement) | Tenu par R6 et R7. La modification n'est plus possible sur une location archivée (R39). |
| Spécification 03, R23 | **Tient pour une location sans quittance** (R43) : suppression réelle, quel que soit le statut. **Redéfinie pour une location qui a des quittances** par R19, R39 et R40 : elle ne se supprime qu'après avoir été terminée puis archivée, et la suppression emporte alors ses quittances. Son engagement (« rien ne doit disparaître en cascade sans qu'une règle l'ait décidé ») est tenu par la garantie de base de R43. |
| Spécification 03, R24 | Tient dans les deux situations de la page de suppression. Pour une location archivée, la page nomme aussi le nombre de quittances. « Aucune requête GET ne supprime » s'étend à l'archivage et à la restauration. |
| Spécification 03, R27 | Gagne `/locations/<id>/archiver` et `/locations/<id>/quittances/nouvelle` ; `/locations/<id>/supprimer` sert pour une location active sans quittance ou pour une location archivée, et `/modifier`, `/fin` pour une location active seulement (R40). |
| Spécification 03, R29 | La ligne « Suppression : `/tableau-de-bord` » tient pour une location active sans quittance ; la table de R26 ajoute les arrivées de l'archivage, de la restauration et de la suppression depuis les archives. « Rouvrir une location qui n'a pas de date de fin » tient pour une location active. La règle « tout lien interne est un `Link` » reçoit l'exception de R34. |
| Spécification 03, R33 | `autocomplete="off"` ne vaut pas pour `/mes-informations` (R35). |
| Spécification 03, R35, R36 | Le tableau de bord ne liste que les locations actives ; l'état vide s'affiche aussi quand toutes les locations sont archivées (R41). |
| Spécification 03, R40 | Le lien destructif `Supprimer` du détail reste pour une location active sans quittance et disparaît dès qu'elle en a une ; `Archiver` est secondaire et n'existe que pour une location terminée ; le lien destructif `Supprimer définitivement` n'existe que sur le détail d'une location archivée (R36). |
| Spécification 03, R43, point 5 | Vaut pour la suppression définitive, et s'étend aux valeurs figées des quittances (R37). |
| Spécification 03, « Contenus », détail | Gagne la section « Quittances » ; `Supprimer` ne figure que sans quittance, `Archiver` que pour une location terminée, avec les phrases A et B des quatre cas de R43 ; présentation propre à une location archivée. |
| Spécification 03, « Contenus », `/locations/<id>/supprimer` | **Tiennent tels quels** pour une location active sans quittance. Pour une location archivée : même titre, même `h1`, même première phrase, même bouton ; autre phrase finale ; annonce du nombre de quittances. |
| Spécification 03, CA4 | Tient ; complété par CA47 et CA56. |
| Spécification 03, CA8 | Tient (la location supprimée n'a pas de quittance) ; complété par CA48. |
| Spécification 03, CA9 | Tient (la location supprimée n'a pas de quittance) ; complété par CA7 pour une location qui a des quittances. |
| Spécification 03, CA16 | Faux pour « ses seuls liens sont le logo et `Ajouter une location` » : quatre liens (CA19). Le reste tient. |
| Spécification 03, CA28 | Faux pour la liste des groupes (« Quittances » s'insère en quatrième position) et incomplet pour les liens d'action : la location de ce critère, terminée et sans quittance, a désormais `Archiver` en plus de `Supprimer`. Le reste tient. |
| Spécification 03, CA29, CA30 | Tiennent. Pour le propriétaire, `/supprimer` d'une location active qui a des quittances redirige vers le détail (CA52). |
| Spécification 03, CA34 | Tient pour les quatre actions sur des locations sans quittance ; complété par CA53 et CA56. |
| Spécification 03, CA38, CA39 | **Tiennent** pour une location sans quittance, repris par CA57 ; complétés par CA49 (archiver) et CA52 (supprimer depuis les archives). |
| Spécification 03, CA40 | Tient : la location rouverte de sa dernière étape n'a pas de quittance et se supprime directement. Le parcours sans JavaScript de l'archivage est CA39 de ce document. |
| Spécification 03, CA42, CA43, CA44 | Tiennent ; la page de suppression d'une location archivée et les pages nouvelles sont couvertes par CA41 à CA43 de ce document. |
| `DESIGN.md` | À compléter par l'orchestrateur : dans un PDF, la référence est en DM Sans (R29). |

### Tests à adapter

L'effet est le même sur les deux projets Playwright, `bureau` et `mobile` : aucun des tests concernés ne dépend de la largeur. Deux vagues : en **T4**, ce que les quittances et le lien `Mes informations` rendent faux ; en **T5**, le peu que l'archivage rend faux. Tous les tests existants manipulent des locations **sans quittance** : la suppression directe de R43 les laisse vrais.

**Rendu faux en T4**

- `e2e/espace-reserve.spec.ts`, « CA16 : contenus, deux liens (le logo et Ajouter une location) et un seul bouton » : `getByRole("link")` compte trois liens en T4, puis quatre en T5 ; son titre est inexact. Ses autres assertions restent vraies. À réécrire en désignant les liens par leur nom plutôt que par leur nombre, pour ne pas le reprendre en T5.
- `e2e/locations.spec.ts`, « CA16, CA22, CA23, CA44 : premier parcours avec JavaScript… » : même assertion sur le nombre de liens du tableau de bord. Le reste tient. À surveiller : sa fonction `valeurDetail` cherche un libellé par texte exact (`Charges`, `Adresse`, `Nom`) ; la section « Quittances » ne doit pas introduire un élément dont le texte entier est l'un de ces libellés.
- `e2e/locations.spec.ts`, « CA28 : détail d'une location terminée… » : la liste des `h2` attendue gagne `Quittances` avant `Actions`.
- À relancer sans changement attendu : « CA36, CA30 : axe… » et « Espace réservé sans JavaScript » (`espace-reserve`), « CA42 » et « CA43 (partie T3 à T5) » (`locations`). `INTERDITS` gagne `Mes informations` ; « Chemins voisins » s'étend à `/mes-informations` et `/quittances/…`.

**Rendu faux en T5 par l'archivage**

- `e2e/locations.spec.ts` :
  - « CA28 : détail d'une location terminée… » : **reste vrai** en T5 (sa location, terminée et sans quittance, garde le lien `Supprimer`, sa cible et son apparence destructive) ; à compléter par le lien `Archiver`, désormais présent.
  - « CA29, R5 » et « CA30, R28 » restent vrais (autre compte, visiteur) ; à étendre à `/archiver` et `/archives`.
  - Tous les autres tests du fichier restent vrais.
- `e2e/locations-gestion.spec.ts` : **aucun test ne devient faux**. Toutes ses locations sont sans quittance : le lien `Supprimer` du détail, la page `/locations/<id>/supprimer` avec ses textes de la spécification 03 (phrase « mettez-y fin » comprise), le bouton `Supprimer définitivement`, l'arrivée sur `/tableau-de-bord` et les adresses en 404 après suppression sont inchangés.
  - **Restent vrais tels quels** : « Parcours 1 à 4, CA32, CA35, CA37, CA39, CA44, CA45… », « CA39, R29 : après la suppression, Précédent ne ressuscite rien… », « R34 : une double activation… », « CA27, R11 », « CA38, R24 : GET, HEAD, préchargement… », « R24, R7 : un POST forgé… », « CA40, R34 » (la location rouverte, sans quittance, se supprime directement), les tests « CA34 » paramétrés sur les quatre opérations, « CA34, R5, R7 », « R4, R7 », « R7 : les quatre actions sans session… », « R7, CA34 : depuis une autre origine… », « R43 : l'adresse e-mail du locataire… », « R26, R29 : supprimée dans un onglet… », « CA42 », « CA44, R40 », « CA43, R40 », « CA46, R30 », ainsi que tous ceux qui ne touchent pas à la suppression. La fonction d'aide `ouvrirSupprimer` et la table `OPERATIONS` restent exactes.
  - **Changent seulement de place ou de libellé** : aucun.
  - **À surveiller sans être faux** : le détail d'une location terminée gagne le lien `Archiver`, celui d'une location en cours la phrase A ; un test qui compterait les liens ou relèverait tout le texte du groupe « Actions » devrait en tenir compte (aucun ne le fait aujourd'hui). Le lien `Supprimer définitivement` du détail d'une location archivée contient le mot « Supprimer » : un test nouveau sur ce détail doit le désigner par son nom complet.
  - **À écrire, et non à réécrire** : tout ce qui concerne une location avec quittances ou archivée (CA49 à CA54, CA57).
- `e2e/aide-locations.ts` : `creerLocation`, `locationsDuCompte`, `supprimerCompte` restent exacts (une location insérée sans date d'archivage est active). À compléter : préparer une location archivée avec une date fixée, des quittances, des informations de bailleur.
- `e2e/espace-reserve.spec.ts` : `INTERDITS` gagne `Archives` ; « Chemins voisins » s'étend à `/archives`.
- Tests Vitest de `src/app/locations/[id]/` : **aucun ne devient faux**, parce qu'ils portent sur des composants et non sur les pages. `confirm-form.test.tsx` (usages « réouverture » et « suppression », libellé `Supprimer définitivement`) reste vrai et gagne les usages « archivage » et « restauration » ; `rental-reminder.test.tsx` reste vrai, le rappel servant aussi à la page d'archivage ; `end-date-form.test.tsx` et `update-rental-form.test.tsx` ne sont pas concernés. Il n'existe pas de test Vitest de la page de suppression elle-même. `dashboard-header.test.tsx` porte sur un en-tête inchangé. Les trois tests qui citent le texte de L28 restent vrais.
- Tests d'intégration de `src/rentals/` :
  - **Aucun ne devient faux**, à condition que la fonction de suppression garde son résultat « supprimée » pour une location active sans quittance, ce que R43 exige. `rental-store.integration.test.ts` : « CA4 … témoin : les mêmes appels, faits par A, écrivent bien », « CA8 — refuse la 101e, l'accepte après une suppression… », « CA9 — ne laisse nulle part dans la base le nom ni l'adresse e-mail du locataire », « CA4 — rend « introuvable » à chaque tentative… », « R6 — un identifiant mal formé… », « CA5 — sans propriétaire… », « CA9 — supprime les locations d'un compte avec lui… » restent vrais : leurs locations n'ont pas de quittance.
  - `rental-store.timeout.integration.test.ts`, « deleteRental : RentalStoreError, et la ligne existe toujours » : reste vrai en principe (la suppression d'une location sans quittance attend toujours le verrou de sa ligne) ; à relancer, puis à étendre à l'archivage et à la restauration.
  - À écrire en T3 : CA46 à CA48 et CA56.

## Découpage

Cinq tâches, dans cet ordre. T1, T2 et T3 n'ont pas d'interface : ni recette ni test e2e. Deux recettes : à la fin de T4, première tranche utilisable de bout en bout, et à la fin de T5. « Sensible » : à confier au modèle le plus puissant.

| Tâche | Sensible | Interface à recetter | Critères |
| --- | --- | --- | --- |
| T1 — Document PDF | non | non | CA11, CA14 à CA18 |
| T2 — Règles pures | non | non | CA8 à CA10, CA12, CA13, CA55 |
| T3 — Données | oui : isolation, unicité, archivage, suppression conditionnelle | non | CA1 à CA7, CA46 à CA48, CA56 |
| T4 — Informations du bailleur, production, téléchargement, suppression d'une quittance, suppression directe d'une location | oui : contrôle d'accès de l'action et du Route Handler | oui, première recette | CA19 à CA36, CA38, CA57 |
| T5 — Archivage, restauration, suppression depuis les archives, recette complète | oui : isolation, changement d'une fonctionnalité livrée | oui, recette complète | CA49 à CA54, CA39 à CA45 |

### T1 — Document PDF (sans base, sans navigateur)

**Commencer par vérifier que la bibliothèque retenue fonctionne avec les versions de React et de Next du projet, et que les polices s'incorporent** : si elle ne convient pas, on le sait avant d'écrire le reste, et le développeur le signale avant d'aller plus loin (R29, Q7, Q10). Puis : contenu de la quittance comme données (R27, titre de R30), référence et nom de fichier (R16, R32), construction du PDF à partir d'une quittance figée et d'un instant de production (R27 à R31), règle des caractères affichables (R17). Le développeur livre aussi un exemple de PDF, aux valeurs courantes et aux longueurs maximales, que l'utilisateur ouvre pour valider la mise en page, qu'aucun critère ne mesure au-delà de R28.

### T2 — Règles pures (sans base, sans navigateur)

Mois acceptés (R8), période (R9), lecture du mois (R10), libellés (R11), validation des informations du bailleur (R1) et du formulaire de production (R12 à R14) en réutilisant les règles de montants, de dates et de textes existantes, messages B1 à B3 et Q1 à Q9, règle « archivable » (R39). Aucune lecture de l'horloge : l'instant est un paramètre. Indépendante de T1, sauf pour les libellés de mois que T1 utilise : si l'orchestrateur préfère, T1 et T2 se font dans une seule tâche.

### T3 — Données (sans interface)

Schéma et migration des informations du bailleur, des quittances et de la date d'archivage ; contraintes de base ; fonctions de R23 et de R42 ; production atomique (R6) ; unicité (R15) ; suppression d'une quittance ; archivage, restauration et suppression définitive avec les quittances (R19) ; disparition avec le compte (R20). **La suppression prend dès T3 sa forme finale** (R42, R43) : elle efface une location active sans quittance, ou une location archivée avec ses quittances, et la base refuse d'effacer une location qui a encore une quittance. Les pages livrées et leurs tests continuent de fonctionner sans rien garder de provisoire, puisqu'aucune location n'a de quittance avant T4 ; la liste du tableau de bord peut déjà exclure les locations archivées, puisqu'il n'en existe aucune avant T5. Le développeur indique où ces données sont lues ou écrites hors des fonctions de R23 et de R42 : la réponse attendue est « nulle part ».

### T4 — Informations du bailleur, production, téléchargement, suppression d'une quittance

Lien `Mes informations` du tableau de bord et page `/mes-informations` avec son action ; section « Quittances » du détail ; page de production, ses trois blocs et son action (R25, R26) ; Route Handler de téléchargement avec tous ses codes (R32 à R34) ; page `/quittances/<q>/supprimer` et son action (R18) ; écran « Quittance introuvable » ; protection des adresses nouvelles, prolongation de la session, code 400. Adaptation des tests existants de la première vague. Comme le détail gagne ici ses quittances, T4 livre aussi la suppression directe de R43 côté écran : lien `Supprimer` présent seulement sans quittance, phrase B sinon, redirection de `/locations/<id>/supprimer` et de son action quand une quittance existe, cas des deux onglets (CA57, vérifié ici sans le lien `Archiver` ni la phrase A, que T5 ajoute). **Ce qui reste provisoire entre T4 et T5** : une location qui a des quittances ne peut être ni supprimée ni archivée, l'archivage n'existant pas encore ; la phrase B annonce donc des archives qui n'arrivent qu'en T5, et la phrase A ainsi que le lien `Archiver` sont absents. Rien n'est perdu pendant cet intervalle, et il n'est pas recetté. CA19 et CA38 se vérifient ici sans le lien `Archives` ni les adresses `/archives` et `/archiver`, qui arrivent en T5 (le tableau de bord a donc trois liens en fin de T4, quatre en fin de T5). À la fin de la tâche, la QA recette les parcours 1 à 4 et l'isolation de la production, du téléchargement et de la suppression d'une quittance, et écrit leurs tests e2e.

### T5 — Archivage, restauration, suppression depuis les archives, recette complète

Tâche à part, placée en dernier. Depuis la décision sur Q15, elle ne rend presque plus rien faux dans les tests de la spécification 03 : la suite e2e ne devrait pas passer au rouge, hors le décompte des liens du tableau de bord. Lien `Archives` du tableau de bord et page `/archives` (R41) ; lien `Archiver` des seules locations terminées, phrase d'explication des locations en cours et page d'archivage ; détail d'une location archivée ; restauration ; seconde situation de la page de suppression, pour une location archivée, avec le nombre de quittances et l'arrivée sur `/archives` ; redirections d'état inapplicable sur toutes les pages et actions existantes (R40). **C'est ici que sont complétés les tests de la seconde vague** (lien `Archiver` dans « CA28 », décompte des liens, fonctions d'aide pour préparer une location archivée). Puis recette complète des parcours 1 à 6, tests e2e durables de l'archivage, CA39 à CA45 sur l'ensemble, et relance des critères des spécifications 02 et 03 marqués « tiennent ».

## Questions ouvertes

Celles qui touchent au droit locatif sont **à faire vérifier** : je n'affirme rien au-delà de l'avertissement de tête.

**Q1 — Mentions du document (tranchée).** Le texte final de R27, douze blocs, est **validé par l'utilisateur le 2026-10-12**. Je n'ai pas pu établir si d'autres mentions sont attendues en droit : à faire vérifier avant une ouverture au public.

**Q2 — Signature (tranchée).** Décision de l'utilisateur : pas de signature, le nom du bailleur sous `Le bailleur` et un espace pour signer à la main, sans mention qui prétende valoir signature. La spécification n'affirme toujours rien sur la valeur d'une quittance non signée.

**Q3 — Période (droit).** Hypothèse recommandée et appliquée (R8, R9) : un mois civil, borné par les dates du bail, sans prorata calculé, jamais un mois à venir. Deux points à vérifier : une quittance peut-elle couvrir un mois incomplet avec un montant saisi librement ; et que faire des baux dont le terme ne suit pas le mois civil ou des loyers payés d'avance pour un mois futur, que cette version ne sait pas représenter.

**Q4 — Libellé « Provisions pour charges » et somme en lettres (droit).** Décision de l'utilisateur, appliquée (R27) : le document écrit `Provisions pour charges` ; les écrans gardent `Charges`, pour ne pas toucher à la spécification 03. **Ce libellé serait inexact pour un bail au forfait de charges**, que l'application ne distingue pas : à vérifier, et à traiter le jour où la location enregistrera la nature des charges. Aucune somme en toutes lettres : à vérifier si elle est attendue.

**Q5 — Durée de conservation des quittances et des archives (droit et données personnelles).** La question a changé de nature : plus rien ne disparaît sans un geste explicite et distinct (supprimer une quittance, ou archiver puis supprimer définitivement une location). Restent à faire vérifier, sans que je puisse l'affirmer : la durée pendant laquelle un bailleur doit ou peut garder ses quittances ; si la suppression définitive doit être retardée ou accompagnée d'un avertissement plus ferme tant que cette durée court ; à l'inverse, si des archives contenant le nom et l'adresse e-mail d'un ancien locataire peuvent être gardées sans limite, ou doivent être purgées après un délai. Hypothèse recommandée : s'en tenir à R19 et R37 tant que le projet reste local, et traiter ces trois points avec la spécification « mise en ligne » (information du locataire, export, suppression du compte).

**Q6 — Bailleur en texte libre (tranchée), adresse française.** Décision de l'utilisateur : un nom libre qui couvre particulier, société et bailleurs multiples. Les mentions propres à un professionnel sont exclues et notées comme évolution possible (V2). Reste un point, non bloquant : un bailleur résidant à l'étranger ne peut pas saisir son adresse (code postal de 5 chiffres).

**Q7 — Polices du document (bloque T1).** Hypothèse recommandée et appliquée (R29) : DM Sans et Plus Jakarta Sans incorporées depuis des fichiers du dépôt. Je crois ces deux polices publiées sous licence libre SIL OFL, sans l'avoir vérifié : le développeur le confirme et joint le texte de la licence. Je n'ai pas vérifié non plus leur couverture exacte : l'ensemble garanti de R17 est une exigence, à réduire ici si une police ne le couvre pas.

**Q8 — Arrivée après l'enregistrement des informations.** Hypothèse recommandée et appliquée (R26) : toujours `/tableau-de-bord`, destination fixe. Conséquence : le propriétaire parti de la page de production doit retrouver sa location par le tableau de bord. Autre option : revenir à la page de production, ce qui demande de faire voyager un identifiant de location par le navigateur et de le contrôler comme tel.

**Q9 — Accès à « Mes informations » et aux « Archives » hors de l'en-tête.** Hypothèse recommandée et appliquée (R24) : deux liens sur le tableau de bord, en-tête inchangé. J'ai estimé, sans le mesurer, que le logo, des liens et `Se déconnecter` ne tiennent pas sur une ligne à 320px ; la navigation complète reste reportée. Autre option : des liens dans l'en-tête à partir de 768px seulement, ce qui rend faux les tests d'ordre de tabulation de toutes les pages protégées.

**Q10 — Points techniques que je n'ai pas pu vérifier (à lever en début de T1 et de T4).** La compatibilité de la bibliothèque PDF avec React 19 et Next 16 ; la possibilité de rendre l'écran de l'application depuis un Route Handler pour les réponses 404, 503 et 500 (R33 accepte un document HTML autonome) ; le fait que la redirection sans session du téléchargement puisse partir sans paramètre `retour` alors que les autres adresses protégées en portent un. Si l'un de ces points ne tient pas, le développeur le signale avant de continuer ; ce qui ne se négocie pas reste l'identité des réponses entre « pas à moi » et « n'existe pas », et l'absence de tout octet de PDF sans session.

**Q11 — Gabarit et quittances anciennes.** Hypothèse recommandée et appliquée (R31) : seules les valeurs sont figées ; un changement futur de mise en page s'applique aux quittances déjà produites. Autre option : enregistrer le fichier lui-même, ce qui garantit l'identité octet pour octet mais conserve un document par quittance et complique la suppression.

**Q12 — Textes des écrans (tranchée).** Validés par l'utilisateur le 2026-10-12, archivage compris. La phrase B de R43, écrite après cette validation, est la seule qu'il n'a pas relue ; toute retouche se fait dans cette spécification avant la tâche concernée.

**Q13 — Mention de réserve (droit ; texte validé par l'utilisateur, relecture juridique à faire avant une ouverture au public).** L'utilisateur a validé le texte et le retrait de la réserve d'encaissement le 2026-10-12 ; cela ne vaut pas avis juridique. Texte retenu, à relire par quelqu'un de compétent avant toute mise en ligne : `La présente quittance ne libère le locataire que pour la période indiquée. Elle ne vaut pas quittance des loyers et des charges des périodes antérieures.` Je l'ai composé à partir des formules observées sur les deux quittances fournies par l'utilisateur, sans pouvoir en garantir la portée ni la nécessité. J'ai écarté la réserve d'encaissement : elle se justifierait pour un paiement par chèque, mais elle affaiblit l'attestation d'un paiement reçu que le propriétaire vient de confirmer ; à réintroduire si l'utilisateur le souhaite.

**Q14 — Archivage (tranchée).** Tous les points ci-dessous sont **validés par l'utilisateur le 2026-10-12**, après sa correction d'un premier arbitrage (une location en cours ne s'archive pas, elle doit être terminée, R39). Le point (5) est remplacé par l'état transitoire décrit en T4 depuis la décision sur Q15. Pour mémoire : (0) sur le détail d'une location en cours, le lien `Archiver` est absent et remplacé par une phrase d'explication, plutôt qu'affiché indisponible ; `/archiver` demandée pour une telle location redirige vers ce détail sans autre message. (1) Une location archivée est en consultation seule, quittances téléchargeables ; pour toute autre opération, on restaure d'abord. (2) Elle compte dans la limite de 100 locations. (3) Archiver passe par une page d'explication, restaurer par un simple bouton. (4) Une page ou une action hors de propos pour l'état de la location redirige vers son détail, sans message. (5) Entre T4 et T5, supprimer une location par l'ancien geste emporte encore ses quittances. Autre option pour (1) : laisser supprimer une quittance dans les archives, ce qui contredit « rien ne change dans les archives ».

**Q15 — Retirer une location créée par erreur (tranchée).** Décision de l'utilisateur du 2026-10-12 : « si pas de quittance, on peut supprimer direct ». Appliquée par R43 : une location active sans quittance se supprime définitivement depuis son détail, quel que soit son statut ; une location qui a au moins une quittance doit être terminée, archivée, puis supprimée depuis les archives. La condition est contrôlée à l'écriture et garantie par la base (CA56, CA57).
