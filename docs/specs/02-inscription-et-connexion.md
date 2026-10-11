# 02 — Inscription et connexion du propriétaire

Statut : validée par l'utilisateur le 2026-10-10. Questions tranchées : Q1 (branche Neon « test », variable `DATABASE_URL_TEST`), Q2 (pas de nom à l'inscription), Q3 (token `error-text` `#B91C1C`, ajouté à `DESIGN.md`), Q4 (message explicite E3), Q5 et Q6 (12 à 128 caractères, sans confirmation), Q7 (**60 jours** glissants au lieu de 30). Q8 à Q10 restent telles que recommandées.

Références : `CLAUDE.md` (produit), `DESIGN.md` (design system), `docs/AVANCEMENT.md` (décisions), `docs/specs/01-accueil-et-design-system.md` (socle et page d'accueil, dont cette spécification modifie une partie, voir « Effet sur la spécification 01 »), `docs/fiches/08-base-de-donnees.md` et `docs/fiches/09-authentification.md` (choix techniques).

Décisions de l'utilisateur, non rediscutées ici : Postgres chez Neon avec Drizzle ; Better Auth, e-mail et mot de passe, session en base et cookie `httpOnly` ; aucun envoi d'e-mail dans cette version ; toute route interne passe par `next/link` ; thème clair, textes en français.

Les numéros R et CA de ce document lui sont propres. Une règle ou un critère de la spécification 01 est toujours cité sous la forme « R18 de la spécification 01 ».

## Objectif

Un propriétaire bailleur peut créer son compte, se connecter, se déconnecter et atteindre un espace qui lui est réservé. Cet espace est volontairement presque vide : il prouve que la session fonctionne et pose la règle d'isolation entre comptes sur laquelle s'appuieront les locations, les quittances et le tableau de bord réel. La page d'accueil cesse d'annoncer que les inscriptions sont fermées et mène à la création de compte.

## Périmètre

### Inclus

1. **Socle technique** : base de données branchée, schéma et migrations du compte et des sessions, bibliothèque d'authentification configurée, moyen unique de connaître « le propriétaire courant » côté serveur, base de test séparée.
2. **Inscription** : page publique `/inscription`.
3. **Connexion** : page publique `/connexion`. **Déconnexion** depuis l'espace réservé.
4. **Espace réservé minimal** : page protégée `/tableau-de-bord`.
5. **Protection des routes et redirections**, avec retour vers la page demandée après connexion.
6. **Composants du design system** nécessaires aux formulaires : champ de saisie, boutons (primaire, secondaire, discret), message de formulaire, et un token de couleur pour le texte d'erreur.
7. **Mise à jour de la page d'accueil** annoncée par R18 de la spécification 01.

### Exclu

- Tout envoi d'e-mail : vérification de l'adresse, lien magique, réinitialisation du mot de passe, message de bienvenue. Conséquences assumées dans cette version :
  - **un mot de passe oublié n'a aucune solution** : le compte reste inaccessible, et son adresse ne peut pas servir à en créer un autre (R6) ;
  - **l'adresse e-mail n'est pas vérifiée** : rien ne prouve que la personne inscrite possède l'adresse saisie.
- Modification de l'adresse e-mail ou du mot de passe, suppression du compte, page de profil.
- Nom, raison sociale, adresse postale du bailleur : ces informations seront demandées par la spécification qui en aura besoin (les documents envoyés au locataire). Voir Q2.
- Connexion par un tiers (Google, Apple), double authentification, clés d'accès.
- Limitation des tentatives de connexion et d'inscription (R20, Q8).
- Case « Rester connecté », liste des sessions actives, déconnexion de tous les appareils.
- Locations, locataires, loyers, quittances, tableau de bord réel, exports.
- Navigation applicative complète (liens, tiroir mobile, menu du compte de `DESIGN.md`) : l'espace réservé n'a qu'un logo et un bouton de déconnexion.
- Page 404 personnalisée, mentions légales, politique de confidentialité (Q8).
- Passage des tokens de taille de `px` à `rem`, ajout de Safari et Firefox à Playwright (points ouverts de `docs/AVANCEMENT.md`, sans lien avec cette fonctionnalité).

## Règles métier

### Compte et isolation

**R1 — Données du compte propriétaire.** Un compte représente un propriétaire bailleur. Le locataire n'a jamais de compte.

| Information | Obligatoire | Unique | Modifiable dans cette version | Remarque |
| --- | --- | --- | --- | --- |
| Identifiant interne | oui | oui | non, jamais | Généré par le système, sans rapport avec l'e-mail, jamais affiché. C'est lui qui rattachera les données métier au compte. |
| Adresse e-mail | oui | oui, après normalisation (R4) | non | Sert d'identifiant de connexion. Enregistrée sous sa forme normalisée. |
| Mot de passe | oui | non | non | Jamais enregistré en clair ni sous une forme réversible : seul un hachage conçu pour les mots de passe est conservé. Jamais renvoyé au navigateur, jamais écrit dans un journal. |
| Adresse vérifiée | oui | non | non | Toujours « non » dans cette version, faute d'envoi d'e-mail. |
| Date de création | oui | non | non, jamais | Renseignée par le système. |

Aucune autre information n'est demandée au propriétaire (Q2). Le schéma technique, les tables et les colonnes propres à la bibliothèque d'authentification sont du ressort du développeur.

**R2 — Isolation entre comptes (règle transverse, valable pour toutes les spécifications suivantes).**

1. Toute donnée métier appartient à exactement un compte propriétaire.
2. Toute lecture et toute écriture de données privées détermine le propriétaire **à partir de la session lue sur le serveur**, jamais à partir d'une valeur fournie par le navigateur (adresse, paramètre, champ de formulaire, corps de requête).
3. Chaque point d'entrée qui lit ou écrit des données privées (page, action de formulaire, route d'API) vérifie lui-même la session. Une redirection faite en amont ne dispense pas de cette vérification.
4. Demander la ressource d'un autre compte par son identifiant donne la même réponse que si elle n'existait pas.
5. Il existe un seul moyen, côté serveur, d'obtenir le propriétaire courant ; tout le code applicatif passe par lui.
6. Toute spécification qui ajoute des données privées doit contenir au moins un critère d'acceptation négatif : un propriétaire connecté ne voit ni ne modifie les données d'un autre.

Dans cette version, la seule donnée privée affichée est l'adresse e-mail du propriétaire connecté.

**R3 — Plusieurs sessions.** Un même compte peut être connecté sur plusieurs navigateurs en même temps. Se déconnecter ne met fin qu'à la session du navigateur utilisé. Se connecter dans un navigateur où une session existe déjà (même compte ou autre compte) remplace cette session.

### Validation

**R4 — Normalisation de l'adresse e-mail.** Avant toute vérification, à l'inscription comme à la connexion : les espaces de début et de fin sont retirés, puis l'adresse est mise en minuscules. Aucune autre transformation (les points et le suffixe `+…` sont conservés). C'est la forme normalisée qui est enregistrée, comparée et affichée.

**R5 — Format de l'adresse e-mail (inscription).** Après normalisation, l'adresse est valide si elle remplit toutes ces conditions : 254 caractères au plus ; exactement un `@` ; au moins un caractère avant le `@` ; après le `@`, un domaine contenant au moins un point, qui ne commence ni ne finit par un point ; aucun espace. Rien de plus strict : l'existence réelle de l'adresse ne peut pas être vérifiée sans envoi d'e-mail. **Précision après T1** : la bibliothèque d'authentification applique un contrôle de format plus strict (caractères ASCII, pas de points consécutifs). Une adresse qu'elle refuse est traitée comme un format invalide : message E2.

**R6 — Unicité.** Deux comptes ne peuvent pas avoir la même adresse normalisée. Cette garantie tient aussi quand deux inscriptions avec la même adresse arrivent en même temps : une seule réussit.

**R7 — Politique de mot de passe (inscription).** 12 caractères au minimum, 128 au maximum. Aucune règle de composition (majuscule, chiffre, symbole) et aucun caractère interdit ; les espaces sont permis et le mot de passe n'est jamais rogné ni modifié. Justification : la longueur protège mieux que la composition, qui pousse à des schémas prévisibles (`Motdepasse1!`) et gêne les phrases de passe et les gestionnaires de mots de passe ; le maximum évite de faire hacher des saisies démesurées. Les critères ne portent que sur des caractères ASCII ; le décompte des caractères hors ASCII est laissé au développeur. Voir Q5. **Précision après la recette de T2** : la longueur se compte en caractères Unicode (points de code), pas en unités UTF-16 : un emoji simple compte pour un caractère, et un mot de passe de 6 emojis est refusé (E5).

**R8 — Pas de confirmation du mot de passe.** Le formulaire d'inscription ne demande le mot de passe qu'une fois. Pour se relire, l'utilisateur dispose d'un bouton qui affiche ou masque sa saisie (masquée par défaut), sur l'inscription comme sur la connexion. Risque assumé : sans réinitialisation, une faute de frappe non relue rend le compte inaccessible ; un texte d'aide le dit (voir « Contenus »). Voir Q6.

**R9 — Où et quand la validation a lieu.** La validation est faite sur le serveur, à la soumission du formulaire, et lui seul fait foi. Il n'y a pas de validation pendant la frappe. Les bulles de validation natives du navigateur n'apparaissent jamais : tous les messages sont ceux de cette spécification. Les règles R4, R5, R7 et R14 doivent pouvoir être vérifiées par des tests sans base de données ni navigateur.

### Inscription

**R10 — Champs.** Deux champs, tous deux obligatoires, et rien d'autre : « Adresse e-mail » (identifiant de connexion, et futur destinataire des e-mails du jour J) et « Mot de passe ». Pas de nom (Q2), pas de confirmation (R8), pas de case à cocher.

**R11 — Inscription réussie.** Le compte est créé, le propriétaire est **connecté automatiquement** et arrive sur `/tableau-de-bord`. Justification : l'adresse n'étant pas vérifiée, exiger une connexion juste après l'inscription n'apporterait aucune garantie et ajouterait une étape. Le paramètre `retour` (R14) n'est pas pris en compte à l'inscription.

**R12 — Adresse déjà utilisée.** Si l'adresse normalisée appartient déjà à un compte, aucun compte n'est créé, aucune session n'est ouverte, le compte existant n'est pas modifié, et le message E3 s'affiche sous le champ « Adresse e-mail ». Compromis assumé : ce message révèle qu'un compte existe. Sans envoi d'e-mail, c'est inévitable, puisqu'une inscription réussie connecte aussitôt : n'importe quelle réponse différente du succès trahit l'existence du compte. Un message vague n'apporterait donc aucune protection et laisserait le propriétaire légitime sans explication. La connexion, elle, ne révèle rien (R13). Quand un service d'e-mail existera, l'inscription devra répondre de façon identique dans les deux cas et prévenir le titulaire par e-mail. Voir Q4 et Q8.

### Connexion

**R13 — Vérification.** La connexion ne contrôle que la présence des deux champs (E1, E4). Dans tous les autres cas d'échec (adresse inconnue, mot de passe faux, adresse mal formée, mot de passe trop court ou trop long), la réponse est exactement la même : message E7, mêmes champs conservés ou vidés (R26), même adresse de page. Rien ne permet de distinguer « adresse inconnue » de « mot de passe faux ».

**R14 — Destination après connexion et paramètre `retour`.** Après une connexion réussie, le propriétaire arrive sur la destination de retour si elle est sûre, sinon sur `/tableau-de-bord`. La destination de retour est la valeur du paramètre `retour` de l'adresse de `/connexion`. Elle est sûre si et seulement si : elle commence par un seul `/` ; elle ne commence pas par `//` ; elle ne contient ni barre oblique inverse `\` ni caractère de contrôle ; son chemin n'est ni `/connexion` ni `/inscription`. Toute autre valeur (adresse absolue, `//exemple.test`, `javascript:…`, valeur vide) est ignorée sans message. La valeur n'est jamais suivie telle quelle vers un autre site. Le chemin, les paramètres et l'ancre d'une destination sûre sont conservés.

**R15 — Mot de passe oublié.** La page de connexion n'a **aucun lien** « Mot de passe oublié » (il mènerait nulle part). Elle affiche à la place une phrase qui dit que la réinitialisation n'existe pas encore (voir « Contenus »). La page d'inscription prévient de la même limite sous le champ du mot de passe.

### Session et sécurité

**R16 — Durée de la session.** Une session dure 60 jours à partir de la connexion. Chaque utilisation la prolonge de 60 jours (le renouvellement peut n'être enregistré qu'une fois par jour). Sans utilisation pendant 60 jours, elle expire et le propriétaire doit se reconnecter. Il n'y a pas de case « Rester connecté » : le comportement est le même pour tous, et la session survit à la fermeture du navigateur. La durée de 60 jours a été retenue par l'utilisateur (Q7) : un propriétaire qui ne vient qu'une fois par mois ne doit pas être déconnecté à chaque visite. **Précision après T1** : la prolongation doit valoir aussi pour le cookie du navigateur, pas seulement pour la session en base. Un Server Component ne pouvant pas écrire de cookie, T3 met en place le renouvellement du cookie lors de la navigation (par exemple dans `proxy.ts`), sans que ce mécanisme tienne lieu de contrôle d'accès (R2).

**R17 — Cookie de session.** Il est illisible par le JavaScript de la page (`HttpOnly`), limité au même site (`SameSite=Lax` ou plus strict), marqué `Secure` quand l'application est servie en HTTPS, et ne contient qu'un jeton : ni adresse e-mail, ni mot de passe. **Précision après T1** : ni l'adresse IP ni l'agent utilisateur ne sont enregistrés avec la session, tant qu'aucune fonctionnalité ne s'en sert (minimisation des données personnelles).

**R18 — Déconnexion.** « Se déconnecter » supprime la session **sur le serveur**, puis mène à `/connexion`. Après cela, le jeton de l'ancienne session est refusé même s'il est présenté à nouveau. La déconnexion est déclenchée par un bouton de formulaire, jamais par un lien ni par une requête GET (un préchargement de lien ne doit pas pouvoir déconnecter). Si la session a déjà expiré ou a déjà été fermée dans un autre onglet, le résultat est le même : arrivée sur `/connexion`, sans message d'erreur. **Précision après T3** : la déconnexion se termine par un **rechargement complet du document** vers `/connexion`. C'est la seule exception à la règle « pas de rechargement complet » : la déconnexion est une frontière de sécurité, et le cache de navigation de Next garderait sinon dans le document, masquées, les pages protégées récemment affichées. Après la déconnexion, aucune donnée du propriétaire ne subsiste dans le DOM, même masquée.

**R19 — Bouton Précédent après déconnexion.** Après une déconnexion, revenir en arrière dans l'historique n'affiche jamais le contenu protégé ni l'adresse e-mail : le visiteur aboutit sur `/connexion`.

**R20 — Limitation des tentatives : reportée.** Cette version ne limite ni les tentatives de connexion ni les inscriptions. Elle ne doit donc pas être ouverte au public en l'état (Q8).

**R21 — Envoi des formulaires.** Inscription, connexion et déconnexion sont envoyées en POST. Le mot de passe n'apparaît jamais dans une adresse, et le serveur ne le renvoie jamais dans une page, même après une erreur.

### Routes, protection et redirections

**R22 — Routes.**

| Route | Accès | Visiteur non connecté | Propriétaire connecté |
| --- | --- | --- | --- |
| `/` | publique | page d'accueil | la même page d'accueil, à l'identique (R39) |
| `/inscription` | publique | formulaire d'inscription | redirigé vers `/tableau-de-bord` |
| `/connexion` | publique | formulaire de connexion | redirigé vers `/tableau-de-bord`, quel que soit `retour` |
| `/tableau-de-bord` | protégée | redirigé vers `/connexion?retour=…` (R23) | espace réservé |

Cas « déjà là » : `/connexion` et `/inscription` étant publiques, un visiteur non connecté qui s'y trouve n'est jamais redirigé, et aucune boucle n'est possible. Un propriétaire connecté qui demande `/tableau-de-bord` y reste. Une adresse inconnue affiche la page 404 de Next, connecté ou non.

**R23 — Protection.** Un visiteur non connecté (pas de session, session expirée ou jeton invalide) qui demande une page protégée est redirigé vers `/connexion?retour=<chemin et paramètres demandés, encodés>`, y compris quand la page demandée est `/tableau-de-bord` sans paramètre. Il ne voit jamais, même un instant, le contenu protégé : ni le titre de la page, ni l'adresse e-mail, ni le bouton de déconnexion ne figurent dans ce que le serveur lui envoie. Seuls l'en-tête réduit au logo et l'état de chargement (R24) peuvent lui parvenir avant la redirection. Le type de redirection (réponse HTTP ou navigation déclenchée après un premier affichage) est laissé au développeur : seuls l'adresse d'arrivée et l'absence de contenu protégé sont exigés.

**R24 — Chargement et panne.** Pendant que la session est vérifiée, la zone de contenu d'une page protégée affiche le texte « Chargement en cours » et rien d'autre. Si la base de données est injoignable, aucune page n'affiche de contenu protégé : `/tableau-de-bord` affiche l'écran « Service momentanément indisponible » (voir « Contenus ») ; les formulaires affichent le message E8 et ne créent ni compte ni session. Dans le doute, l'accès est refusé. **Précision après T3** : `/tableau-de-bord` est rendu d'un bloc sur le serveur (rendu bloquant), pour s'afficher sans JavaScript (R29). Il n'a donc **pas** d'état « Chargement en cours » : la première phrase de cette règle ne s'applique plus. Une base qui ne répond pas dans un délai de quelques secondes est traitée comme une base injoignable : la page n'attend jamais indéfiniment.

### Formulaires et accessibilité

**R25 — Messages d'erreur.** Textes exacts dans « Contenus ». Deux emplacements :

- **Erreur de champ** (E1 à E6) : sous le champ concerné, dans un élément relié au champ de sorte que le lecteur d'écran le lise avec le libellé (`aria-describedby`) ; le champ porte `aria-invalid="true"` et la bordure d'erreur (R32). Un champ n'affiche qu'un message à la fois, le premier applicable dans l'ordre E1, E2, E3 pour l'e-mail et E4, E5, E6 pour le mot de passe. Les deux champs peuvent être en erreur en même temps.
- **Erreur de formulaire** (E7, E8) : dans un message de formulaire (R34) placé entre le titre de la page et le premier champ, avec le rôle `alert`.

Une erreur disparaît à la soumission suivante si elle est corrigée, pas pendant la frappe.

**R26 — Saisie après une erreur.** Quelle que soit l'erreur, l'adresse e-mail saisie est conservée dans son champ (telle que saisie) et le champ « Mot de passe » est vidé.

**R27 — Focus.** Avec JavaScript actif : après une soumission refusée pour une erreur de champ, le focus est placé sur le premier champ en erreur dans l'ordre du formulaire ; après une erreur de formulaire (E7, E8), il est placé sur le message de formulaire. Après une soumission réussie, la nouvelle page s'affiche en haut, son titre de document est celui de la nouvelle page, et la première tabulation atteint son premier élément focalisable. À l'ouverture de `/inscription` et de `/connexion`, aucun champ ne prend le focus automatiquement.

**R28 — Attente.** Avec JavaScript actif, entre l'envoi et la réponse : le bouton d'envoi affiche son libellé d'attente, ne peut pas être activé une seconde fois et l'annonce aux technologies d'assistance ; les champs gardent leur valeur. Deux activations rapides ne produisent qu'une seule demande aboutie (un seul compte, une seule session). **Précision après la recette de T2** : pendant l'attente, le bouton désactivé se distingue aussi visuellement du bouton actif (opacité réduite à 60 %, pas de changement au survol), sans changer de taille.

**R29 — Fonctionnement sans JavaScript : exigé.** Avec JavaScript désactivé, l'inscription, la connexion et la déconnexion aboutissent, et les erreurs s'affichent avec les mêmes textes aux mêmes emplacements, l'e-mail conservé et le mot de passe vidé. Seuls manquent alors le déplacement du focus (R27), l'état d'attente (R28) et le bouton d'affichage du mot de passe, qui peut rester sans effet mais ne doit jamais envoyer le formulaire. Justification : les formulaires envoyés au serveur le permettent sans surcoût notable, et un formulaire de connexion qui ne répond pas tant que le JavaScript n'est pas chargé est un défaut réel sur mobile.

**R30 — Libellés et attributs des champs.** Chaque champ a un libellé visible au-dessus de lui, relié au champ. Aucun texte d'exemple dans le champ (`placeholder`) : la couleur prévue pour lui n'est pas lisible. Tous les champs sont déclarés obligatoires aux technologies d'assistance.

| Champ | Page | Type | `autocomplete` | Autres |
| --- | --- | --- | --- | --- |
| Adresse e-mail | inscription et connexion | `email` | `username` | clavier e-mail sur mobile, pas de majuscule automatique, pas de correction orthographique |
| Mot de passe | inscription | `password` | `new-password` | relié à son texte d'aide |
| Mot de passe | connexion | `password` | `current-password` | |

Ordre de tabulation des deux formulaires : « Adresse e-mail », « Mot de passe », bouton d'affichage du mot de passe, bouton d'envoi, lien de bas de carte.

### Design

`DESIGN.md` décrit ces composants ; aucun n'existe encore dans le code. Cette fonctionnalité les introduit, avec les tokens de la spécification 01 et sans couleur en dur (R11 de la spécification 01).

**R31 — Couleur du texte d'erreur (réponse à Q5 de la spécification 01).** Le token `error` (`#EF4444`) ne donne que 3.76:1 sur `surface` et environ 3.6:1 sur `background` : insuffisant pour du texte (seuil de 4.5:1 de `DESIGN.md`). Un nouveau token est ajouté, exposé comme les autres (R10 de la spécification 01) :

| Token | Valeur | Contraste | Usage |
| --- | --- | --- | --- |
| `error-text` | `#B91C1C` | 6.47:1 sur `surface`, environ 6.2:1 sur `background` | tout texte d'erreur |

`error` reste réservé aux éléments non textuels (bordure d'un champ en erreur, bordure du message de formulaire), où 3:1 suffit. Les équivalents pour `success` et `warning` seront définis par la spécification qui introduira les statuts de loyer. `DESIGN.md` doit être mis à jour en conséquence (Q3).

**R32 — Champ de saisie.** Fond `surface`, bordure 1px `border`, rayon 6px, marge intérieure 10px verticale et 14px horizontale, texte 14px `text-primary`, largeur égale à celle du formulaire. Libellé au-dessus, 14px graisse 500, `text-primary`, à 8px du champ. Texte d'aide sous le champ, `small` (13px), `text-secondary`. Focus : bordure `primary` et ombre `focus`. Erreur : bordure `error` ; message sous le champ, `small` (13px), couleur `error-text`, placé avant le texte d'aide s'il y en a un. Voir Q9 pour le contraste de la bordure au repos.

**R33 — Boutons.** Rayon 6px, graisse 500, décalage de 1px vers le haut au survol, supprimé si l'utilisateur a demandé la réduction des animations.

| Variante | Apparence | Utilisée pour |
| --- | --- | --- |
| Primaire, grande (44px) | celle de R26 de la spécification 01 | bouton d'envoi des deux formulaires, sur toute la largeur du formulaire ; « Créer mon compte » de l'accueil |
| Secondaire, petite (32px) | fond transparent, bordure 1px `border`, texte 14px `text-primary`, marge intérieure horizontale 12px, fond `border` au survol | « Se connecter » de l'en-tête d'accueil, « Se déconnecter », « Réessayer » |
| Discrète, petite (32px) | ni fond ni bordure, texte 13px `text-secondary`, qui passe en `text-primary` au survol | bouton d'affichage du mot de passe |

Un bouton en attente (R28) garde sa taille et n'a ni décalage ni lueur au survol. Un seul bouton primaire par écran.

**R34 — Message de formulaire.** Bloc sur toute la largeur du formulaire : fond `surface`, bordure 1px `error`, rayon 8px, marge intérieure 12px verticale et 16px horizontale, texte 14px `error-text`. Sans icône. Il n'occupe aucun espace quand il n'y a pas d'erreur.

**R35 — Mise en page de `/inscription` et `/connexion`.** Sous l'en-tête, une carte unique centrée horizontalement : fond `surface`, bordure 1px `border`, rayon 12px, sans ombre, marge intérieure 24px, largeur de 400px au plus et jamais plus large que la fenêtre moins 24px de chaque côté. **Tout le contenu de l'écran est dans la carte**, titre `h1` compris : titre, introduction, message de formulaire, champs, bouton, textes et lien de bas de carte. Titre `h1` : token `title` (32px) à partir de 768px, `subtitle` (24px) en dessous. Espacement vertical de 24px entre les blocs de la carte, 16px entre les deux champs. Aucun défilement horizontal de 320px à 1920px.

**R36 — En-têtes.** `/inscription`, `/connexion` et `/tableau-de-bord` ont le même en-tête que l'accueil pour la barre (R24 de la spécification 01 : fixe, 56px, fond translucide, filet bas), sans navigation ni lien d'évitement.

| Page | À gauche | À droite |
| --- | --- | --- |
| `/inscription`, `/connexion` | logo « Quittances », lien vers `/`, nom accessible `Quittances, accueil` | rien |
| `/tableau-de-bord` | logo « Quittances », lien vers `/tableau-de-bord`, nom accessible `Quittances, tableau de bord` | bouton `Se déconnecter` |

Le logo est toujours un lien `next/link`. Cas « déjà là » : sur `/tableau-de-bord`, activer le logo laisse sur la page, ramène le défilement en haut et ne recharge pas le document. Chaque page a les repères `banner` et `main`.

**R37 — Focus visible.** R29 de la spécification 01 (contour plein de 2px `primary`, décalé de 2px, avec l'ombre `focus`) s'applique désormais aussi à tous les boutons et au message de formulaire quand il reçoit le focus. Les champs suivent R32.

### Page d'accueil

**R38 — Modifications de la page d'accueil.**

| Élément | Avant | Après |
| --- | --- | --- |
| Bouton primaire du bloc d'accroche | lien `Voir comment ça marche` vers `#fonctionnement` | lien `Créer mon compte` vers `/inscription`, même apparence (R26 de la spécification 01) |
| Section « Les inscriptions ouvrent bientôt » | titre `h2`, un paragraphe, identifiant `inscriptions` | supprimée en entier, sans remplacement ; l'ancre `#inscriptions` n'existe plus |
| En-tête, à droite | navigation seule | la navigation, puis un lien `Se connecter` vers `/connexion` |
| Tout le reste (surtitre, `h1`, accroche, étapes, cartes, pied de page, logo, lien d'évitement, métadonnées) | | inchangé |

Le lien « Se connecter » a l'apparence d'un bouton secondaire petit (R33). Il est visible et atteignable **à toutes les largeurs**, y compris sous 768px où la navigation est masquée. Il est dans l'en-tête mais **hors** de la navigation « Navigation principale », qui garde exactement ses deux liens. Les deux nouveaux liens passent par `next/link` : leur activation ne recharge pas le document. Le libellé « Voir comment ça marche » disparaît de la page ; les ancres `#fonctionnement` et `#fonctionnalites` restent atteignables par l'en-tête à partir de 768px.

**R39 — La page d'accueil reste statique et identique pour tous.** Elle ne lit ni cookie ni session et reste pré-rendue au build. Un propriétaire déjà connecté qui s'y rend voit donc la même page, avec les mêmes liens : « Se connecter » et « Créer mon compte » le mènent tous deux à `/tableau-de-bord`, par la redirection de R22. Il n'est pas redirigé automatiquement depuis `/`. Justification : personnaliser l'en-tête obligerait à rendre la page à chaque requête ou à l'adapter après coup dans le navigateur, pour un bénéfice mince ; le libellé légèrement inexact pour un propriétaire connecté est le prix accepté. **Précision après T3** : le proxy qui renouvelle le cookie de session ne s'exécute pas sur la page d'accueil. Une visite de `/` ne déclenche aucune lecture en base, même pour un propriétaire connecté. Il s'exécute sur les pages protégées et sur `/connexion` et `/inscription`.

### Données de test

**R40 — Tests et base de données.**

1. Aucun test n'écrit ni ne lit dans la base de développement. Les tests qui ont besoin d'une base utilisent une base de test distincte, désignée par sa propre configuration (Q1). Si cette configuration manque, le lancement échoue avec un message clair : il ne se rabat jamais sur la base de développement.
2. Chaque test crée lui-même les comptes dont il a besoin, avec des adresses uniques à chaque exécution, dans le domaine réservé `quittances.test`. Aucun test ne dépend d'un compte créé par un autre test, ni de l'ordre d'exécution, ni d'une base vide. Les tests passent en parallèle et sur les deux projets Playwright.
3. Les comptes du domaine `quittances.test` peuvent être purgés à tout moment sans conséquence.
4. `pnpm test` (Vitest) continue de réussir sans aucune base joignable : les tests Vitest portent sur les règles pures (R9) et sur le rendu.

L'outillage (branche Neon, variables, scripts) est du ressort du développeur et de la QA.

## Contenus

À reprendre mot pour mot, avec l'apostrophe droite (`'`), comme en R15 de la spécification 01. Les textes évitent deux-points, point-virgule, point d'interrogation et point d'exclamation.

### Page `/inscription`

- Titre du document : `Créer un compte — Quittances`
- Titre `h1` : `Créer un compte`
- Introduction (`text-secondary`) : `Un compte par propriétaire, pour toutes vos locations.`
- Champ 1, libellé : `Adresse e-mail`
- Champ 2, libellé : `Mot de passe`
- Texte d'aide du champ 2 : `12 caractères au minimum. Conservez-le précieusement, un mot de passe oublié ne peut pas encore être réinitialisé.`
- Bouton d'affichage du mot de passe : texte visible `Afficher` et nom accessible `Afficher le mot de passe` quand la saisie est masquée ; texte visible `Masquer` et nom accessible `Masquer le mot de passe` quand elle est affichée
- Bouton d'envoi : `Créer mon compte` ; en attente : `Création en cours`
- Bas de carte (`small`, `text-secondary`) : `Vous avez déjà un compte.` suivi du lien `Se connecter` vers `/connexion`

### Page `/connexion`

- Titre du document : `Connexion — Quittances`
- Titre `h1` : `Connexion`
- Pas d'introduction
- Champ 1, libellé : `Adresse e-mail`
- Champ 2, libellé : `Mot de passe` (sans texte d'aide)
- Bouton d'affichage du mot de passe : comme sur `/inscription`
- Bouton d'envoi : `Se connecter` ; en attente : `Connexion en cours`
- Sous le bouton (`small`, `text-secondary`) : `La réinitialisation du mot de passe n'est pas encore disponible.`
- Bas de carte (`small`, `text-secondary`) : `Pas encore de compte.` suivi du lien `Créer un compte` vers `/inscription` (sans paramètre `retour`)
- Aucun lien ni bouton « Mot de passe oublié »

Cas « déjà là » : `/connexion` ne contient aucun lien vers `/connexion`, `/inscription` aucun lien vers `/inscription`. Les liens de bas de carte sont des liens de texte : couleur `primary`, soulignés.

### Messages d'erreur

| Code | Page | Emplacement | Condition | Texte |
| --- | --- | --- | --- | --- |
| E1 | les deux | sous « Adresse e-mail » | champ vide après normalisation | `Saisissez votre adresse e-mail.` |
| E2 | inscription | sous « Adresse e-mail » | format invalide, ou adresse refusée par la bibliothèque d'authentification (R5) | `Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.` |
| E3 | inscription | sous « Adresse e-mail » | adresse déjà utilisée (R12) | `Un compte existe déjà avec cette adresse e-mail.` |
| E4 | les deux | sous « Mot de passe » | champ vide | `Saisissez votre mot de passe.` |
| E5 | inscription | sous « Mot de passe » | moins de 12 caractères | `Le mot de passe doit contenir au moins 12 caractères.` |
| E6 | inscription | sous « Mot de passe » | plus de 128 caractères | `Le mot de passe ne peut pas dépasser 128 caractères.` |
| E7 | connexion | message de formulaire | tout autre échec (R13) | `Adresse e-mail ou mot de passe incorrect.` |
| E8 | les deux | message de formulaire | panne (base injoignable, erreur inattendue) | `Le service est momentanément indisponible. Réessayez dans quelques instants.` |

E3 n'est vérifiée que si l'adresse et le mot de passe sont par ailleurs valides.

### Page `/tableau-de-bord`

- Titre du document : `Tableau de bord — Quittances`
- En-tête : logo (R36), bouton `Se déconnecter`
- Titre `h1` (token `title` à partir de 768px, `subtitle` en dessous) : `Tableau de bord`
- Paragraphe (`text-secondary`) : `Connecté en tant que ` suivi de l'adresse e-mail normalisée du propriétaire, en `text-primary`. Une adresse longue passe à la ligne sans créer de défilement horizontal.
- État vide (carte de R27 de la spécification 01) : titre `h2` (15px display 700) `Aucune location pour l'instant`, puis le texte (`text-secondary`) `L'ajout de locations arrivera dans une prochaine version.` Aucun bouton dans la carte : celui de `DESIGN.md` (« Ajouter une location ») viendra avec la fonctionnalité.
- État de chargement : aucun (rendu bloquant, voir la précision de R24)
- Contenu dans le conteneur de 1280px de la spécification 01, aligné à gauche. Pas de pied de page.

### Écran de panne de `/tableau-de-bord`

- Titre `h1` : `Service momentanément indisponible`
- Texte (`text-secondary`) : `Cette page ne peut pas être affichée pour le moment.`
- Bouton secondaire : `Réessayer`, qui relance le chargement de la page
- L'en-tête n'affiche que le logo.

### Page d'accueil `/`

Voir R38. Textes ajoutés : `Créer mon compte`, `Se connecter`. Textes supprimés : `Voir comment ça marche`, `Les inscriptions ouvrent bientôt`, `Quittances est en cours de développement. La création de compte n'est pas encore disponible.`

## Parcours utilisateur

### 1. Créer un compte

1. Sur `/`, le visiteur active « Créer mon compte ». `/inscription` s'affiche sans rechargement du document. S'il y est arrivé directement par l'adresse, même écran.
2. **État vide** : carte avec les deux champs vides, mot de passe masqué, aucun message d'erreur, aucun champ focalisé.
3. Il saisit son adresse et un mot de passe, peut activer « Afficher » pour se relire, puis active « Créer mon compte ».
4. **Attente** : le bouton affiche « Création en cours » et ne répond plus.
5. **Succès** : il arrive sur `/tableau-de-bord`, connecté ; son adresse normalisée est affichée.
6. **Erreur de validation** : il reste sur `/inscription` ; les messages s'affichent sous les champs concernés, l'adresse est conservée, le mot de passe est vidé, le focus est sur le premier champ en erreur.
7. **Adresse déjà utilisée** : comme l'étape 6, avec E3 ; le lien « Se connecter » du bas de carte est la suite logique.
8. **Panne** : il reste sur `/inscription`, E8 s'affiche au-dessus des champs et prend le focus ; aucun compte n'est créé.
9. **Déjà connecté** : demander `/inscription` mène à `/tableau-de-bord` sans afficher le formulaire.

### 2. Se connecter

1. Sur `/`, le visiteur active « Se connecter », ou il arrive sur `/connexion` par une redirection (parcours 4).
2. **État vide** : comme pour l'inscription, avec la phrase sur la réinitialisation.
3. Il saisit ses identifiants et active « Se connecter ». **Attente** : « Connexion en cours ».
4. **Succès** : il arrive sur la destination de retour si elle est sûre, sinon sur `/tableau-de-bord`.
5. **Champ vide** : E1 ou E4 sous le champ, focus sur le premier champ en erreur.
6. **Identifiants refusés** : il reste sur `/connexion` (le paramètre `retour` éventuel est conservé), E7 s'affiche au-dessus des champs et prend le focus, l'adresse est conservée, le mot de passe est vidé.
7. **Panne** : comme l'étape 6, avec E8.
8. **Déjà connecté** : demander `/connexion`, avec ou sans `retour`, mène à `/tableau-de-bord`.

### 3. Espace réservé et déconnexion

1. `/tableau-de-bord` affiche le titre, « Connecté en tant que … » et la carte d'état vide, d'un bloc, sans état de chargement.
2. Recharger la page, fermer puis rouvrir le navigateur : il reste connecté (R16).
3. Il active « Se déconnecter » : il arrive sur `/connexion`, formulaire vide, sans message.
4. Précédent : il reste ou revient sur `/connexion`, jamais sur le contenu protégé (R19).
5. **Panne** : écran « Service momentanément indisponible » avec « Réessayer ».

### 4. Demander une page protégée sans être connecté

1. Le visiteur demande `/tableau-de-bord?exemple=1` sans session (ou avec une session expirée).
2. Il arrive sur `/connexion?retour=%2Ftableau-de-bord%3Fexemple%3D1`, sans avoir vu le contenu protégé.
3. Après connexion, il arrive sur `/tableau-de-bord?exemple=1`.
4. S'il préfère créer un compte depuis cette page, il arrive après inscription sur `/tableau-de-bord` (R11).

### 5. Page d'accueil

1. Visiteur ou propriétaire connecté, même page (R39). Tabulation depuis le haut, à partir de 768px : « Aller au contenu », logo, « Fonctionnement », « Fonctionnalités », « Se connecter », « Créer mon compte ». En dessous de 768px : « Aller au contenu », logo, « Se connecter », « Créer mon compte ».
2. Logo : inchangé (étape 4 du parcours de la spécification 01, cas « déjà sur `/` » compris).

### JavaScript désactivé

Tous les parcours aboutissent (R29), avec un rechargement de page à chaque envoi.

## Critères d'acceptation

Niveau de vérification : [V] Vitest, sans base ; [N] navigateur (Playwright, projets `bureau` et `mobile`, contre la base de test) ; [C] ligne de commande, lecture du dépôt ou test d'intégration contre la base de test. Dans tous les critères, « un compte » désigne un compte créé par le test lui-même (R40).

### Socle technique

- **CA1** [C] Étant donné une base de test vide, quand on applique les migrations par la commande documentée, alors elle réussit ; quand on la relance, alors elle réussit sans rien modifier.
- **CA2** [C] Étant donné la base de test migrée, quand un test d'intégration crée un compte, ouvre une session, demande le propriétaire courant, ferme la session puis redemande le propriétaire courant avec le même jeton, alors la première demande renvoie le compte créé (adresse normalisée) et la seconde ne renvoie aucun propriétaire.
- **CA3** [C] Étant donné un compte créé avec un mot de passe connu, quand on cherche ce mot de passe dans toutes les données de la base de test, alors il n'y figure nulle part.
- **CA4** [C] Étant donné un compte `marie@quittances.test`, quand on tente de créer un compte avec ` Marie@Quittances.test `, alors la création est refusée ; et étant donné deux créations simultanées avec une même adresse nouvelle, alors exactement un compte existe ensuite.
- **CA5** [C] Étant donné le dépôt, quand on lance `pnpm lint`, `pnpm build` et `pnpm test`, alors les trois réussissent, `pnpm test` réussissant aussi sans base joignable ; `.env.example` nomme chaque variable d'environnement requise, sans valeur ; aucun secret ni chaîne de connexion n'est présent dans les fichiers suivis par git.
- **CA6** [C] Étant donné que la configuration de la base de test est absente, quand on lance les tests qui en dépendent, alors ils échouent avec un message qui nomme la configuration manquante, et aucune requête ne part vers la base de développement.

### Règles pures

- **CA7** [V] Étant donné la règle de l'adresse e-mail, quand on lui soumet ` Marie.Durand+loyer@Exemple.FR `, alors elle est acceptée et normalisée en `marie.durand+loyer@exemple.fr` ; quand on lui soumet une chaîne vide ou faite d'espaces, alors E1 ; quand on lui soumet `marie`, `marie@`, `@exemple.fr`, `marie@exemple`, `marie@.fr`, `marie@exemple.`, `ma rie@exemple.fr`, `marie@@exemple.fr` ou une adresse de 255 caractères, alors E2.
- **CA8** [V] Étant donné la règle du mot de passe d'inscription, quand on lui soumet une chaîne vide, alors E4 ; 11 caractères, alors E5 ; 12 caractères identiques (`aaaaaaaaaaaa`), 12 espaces ou 128 caractères, alors acceptés sans modification ; 129 caractères, alors E6.
- **CA9** [V] Étant donné la règle de destination de retour, quand la valeur est `/tableau-de-bord`, `/tableau-de-bord?exemple=1` ou `/locations/12#loyers`, alors elle est retenue à l'identique ; quand elle est absente, vide, `https://exemple.test`, `//exemple.test`, `/\exemple.test`, `\/exemple.test`, `javascript:alert(1)`, `tableau-de-bord`, `/connexion`, `/connexion?retour=/x` ou `/inscription`, alors la destination est `/tableau-de-bord`.

### Inscription

- **CA10** [N] Étant donné un visiteur non connecté, quand il ouvre `/inscription`, alors le titre du document, le `h1`, l'introduction, les deux libellés, le texte d'aide, le bouton d'envoi et le bas de carte ont les textes exacts de « Contenus » ; les champs ont les types et `autocomplete` de R30 ; ils sont vides, sans `placeholder`, aucun n'a le focus ; aucun message d'erreur n'est présent ; le lien « Se connecter » mène à `/connexion` sans recharger le document.
- **CA11** [N] Étant donné un visiteur non connecté, quand il envoie ` Prenom.Nom-<unique>@Quittances.test ` et un mot de passe de 12 caractères, alors il arrive sur `/tableau-de-bord`, qui affiche « Connecté en tant que » suivi de l'adresse en minuscules et sans espaces.
- **CA12** [N] Étant donné `/inscription`, quand on envoie le formulaire vide, alors on reste sur `/inscription`, E1 est sous « Adresse e-mail » et E4 sous « Mot de passe », chaque champ porte `aria-invalid="true"` et son message fait partie de sa description accessible, le focus est sur « Adresse e-mail », aucune bulle native n'apparaît ; quand on envoie ensuite `marie@exemple` et un mot de passe de 11 caractères, alors E2 et E5 remplacent E1 et E4, le champ e-mail contient encore `marie@exemple` et le champ mot de passe est vide ; quand on envoie une adresse valide et 11 caractères, alors seul E5 reste et le focus est sur « Mot de passe ».
- **CA13** [N] Étant donné un compte existant, quand un visiteur non connecté envoie l'inscription avec la même adresse (casse différente) et un autre mot de passe valide, alors E3 s'affiche sous « Adresse e-mail », `/tableau-de-bord` le redirige toujours vers `/connexion`, et le compte existant se connecte toujours avec son mot de passe d'origine et pas avec le nouveau.
- **CA14** [N] Étant donné `/inscription` rempli de valeurs valides et une réponse du serveur retardée par le test, quand on active deux fois de suite le bouton d'envoi, alors pendant l'attente le bouton affiche `Création en cours` et est indisponible, et à l'arrivée un seul compte existe pour cette adresse (une nouvelle inscription avec elle donne E3, sans erreur de panne).
- **CA15** [N] Étant donné un champ « Mot de passe » rempli sur `/inscription` ou `/connexion`, quand on active « Afficher le mot de passe », alors la saisie devient lisible, le bouton se nomme « Masquer le mot de passe » et le formulaire n'est pas envoyé ; quand on l'active à nouveau, alors la saisie est masquée et la valeur n'a pas changé.

### Espace réservé, protection et déconnexion

- **CA16** [N] Étant donné un propriétaire connecté, quand il ouvre `/tableau-de-bord`, alors le titre du document, le `h1`, la phrase « Connecté en tant que » avec son adresse, le `h2` et le texte de l'état vide sont ceux de « Contenus » ; l'en-tête contient le logo nommé `Quittances, tableau de bord` et le bouton `Se déconnecter` ; la page ne contient aucun autre lien ni bouton ; activer le logo après avoir défilé laisse sur `/tableau-de-bord`, en haut de page, sans requête de document.
- **CA17** [N] Étant donné un visiteur sans session, ou avec un cookie de session au jeton inventé, quand il demande `/tableau-de-bord?exemple=1`, alors il aboutit sur `/connexion?retour=%2Ftableau-de-bord%3Fexemple%3D1`, et aucune réponse reçue du serveur pendant ce trajet ne contient `Tableau de bord` dans un titre, `Connecté en tant que` ni `Se déconnecter`.
- **CA18** [N] Étant donné un propriétaire connecté dont le test a relevé le cookie de session, quand il active « Se déconnecter », alors il arrive sur `/connexion` ; quand il demande ensuite `/tableau-de-bord`, alors il est redirigé vers `/connexion` ; quand le test réinjecte le cookie relevé et redemande `/tableau-de-bord`, alors il est encore redirigé vers `/connexion`.
- **CA19** [N] Étant donné un propriétaire qui vient de se déconnecter depuis `/tableau-de-bord`, quand il utilise le bouton Précédent du navigateur, alors l'adresse finale est `/connexion` et ni son adresse e-mail ni « Tableau de bord » ne sont affichés à aucun moment.
- **CA20** [N] Étant donné deux comptes A et B connectés chacun dans son propre contexte de navigateur, quand chacun ouvre `/tableau-de-bord`, alors la page de A contient l'adresse de A et nulle part celle de B (ni dans le texte, ni dans le code source de la page), et inversement ; quand A se déconnecte, alors B est toujours connecté.
- **CA21** [N] Étant donné un même compte connecté dans deux contextes de navigateur, quand il se déconnecte dans le premier, alors le second affiche toujours `/tableau-de-bord` après rechargement.
- **CA22** [N] Étant donné un propriétaire qui vient de se connecter, quand on inspecte les cookies du navigateur, alors le cookie de session est `HttpOnly`, son `SameSite` vaut `Lax` ou `Strict`, son expiration tombe entre 59 et 61 jours plus tard, il ne contient pas l'adresse e-mail, et `document.cookie` ne le montre pas.

### Connexion

- **CA23** [N] Étant donné un visiteur non connecté, quand il ouvre `/connexion`, alors le titre du document, le `h1`, les deux libellés, le bouton d'envoi, la phrase sur la réinitialisation et le bas de carte ont les textes exacts de « Contenus » ; les champs ont les types et `autocomplete` de R30 ; la page ne contient aucun lien ni bouton dont le nom contient « oublié » ; le lien « Créer un compte » mène à `/inscription` sans recharger le document.
- **CA24** [N] Étant donné un compte `prenom-<unique>@quittances.test`, quand son propriétaire se connecte en saisissant ` PRENOM-<unique>@Quittances.test ` et son mot de passe, alors il arrive sur `/tableau-de-bord`.
- **CA25** [N] Étant donné un compte existant, quand on envoie la connexion avec son adresse et un mauvais mot de passe, puis avec une adresse inconnue, puis avec `marie@exemple` et un mot de passe quelconque, alors les trois réponses sont identiques : on reste sur `/connexion`, le message de formulaire affiche E7 avec le rôle `alert` et a le focus, aucun message n'apparaît sous les champs, le champ e-mail garde la saisie, le champ mot de passe est vide, et `/tableau-de-bord` redirige toujours vers `/connexion`. Quand on envoie le formulaire vide, alors E1 et E4 s'affichent sous les champs et E7 n'apparaît pas.
- **CA26** [N] Étant donné un compte existant et un visiteur non connecté, quand il se connecte depuis `/connexion?retour=%2Ftableau-de-bord%3Fexemple%3D1`, alors il arrive sur `/tableau-de-bord?exemple=1`, y compris après un premier essai refusé (E7) ; quand il se connecte depuis `/connexion?retour=https%3A%2F%2Fexemple.test` ou `/connexion?retour=%2F%2Fexemple.test`, alors il arrive sur `/tableau-de-bord` et aucune requête ne part vers `exemple.test`.
- **CA27** [N] Étant donné un propriétaire connecté, quand il demande `/connexion`, `/connexion?retour=%2Ftableau-de-bord%3Fexemple%3D1` ou `/inscription`, alors il aboutit sur `/tableau-de-bord` sans paramètre et aucun formulaire ne lui est affiché.

### Robustesse, accessibilité et présentation

- **CA28** [N] Étant donné un navigateur dont JavaScript est désactivé, quand on envoie l'inscription vide, puis avec des valeurs valides, qu'on se déconnecte, qu'on envoie la connexion avec un mauvais mot de passe puis avec le bon, alors on obtient successivement : E1 et E4 sous leurs champs ; l'arrivée sur `/tableau-de-bord` avec l'adresse affichée ; l'arrivée sur `/connexion` ; E7 avec l'adresse conservée et le mot de passe vidé ; l'arrivée sur `/tableau-de-bord`. À aucune étape le mot de passe n'apparaît dans une adresse.
- **CA29** [N, manipulation manuelle] Étant donné l'application lancée avec une chaîne de connexion pointant vers une base injoignable, quand on envoie l'inscription puis la connexion avec des valeurs valides, alors chacune affiche E8 dans le message de formulaire, avec l'adresse conservée ; quand on demande `/tableau-de-bord`, alors on voit soit la redirection vers `/connexion`, soit l'écran « Service momentanément indisponible » avec le bouton « Réessayer », et jamais le contenu protégé ni un message technique (trace, nom de base, requête).
- **CA30** [N] Étant donné `/inscription` et `/connexion` dans leur état vide puis dans un état d'erreur (CA12, CA25), et `/tableau-de-bord` connecté, quand on lance une analyse axe avec les règles WCAG 2.1 A et AA, alors elle ne remonte aucune violation, sur `bureau` comme sur `mobile` ; et la couleur calculée de tout message d'erreur est `rgb(185, 28, 28)`.
- **CA31** [N] Étant donné `/inscription` à 320, 412, 768 et 1280px de large, quand la page est chargée, alors il n'y a pas de défilement horizontal ; la carte fait 400px de large au plus, est centrée et contient le `h1` ; un champ a une bordure de 1px `rgb(232, 232, 236)`, un rayon de 6px et un fond blanc, et sa bordure devient `rgb(239, 68, 68)` en erreur et `rgb(79, 70, 229)` au focus ; le bouton d'envoi mesure 44px de haut, a le fond `rgb(79, 70, 229)` et la largeur des champs ; le `h1` mesure 24px sous 768px et 32px à partir de 768px.
- **CA32** [N] Étant donné les parcours 1 à 4 déroulés d'un bout à l'autre, erreurs comprises, quand on observe la console du navigateur, alors elle n'affiche aucune erreur ni avertissement, d'hydratation notamment ; et à la tabulation, chaque champ, bouton et lien des trois pages reçoit le focus dans l'ordre de R30 avec un indicateur visible (R32, R37).

### Page d'accueil

- **CA33** [V] Étant donné la page d'accueil, quand elle est rendue, alors elle contient exactement deux titres de niveau 2 (`Comment ça marche`, `Ce que fait Quittances`) ; aucun élément d'identifiant `inscriptions` ; ni le texte `Voir comment ça marche` ni `Les inscriptions ouvrent bientôt` ; ses liens sont, dans l'ordre du document, `Aller au contenu` (`#contenu`), `Quittances, accueil` (`/`), `Fonctionnement` (`#fonctionnement`), `Fonctionnalités` (`#fonctionnalites`), `Se connecter` (`/connexion`), `Créer mon compte` (`/inscription`), et aucun autre ; « Se connecter » est dans le repère `banner` et hors de la navigation « Navigation principale » ; la page ne contient toujours aucun `button`, `form` ni champ.
- **CA34** [N] Étant donné la page `/` à 320px et à 1280px de large, quand on tabule depuis le haut, alors l'ordre est celui du parcours 5 et « Se connecter » est visible aux deux largeurs, sans défilement horizontal ; quand on active « Créer mon compte », alors `/inscription` s'affiche sans requête de document ; de même « Se connecter » vers `/connexion` ; le bouton « Créer mon compte » a le style de CA32 de la spécification 01 et reste le seul élément à fond `primary`.
- **CA35** [N] Étant donné un propriétaire connecté, quand il ouvre `/`, alors la page est identique à celle d'un visiteur (mêmes liens, aucune adresse e-mail) ; quand il active « Se connecter » ou « Créer mon compte », alors il aboutit sur `/tableau-de-bord`.
- **CA36** [C] Étant donné le dépôt, quand on lance `pnpm build`, alors la route `/` est listée avec le symbole `○` (Static) et la route `/tableau-de-bord` avec un autre symbole que `○`.

## Effet sur la spécification 01 et sur les tests existants

La spécification 01 n'est pas modifiée par ce document. Sur les points ci-dessous, la spécification 02 prime ; une note en tête de la spécification 01 devra y renvoyer (à faire par l'orchestrateur).

### Règles et critères de la spécification 01

| Référence (spécification 01) | Effet |
| --- | --- |
| R17 | La phrase « Elle ne dit pas qu'un compte peut être créé » est levée. Le reste tient. |
| R18 | Remplacée par R38 : le bouton primaire est « Créer mon compte » vers `/inscription`. |
| R19 | Liens autorisés : `/`, `#contenu`, `#fonctionnement`, `#fonctionnalites`, `/connexion`, `/inscription`. Toujours aucun `button`, `form` ni champ. |
| R20, R21 | Inchangées (R39). Sans JavaScript, les deux nouveaux liens sont des liens ordinaires. |
| R24 | L'en-tête gagne « Se connecter », hors navigation, visible à toutes les largeurs. |
| CA12 | Faux : deux `h2`. Remplacé par CA33. |
| CA16 | Sans objet : la section n'existe plus. À supprimer. |
| CA18 | Faux pour sa première moitié (le lien n'existe plus). La seconde (l'élément `fonctionnement` contient le titre) reste vraie. |
| CA19 | Liste à réduire : `créer mon compte` et `se connecter` sont désormais attendus. Les autres termes restent interdits, `s'inscrire` compris. |
| CA20 | Liste de cibles à étendre à `/connexion` et `/inscription`. |
| CA23 | Le bouton n'existe plus : sur `bureau`, à vérifier par le lien « Fonctionnement » de l'en-tête ; sur `mobile`, par l'arrivée directe sur `/#fonctionnement`. |
| CA28 | Ordre de tabulation remplacé par celui du parcours 5 (CA34). |
| CA32, CA36 | Mêmes vérifications, sur « Créer mon compte ». |
| CA34 | Deux `h2` au lieu de trois ; l'ancre se vérifie par l'arrivée directe sur `/#fonctionnement`, le bouton menant désormais à `/inscription`. |
| CA35 | Le parcours ne passe plus par le bouton ; il doit rester sur `/` (ancres et logo) ou être étendu aux nouvelles pages (CA32 de ce document). |
| Parcours, étapes 1, 2, 3 et 5 | Remplacées par le parcours 5 de ce document et R38. L'étape 4 (logo) tient. |
| Tous les autres | Inchangés, à revérifier en fin de T5. |

### Tests à adapter (en T5, pas avant)

- `src/app/page.test.tsx` : « CA12 » (trois `h2`) ; les deux tests « CA16 » (à supprimer, ainsi que `TEXTE_INSCRIPTIONS`) ; « CA18 — le lien Voir comment ça marche » ; « CA19 » (liste de termes) ; « CA20 — la cible de chaque lien » ; « R19 / parcours étape 5 — l'ordre des liens ». Les autres tests restent vrais.
- `e2e/accueil-contenu.spec.ts` : la constante `BOUTON` (utilisée par « CA32 » deux fois et « CA36 ») ; « CA34 » (nombre de `h2`, clic sur le bouton suivi d'une attente d'ancre).
- `e2e/accueil-entete.spec.ts` : la constante `BOUTON` ; « CA23 : Voir comment ça marche… » ; « CA23, R25 : arrivée directe » (l'ancre `#inscriptions` n'existe plus) ; « CA27 » (la tabulation après le lien d'évitement atteint « Créer mon compte ») ; « CA28 » (ordre attendu) ; « CA29 » (le défilement cherche un lien contenant « Voir comment ») ; « CA35 » (clic sur le bouton puis attente de l'ancre) ; « Parcours étape 4 … depuis `/#inscriptions` » (départ à remplacer par `/#fonctionnalites`) ; « Parcours étape 2 : Précédent après l'ancre » (à faire partir du lien « Fonctionnement » sur `bureau`).
- `e2e/socle-design-system.spec.ts` : aucun test ne devient faux. « CA5 » peut recevoir le token `error-text`.

## Découpage

Cinq tâches, à réaliser et recetter dans cet ordre, une à la fois. La colonne « Sensible » dit si la tâche touche à l'authentification, à l'isolation des données ou à la logique de dates : l'orchestrateur la confie alors au modèle le plus puissant.

| Tâche | Sensible | Critères |
| --- | --- | --- |
| T1 — Socle technique | oui : authentification, isolation | CA1 à CA6 |
| T2 — Composants de formulaire et inscription | oui : authentification | CA7, CA8, CA10 à CA15, CA31 |
| T3 — Espace réservé, protection et déconnexion | oui : authentification, isolation, dates (durée de session) | CA16 à CA22, CA36 pour `/tableau-de-bord` |
| T4 — Connexion et retour | oui : authentification | CA9, CA23 à CA30, CA32 |
| T5 — Page d'accueil | non | CA33 à CA35, CA36 pour `/` |

### T1 — Socle technique (sans interface)

Accès à la base, schéma et migrations du compte et des sessions (R1, R3, R6), bibliothèque d'authentification configurée (R7 pour les longueurs, R16, R17), moyen unique d'obtenir le propriétaire courant (R2), base de test et garde-fou (R40), variables d'environnement documentées. Aucune page, aucun formulaire, aucune modification de l'accueil.

Comment on sait qu'elle est terminée : par CA1 à CA6, tous en ligne de commande. Le développeur livre la commande de migration et un test d'intégration rejouable (CA2 à CA4) ; il indique à l'orchestrateur les commandes à ajouter à la section « Commandes » de `CLAUDE.md`. Il n'y a pas de recette dans le navigateur pour cette tâche : la QA vérifie CA1, CA5 et CA6 en les exécutant.

Points d'attention : les tests e2e tournent sur le port 3100 et le développement sur le port 3000, les deux doivent pouvoir ouvrir une session ; `pnpm build` ne doit pas exiger une base joignable pour la page d'accueil.

### T2 — Composants de formulaire et inscription

Token `error-text`, champ, boutons, message de formulaire, mise en page en carte, en-tête des pages publiques (R31 à R37) ; page `/inscription` complète (R4 à R12, R21, R25 à R30). La destination `/tableau-de-bord` existe sous une forme provisoire mais déjà protégée : elle n'affiche que « Connecté en tant que » et l'adresse, et redirige vers `/connexion` un visiteur non connecté (cette adresse répond 404 jusqu'à T4, ce qui est attendu). Ce contenu provisoire ne fait l'objet d'aucun test durable.

Critères couverts : CA7, CA8, CA10 à CA15, CA31. CA13 se vérifie pour E3 et l'absence de session ; sa dernière partie (connexion du compte existant) se vérifie en T4. CA5 est à revérifier.

### T3 — Espace réservé, protection et déconnexion

Contenu définitif de `/tableau-de-bord`, son en-tête, l'état de chargement, l'écran de panne, la protection et la redirection avec `retour` (R22 à R24), la déconnexion (R18, R19), la durée et le cookie de session vus du navigateur. Pour ces tests, le propriétaire se connecte par l'inscription (T2).

Critères couverts : CA16 à CA22, et CA36 pour `/tableau-de-bord`. Dans CA17 et CA18, « aboutit sur `/connexion` » se vérifie sur l'adresse ; l'affichage de la page se vérifie en T4.

### T4 — Connexion et retour

Page `/connexion` (R13 à R15), destination de retour (R14), redirection des propriétaires connectés (R22). C'est à la fin de cette tâche que la QA déroule la recette complète des parcours 1 à 4 et écrit les tests e2e durables.

Critères couverts : CA9, CA23 à CA30, CA32. À revérifier sur l'ensemble : CA13, CA15, CA17, CA18, CA19.

### T5 — Page d'accueil

Modifications de R38 et R39, et adaptation des tests existants listés plus haut.

Critères couverts : CA33 à CA35, et CA36 pour `/`. À revérifier : tous les critères de la spécification 01 marqués « inchangés », et CA5.

## Questions ouvertes

**Q1 — Base de test (bloque T1).** R40 exige une base distincte de celle de développement, qui n'existe pas encore. Hypothèse recommandée : une branche Neon dédiée aux tests dans le projet existant, créée par l'utilisateur ou l'orchestrateur avant T1, avec sa propre chaîne de connexion dans un fichier d'environnement hors de git ; le nom de la variable et le mécanisme sont laissés au développeur. Autre option : un Postgres local.

**Q2 — Nom du propriétaire (à trancher avant T1, car cela touche au schéma).** Cette spécification ne demande que l'e-mail et le mot de passe. Le nom du bailleur sera sans doute nécessaire sur les documents envoyés au locataire, mais sa forme (personne, plusieurs bailleurs, société) dépend de règles de droit locatif que je ne veux pas figer ici. Hypothèse recommandée : ne rien demander à l'inscription et traiter l'identité du bailleur dans la spécification des locations ou des quittances. Si la bibliothèque d'authentification impose un champ de nom, le développeur le renseigne avec une valeur technique jamais affichée, et le signale.

**Q3 — Token `error-text` et `DESIGN.md` (bloque T2).** Hypothèse recommandée et appliquée (R31) : `error-text` = `#B91C1C` (6.47:1 sur blanc), `error` réservé aux bordures. `DESIGN.md` doit être complété par l'utilisateur ou l'orchestrateur : nouveau token, « message sous le champ » en `error-text`, et bouton « Destructive : texte rouge » à passer lui aussi en `error-text` le jour où il servira. Cela clôt Q5 de la spécification 01 pour l'erreur ; `success` et `warning` restent à traiter avec les statuts de loyer.

**Q4 — Message quand l'adresse est déjà utilisée (à trancher avant T2).** Hypothèse recommandée et appliquée (R12) : message explicite E3, parce que la connexion automatique rend l'énumération possible quel que soit le texte. Autre option : supprimer la connexion automatique et afficher dans tous les cas « Si cette adresse est disponible, votre compte est créé, connectez-vous », ce qui masque l'information mais laisse le propriétaire légitime sans explication et ajoute une étape à tous.

**Q5 — Longueur minimale du mot de passe (à trancher avant T2).** Hypothèse recommandée et appliquée (R7) : 12 à 128 caractères, sans règle de composition. Je n'ai pas vérifié le détail des recommandations en vigueur de la CNIL sur les mots de passe ; à contrôler avant une mise en ligne publique. Autre option : 8 caractères, valeur par défaut courante, moins protectrice.

**Q6 — Pas de confirmation du mot de passe (à trancher avant T2).** Hypothèse recommandée et appliquée (R8) : un seul champ et un bouton d'affichage. L'absence de réinitialisation rend la faute de frappe plus coûteuse qu'ailleurs ; si l'utilisateur juge ce risque trop élevé, ajouter un champ « Confirmer le mot de passe » et un message « Les deux mots de passe ne sont pas identiques. », ce qui ajoute une règle et un critère.

**Q7 — Durée de session.** Hypothèse recommandée et appliquée (R16) : 30 jours glissants, sans case « Rester connecté ». Un propriétaire qui ne vient qu'une fois par mois devra parfois se reconnecter ; 60 jours l'éviteraient, au prix d'une session plus longue sur un appareil partagé.

**Q8 — Conditions avant toute ouverture au public.** Cette version n'est pas faite pour être exposée : pas de limitation des tentatives (R20), pas de réinitialisation du mot de passe, pas de vérification de l'adresse (n'importe qui peut inscrire l'adresse d'un tiers et la bloquer), pas de suppression de compte, pas de mentions légales (Q3 de la spécification 01), et l'application collecte désormais une donnée personnelle sans information de l'utilisateur. Hypothèse recommandée : accepter ces limites tant que le projet reste local, et prévoir une spécification « mise en ligne » qui les traite, après le choix du service d'e-mail. Les obligations exactes en matière de données personnelles sont à faire vérifier, je ne les affirme pas ici.

**Q9 — Contraste de la bordure des champs.** La bordure `border` (`#E8E8EC`) d'un champ au repos n'a qu'environ 1.2:1 sur fond blanc, sous les 3:1 habituellement attendus pour le contour d'un composant ; axe ne le signale pas. Hypothèse recommandée : appliquer `DESIGN.md` tel quel dans cette version (le libellé visible identifie le champ) et décider ensuite d'un token de bordure plus soutenu pour les champs, par exemple `#8C8C8C` (environ 3.4:1).

**Q10 — Textes des écrans.** Titres, textes d'aide et messages sont une proposition. Hypothèse recommandée : les valider tels quels ; toute retouche se fait dans cette spécification avant la tâche concernée, les tests s'appuyant sur le texte exact.
