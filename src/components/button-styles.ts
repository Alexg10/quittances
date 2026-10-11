// Apparence du bouton secondaire, petite taille (R33 de la spécification 02) :
// 32px de haut, fond transparent, bordure 1px, texte 14px, fond `border` et
// décalage de 1px vers le haut au survol (supprimé si l'utilisateur a demandé
// la réduction des animations).
// Une constante plutôt qu'un composant : la même apparence habille un <button>
// (« Se déconnecter », « Réessayer ») comme un lien.
export const SECONDARY_BUTTON_CLASSES =
  "inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium text-text-primary transition-[background-color,translate] duration-200 hover:bg-border motion-safe:hover:-translate-y-px motion-reduce:duration-0";
