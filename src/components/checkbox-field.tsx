// Case à cocher du design system (R35 de la spécification 04) : case de 20px,
// libellé à sa droite, message d'erreur puis texte d'aide en dessous.
// Sans état ni événement : pas de "use client".

type CheckboxFieldProps = {
  // Identifiant du champ : relie le libellé, le message d'erreur et le texte d'aide.
  id: string;
  name: string;
  label: string;
  // Message d'erreur déjà rédigé ; absent quand le champ est valide.
  error?: string;
  hint?: string;
  required?: boolean;
};

// La case n'a volontairement ni `checked` ni `defaultChecked` : elle n'est
// jamais cochée d'avance, et revient décochée chaque fois que le formulaire est
// réaffiché. Sans attribut `value`, une case cochée envoie « on » ; décochée,
// elle n'envoie rien.
export function CheckboxField({
  id,
  name,
  label,
  error,
  hint,
  required,
}: CheckboxFieldProps) {
  const errorId = `${id}-erreur`;
  const hintId = `${id}-aide`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter((value) => value !== null)
    .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          name={name}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          // size-5 : 20px. accent-primary : case indigo et coche blanche une
          // fois cochée. shrink-0 : un libellé long ne l'écrase pas.
          // focus: et non focus-visible: : après une erreur, le focus est posé
          // par le code et doit se voir même après un clic à la souris.
          className="mt-0.5 size-5 shrink-0 accent-primary focus:outline-2 focus:outline-offset-2 focus:outline-primary"
        />
        {/* htmlFor : cliquer le libellé coche la case. */}
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      </div>
      {error ? (
        <p id={errorId} className="text-small text-error-text">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-small text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
