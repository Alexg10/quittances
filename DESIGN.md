# Quittances — design system

Adapté du design system « Genesis ».

## Overview

Interface de gestion pour propriétaires bailleurs : suivre ses locations, confirmer les loyers reçus, envoyer quittances et relances. L'esthétique est sobre et précise — titres affirmés, espacement généreux, surfaces à plat bordées d'un filet. Le ton est professionnel et rassurant, sans froideur : l'utilisateur manipule de l'argent et des documents à valeur légale, il doit voir d'un coup d'œil ce qui est payé, en attente ou en retard.

## Colors

- **Primary** (#4F46E5): boutons d'action, états actifs, liens, anneaux de focus — indigo (6.3:1 avec le blanc ; #6366F1 n'atteignait que 4.47:1)
- **Primary Hover** (#4338CA): indigo plus sombre au survol des éléments primaires
- **Neutral** (#9C9C9C): placeholders, états désactivés, éléments décoratifs. Contraste insuffisant pour du texte à lire : utiliser Text Secondary à la place
- **Background** (#FAFAFA): fond de page
- **Surface** (#FFFFFF): cartes, panneaux, modales, fond de la navigation
- **Text Primary** (#0A0A0A): titres, texte courant, montants
- **Text Secondary** (#6B6B6B): descriptions, dates, libellés secondaires
- **Border** (#E8E8EC): bordures de cartes, séparateurs, bordures de champs
- **Success** (#10B981): loyer payé, quittance envoyée, confirmations
- **Warning** (#F59E0B): loyer en attente de confirmation, paiement partiel
- **Error** (#EF4444): loyer en retard, actions destructrices, erreurs de validation — bordures et fonds teintés seulement, jamais du texte (3.76:1 sur blanc)
- **Error Text** (#B91C1C): texte des messages d'erreur (6.47:1 sur blanc)

Un statut n'est jamais indiqué par la couleur seule : il est toujours accompagné de son libellé.

Thème clair uniquement pour l'instant. Aucun thème sombre n'est défini.

## Typography

- **Display Font**: Plus Jakarta Sans — chargée avec `next/font/google`
- **Body Font**: DM Sans — chargée avec `next/font/google`
- **Mono Font**: JetBrains Mono — chargée avec `next/font/google`

Les titres utilisent Plus Jakarta Sans en gras avec un interlettrage serré (-0.03em à -0.04em). Le texte courant et l'interface utilisent DM Sans en regular et medium. JetBrains Mono sert aux références et identifiants (numéro de quittance, IBAN).

Les montants utilisent DM Sans avec chiffres tabulaires (`tabular-nums`) et sont alignés à droite dans les colonnes, pour rester comparables d'une ligne à l'autre.

Échelle : Display 72px et Headline 60px (page d'accueil publique uniquement), Titre de page 32px, Sous-titre 24px, Corps 15px, Petit 13px, Légende 12px, Surtitre 11px en capitales.

## Elevation

Ombres minimales. Les cartes reposent à plat avec une bordure de 1px. Seules les cartes cliquables gagnent une ombre légère au survol (0 8px 30px rgba(0,0,0,0.08)) et se soulèvent de 2px. Les boutons primaires gagnent une lueur teintée au survol (0 4px 12px rgba(79,70,229,0.35)). La navigation utilise un flou d'arrière-plan plutôt qu'une ombre. Menus déroulants et popovers utilisent shadow-lg. Le focus est un anneau indigo de 3px (0 0 0 3px rgba(79,70,229,0.12)) accompagné d'une bordure indigo.

## Components

- **Buttons**: Primary : fond indigo, texte blanc, rayon 6px, graisse medium. Secondary : fond transparent, bordure 1px, même rayon. Ghost : ni bordure ni fond, changement de couleur du texte au survol. Destructive : texte rouge, bordure rouge. Tous se décalent de 1px vers le haut au survol. Tailles : small (32px), medium (38px), large (44px).
- **Cards**: surface blanche, bordure 1px, rayon 12px, overflow hidden. Une carte de location affiche l'adresse du bien, le nom du locataire, le montant du loyer et le statut du mois en cours. Transition 200ms.
- **Inputs**: bordure 1px, fond surface, rayon 6px, padding 10px vertical et 14px horizontal, texte 14px. Chaque champ a un label visible au-dessus. Focus : bordure indigo et anneau de 3px. Erreur : bordure Error et message sous le champ en Error Text. Placeholder en Neutral.
- **Status chips**: forme pilule (9999px), padding 4px vertical et 12px horizontal, texte 12px, fond teinté et texte de la couleur sémantique. Statuts d'un loyer : « Payé » (success), « En attente » (warning), « Partiel » (warning), « En retard » (error), « À venir » (gris).
- **Lists / tables**: lignes empilées séparées par un filet de 1px. Chaque ligne en flex space-between, padding 12px vertical et 16px horizontal, léger changement de fond au survol. Utilisées pour l'historique des loyers et la liste des documents envoyés. Sur mobile, une ligne de tableau devient une carte empilée.
- **Empty states**: titre court, une phrase d'explication et un seul bouton primaire (« Ajouter une location »). Pas d'illustration.
- **Checkboxes / switches**: 20px, gris non coché, indigo coché avec coche blanche. Les interrupteurs servent aux préférences (envoi automatique, relances).
- **Dialogs**: toute action irréversible ou envoyant un e-mail au locataire passe par une confirmation qui nomme le destinataire et le document.
- **Navigation**: barre supérieure fixe avec flou d'arrière-plan, hauteur 56px, bordure basse 1px. Logo à gauche, liens au centre (bureau) ou tiroir hamburger (mobile), menu du compte à droite. Liens : 14px medium, fond léger au survol.

## Documents

Les quittances, reçus et avis d'échéance en PDF sont des documents imprimables : texte noir sur fond blanc, aucune couleur d'interface, aucune ombre. Même typographie que l'application, marges de 20mm, format A4.

## Spacing

- Unité de base : 4px
- Échelle : 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px
- Padding des composants : small 8×12, medium 10×16, large 12×24
- Espacement des sections : 32px mobile, 48px tablette, 64px bureau
- Largeur maximale du conteneur : 1280px avec 24px de padding horizontal
- Gouttière des grilles de cartes : 20-24px

## Border Radius

- 4px : badges, code en ligne
- 6px : boutons, champs, selects
- 8px : menus déroulants, panneaux
- 12px : cartes
- 9999px : avatars, pastilles et chips de statut

## Do's and Don'ts

- Do : réserver l'indigo (#4F46E5) aux éléments interactifs — jamais pour la décoration ou du texte statique
- Do : respecter la grille de 4px pour tous les paddings, marges et gouttières
- Do : Plus Jakarta Sans pour les titres, DM Sans pour le reste — ne jamais les intervertir
- Do : cartes à 12px de rayon, boutons et champs à 6px — ne pas mélanger
- Do : vérifier un contraste d'au moins 4.5:1 pour tout texte
- Do : concevoir d'abord pour le mobile — le propriétaire confirme souvent un loyer depuis son téléphone
- Don't : utiliser le noir pur (#000000) pour le texte de l'interface — utiliser les valeurs de la palette
- Don't : ajouter de dégradés ni d'illustrations décoratives
- Don't : mettre d'ombre sur des éléments statiques — l'élévation est réservée au survol et aux éléments flottants
- Don't : utiliser plus de deux graisses par famille de police sur un même écran (titres en 700 ; texte en 400 et 500)
- Don't : placer plus d'un bouton primaire (indigo plein) dans une même section
