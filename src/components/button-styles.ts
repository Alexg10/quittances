// Apparence du bouton secondaire, petite taille (R33 de la spécification 02) :
// 32px de haut, fond transparent, bordure 1px, texte 14px, fond `border` et
// décalage de 1px vers le haut au survol (supprimé si l'utilisateur a demandé
// la réduction des animations).
// Une constante plutôt qu'un composant : la même apparence habille un <button>
// (« Se déconnecter », « Réessayer ») comme un lien.
export const SECONDARY_BUTTON_CLASSES =
  "inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium text-text-primary transition-[background-color,translate] duration-200 hover:bg-border motion-safe:hover:-translate-y-px motion-reduce:duration-0";

// Apparence destructive, petite taille (R40 de la spécification 03) : mêmes
// dimensions que le bouton secondaire, bordure `error`, texte `error-text` (le
// rouge `error` ne suffit pas pour du texte). Au survol, la bordure fonce.
export const DESTRUCTIVE_BUTTON_SMALL_CLASSES =
  "inline-flex h-8 items-center rounded-md border border-error px-3 text-sm font-medium text-error-text transition-[border-color,translate] duration-200 hover:border-error-text motion-safe:hover:-translate-y-px motion-reduce:duration-0";

// Bouton primaire, grande taille (44px) : même apparence que SubmitButton, pour
// un lien qui mène à une autre page (« Ajouter une location »). Un élément qui
// change de page est un lien, même quand il ressemble à un bouton (R40).
export const PRIMARY_BUTTON_LINK_CLASSES =
  "inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-body font-medium text-surface transition-[background-color,translate] duration-200 hover:bg-primary-hover hover:shadow-primary-glow motion-safe:hover:-translate-y-px motion-reduce:duration-0";

// Apparence destructive, grande taille (R40 de la spécification 03) : 44px de
// haut, sur toute la largeur du formulaire, mêmes couleurs que la petite.
// Réservée au bouton « Supprimer définitivement ». En attente (disabled), les
// effets de survol sont coupés et l'opacité baisse, comme pour SubmitButton.
export const DESTRUCTIVE_BUTTON_LARGE_CLASSES =
  "inline-flex h-11 w-full items-center justify-center rounded-md border border-error px-6 text-body font-medium text-error-text transition-[border-color,translate] duration-200 enabled:hover:border-error-text motion-safe:enabled:hover:-translate-y-px disabled:opacity-60 motion-reduce:duration-0";

// Bouton primaire, grande taille (44px), sur toute la largeur du formulaire :
// l'apparence de SubmitButton, pour un formulaire sans champ dont le bouton est
// rendu par ConfirmForm (« Archiver la location », R36 de la spécification 04).
// En attente (disabled), les effets de survol sont coupés et l'opacité baisse.
export const PRIMARY_BUTTON_LARGE_CLASSES =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-6 text-body font-medium text-surface transition-[background-color,translate] duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-primary-glow motion-safe:enabled:hover:-translate-y-px disabled:opacity-60 motion-reduce:duration-0";
