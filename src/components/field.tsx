// Champ de saisie du design system (R30, R32 de la spécification 02) : libellé
// visible au-dessus, message d'erreur puis texte d'aide en dessous.
// Sans état ni événement : pas de "use client", il se rend aussi sur le serveur.
import type { ComponentProps, ReactNode } from "react";

type FieldProps = {
  // Identifiant du champ : relie le libellé, le message d'erreur et le texte d'aide.
  id: string;
  label: string;
  // Message d'erreur déjà rédigé ; absent quand le champ est valide.
  error?: string;
  // Texte d'aide permanent, sous le champ.
  hint?: string;
  // Élément posé sur le bord droit du champ (bouton Afficher / Masquer).
  trailing?: ReactNode;
} & Omit<
  ComponentProps<"input">,
  "id" | "className" | "aria-invalid" | "aria-describedby" | "placeholder"
>;

export function Field({
  id,
  label,
  error,
  hint,
  trailing,
  ...inputProps
}: FieldProps) {
  const errorId = `${id}-erreur`;
  const hintId = `${id}-aide`;

  // Le lecteur d'écran lit, après le libellé, l'erreur puis l'aide (R25).
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter((value) => value !== null)
    .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {/* relative : sert de repère au bouton posé sur le champ. */}
      <div className="relative">
        <input
          {...inputProps}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          // La bordure d'erreur est une classe sans variante, focus: en est une :
          // au focus, la bordure primaire l'emporte et reste l'indicateur visible.
          className={`w-full rounded-md border bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary focus:shadow-focus ${
            error ? "border-error" : "border-border"
          } ${trailing ? "pr-24" : ""}`}
        />
        {trailing}
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
