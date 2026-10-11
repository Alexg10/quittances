// Bouton d'envoi d'un formulaire : primaire, grand (44px), sur toute la largeur
// (R33). L'état d'attente lui est passé en prop par le formulaire, qui le tient
// de useActionState : ce composant n'a donc ni état ni "use client".

type SubmitButtonProps = {
  label: string;
  // Libellé affiché entre l'envoi et la réponse (R28).
  pendingLabel: string;
  pending: boolean;
};

export function SubmitButton({
  label,
  pendingLabel,
  pending,
}: SubmitButtonProps) {
  return (
    <>
      <button
        type="submit"
        // disabled bloque le clic, la touche Entrée dans un champ et une seconde
        // activation : une seule demande part (R28).
        disabled={pending}
        // Les effets de survol sont réservés au bouton actif (enabled:) : en
        // attente, il garde sa taille, sans décalage ni lueur, et son opacité
        // tombe à 60 % (disabled:) pour qu'il se distingue du bouton actif.
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-6 text-body font-medium text-surface transition-[background-color,translate] duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-primary-glow motion-safe:enabled:hover:-translate-y-px disabled:opacity-60 motion-reduce:duration-0"
      >
        {pending ? pendingLabel : label}
      </button>
      {/* Un bouton désactivé n'est pas relu de lui-même par un lecteur d'écran.
          Cette zone, invisible à l'écran, annonce le début de l'attente. */}
      <p role="status" className="sr-only">
        {pending ? pendingLabel : ""}
      </p>
    </>
  );
}
