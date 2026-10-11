// Message de formulaire (R25, R34) : une erreur qui ne concerne aucun champ en
// particulier (identifiants refusés, panne). Sans état : pas de "use client".

type FormMessageProps = {
  // Absent : le composant ne rend rien et n'occupe aucun espace.
  message?: string;
};

export function FormMessage({ message }: FormMessageProps) {
  if (!message) {
    return null;
  }
  return (
    <p
      // role="alert" : le lecteur d'écran lit le message dès qu'il apparaît.
      role="alert"
      // tabIndex -1 : le message peut recevoir le focus par le code (R27),
      // sans devenir un arrêt de la tabulation.
      tabIndex={-1}
      // focus: et non focus-visible: : ce focus est posé par le code, et doit
      // se voir même après un clic à la souris sur le bouton d'envoi (R37).
      className="rounded-lg border border-error bg-surface px-4 py-3 text-sm text-error-text focus:shadow-focus focus:outline-2 focus:outline-offset-2 focus:outline-primary"
    >
      {message}
    </p>
  );
}
