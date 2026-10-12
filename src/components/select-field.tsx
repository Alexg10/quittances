// Liste déroulante du design system (R35 de la spécification 04) : même
// présentation que Field (libellé visible au-dessus, message d'erreur puis texte
// d'aide en dessous), avec un <select> natif à la place de l'<input>.
// Sans état ni événement : pas de "use client".

export type SelectOption = {
  // La valeur envoyée au serveur.
  value: string;
  // Le texte affiché.
  label: string;
};

type SelectFieldProps = {
  // Identifiant du champ : relie le libellé, le message d'erreur et le texte d'aide.
  id: string;
  name: string;
  label: string;
  options: SelectOption[];
  // L'option sélectionnée à l'affichage. Si elle ne figure pas dans `options`,
  // le navigateur sélectionne la première.
  defaultValue: string;
  // Message d'erreur déjà rédigé ; absent quand le champ est valide.
  error?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: "off";
};

export function SelectField({
  id,
  name,
  label,
  options,
  defaultValue,
  error,
  hint,
  required,
  autoComplete,
}: SelectFieldProps) {
  const errorId = `${id}-erreur`;
  const hintId = `${id}-aide`;

  // Le lecteur d'écran lit, après le libellé, l'erreur puis l'aide.
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter((value) => value !== null)
    .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        // Champ non contrôlé : React n'en suit pas la valeur, le navigateur
        // l'envoie avec le formulaire.
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`w-full rounded-md border bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary focus:shadow-focus ${
          error ? "border-error" : "border-border"
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
