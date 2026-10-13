# Fiche 19 — Envoyer un e-mail : un effet extérieur

## Ce qui change par rapport à une écriture en base

Une transaction s'annule. Un e-mail parti ne se rattrape pas. Dès qu'une action déclenche un effet hors de la base (e-mail, paiement, appel à une API tierce), on ne peut plus tout faire « ou rien » : il faut choisir ce qui se passe quand une moitié réussit et l'autre échoue.

Deux mauvaises réponses :

- **Envoyer dans la transaction.** Si le `COMMIT` échoue ensuite, le message est parti sans trace. Et l'appel au service (jusqu'à 15 secondes) tient un verrou pendant tout ce temps.
- **Enregistrer « envoyée », puis envoyer.** Si l'envoi échoue, la base ment.

## Les trois temps

```
1. RÉSERVER    transaction + verrou   vérifier, marquer « envoi en cours », COMMIT
2. ENVOYER     ni transaction ni verrou   produire le PDF, appeler le transport
3. ENREGISTRER nouvelle transaction   « envoyée » (date, adresse) ou « échec »
```

- L'état intermédiaire **« en cours » est validé avant l'envoi** : un second clic, un autre onglet ou une requête rejouée le voient et ne renvoient rien. Deux envois simultanés donnent un seul message.
- **Rien de lent sous verrou** : le rendu du PDF et l'appel réseau sont au temps 2.
- Le temps 3 ne vise que la quittance encore « en cours » **pour ce même début d'envoi** : un envoi périmé ne peut pas écraser le résultat d'un envoi plus récent.

## Les cas qu'on ne peut pas éliminer

| Cas | Ce que fait l'application |
| --- | --- |
| Le serveur s'arrête entre 2 et 3 | l'état reste « en cours » ; après 2 minutes il est dit « interrompu, le message est peut-être parti » et l'envoi redevient possible |
| Le message part, l'écriture de la trace échoue | un nouvel essai d'écriture, puis un message qui dit la vérité : « probablement parti, vérifiez avant de renvoyer » |
| Le service ne répond pas | délai de 15 secondes, puis « échec », nouvel essai permis |

La règle : **au moins une fois, plutôt qu'au plus une fois**. Un locataire qui reçoit deux fois sa quittance est préférable à un propriétaire qui la croit envoyée. Et quand l'application ne sait pas, elle le dit.

Pour aller plus loin (non fait ici) : une **boîte d'envoi** (*outbox*), c'est-à-dire une table de messages à envoyer, écrite dans la même transaction que la donnée, et un travailleur qui la vide avec de nouveaux essais. C'est le motif à retenir dès que l'envoi doit être garanti.

## Un module, un transport

Toute l'application passe par `sendEmail`. Derrière lui, un transport interchangeable choisi par une variable d'environnement :

- **local** : n'envoie rien, range le message en base ; une commande l'exporte en fichier `.eml` qu'on ouvre dans sa messagerie ;
- **plus tard, Resend** : même interface (un message en entrée, « accepté » ou un échec classé en sortie).

Le transport local refuse de fonctionner si l'environnement se déclare en production : un mode test ne doit jamais pouvoir être actif par accident, sinon les messages s'accumulent en silence.

Classer les échecs sert l'interface : un refus **définitif** (adresse invalide) appelle une correction, un refus **temporaire** un nouvel essai.

## Sécurité d'un e-mail

- **Le destinataire ne vient jamais du navigateur.** Il est relu en base, dans la location du propriétaire connecté. Sinon l'application devient un relais pour écrire à n'importe qui.
- **Injection d'en-têtes.** Un nom contenant `\r\nBcc: …` ajouterait un destinataire caché. Tout texte placé dans un en-tête (objet, nom affiché) perd ses sauts de ligne et ses caractères de contrôle.
- **HTML échappé**, comme dans une page : un nom `<script>` s'affiche tel quel.
- **Aucune ressource distante** : ni image, ni pixel de suivi, ni lien. Les messageries bloquent les images par défaut, et un pixel de suivi est une collecte de données.
- **`From` et `Reply-To`.** L'expéditeur doit être une adresse du domaine de l'application (c'est lui que SPF, DKIM et DMARC authentifient). La réponse du locataire va au propriétaire par `Reply-To`.
- **Journal** : le résultat et la durée, jamais une adresse ni un objet.

## Le HTML d'un e-mail n'est pas celui d'une page

Les clients de messagerie ont des moteurs anciens et disparates : mise en page en tableaux, styles en ligne, pas de feuille externe, pas de JavaScript. Toujours une version texte à côté. React Email permet d'écrire le gabarit en composants ; ici, pour un message court, une fonction pure construit le HTML à partir du même contenu que le texte.

## L'accord du destinataire

L'envoi dématérialisé d'une quittance demande l'accord exprès du locataire. Le propriétaire l'atteste par une case, enregistrée **avec sa date** ; changer l'adresse renouvelle la date ; décocher arrête les envois. Un consentement est une donnée datée, pas un booléen.

## Questions d'entretien

**Comment envoyer un e-mail après une écriture en base, de façon fiable ?**
Jamais dans la transaction. Soit un état intermédiaire validé avant l'envoi puis un enregistrement du résultat, soit une boîte d'envoi écrite dans la transaction et vidée par un travailleur. Dans les deux cas, l'envoi peut se produire deux fois : il faut le rendre acceptable ou idempotent.

**« Exactement une fois », est-ce possible ?**
Pas entre deux systèmes sans transaction commune. On choisit « au plus une fois » (on peut perdre) ou « au moins une fois » (on peut doubler), et on ajoute une clé d'idempotence quand le service distant en accepte une.

**Où appeler le service d'e-mail dans une application Next ?**
Dans une Server Action ou un Route Handler, sur le serveur, derrière un module unique. La clé d'API ne quitte jamais le serveur, et le destinataire est décidé par le serveur.

**Comment tester sans envoyer de vrai message ?**
Par injection : le code d'envoi reçoit son transport. En test, un faux transport qui enregistre les messages, et qu'on peut faire échouer ou attendre pour vérifier les délais et la concurrence.

**SPF, DKIM, DMARC ?**
SPF : les serveurs autorisés à envoyer pour le domaine. DKIM : la signature du message, vérifiable par une clé publiée dans le DNS. DMARC : la consigne quand l'un des deux échoue, et l'alignement avec le domaine du `From`.

**Qu'est-ce que l'injection d'en-têtes ?**
Une valeur saisie contenant un retour à la ligne, placée dans un en-tête, permet d'en ajouter d'autres (`Bcc`, `Subject`). On retire les sauts de ligne de tout ce qui entre dans un en-tête, et on laisse la bibliothèque encoder.
