"use client";

// Champ « Mot de passe » avec son bouton Afficher / Masquer (R8).
// Client Component : l'affichage de la saisie est un état, changé par un clic.
import { useState } from "react";

import { Field } from "./field";

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  // « new-password » à l'inscription, « current-password » à la connexion (R30).
  autoComplete: "new-password" | "current-password";
  error?: string;
  hint?: string;
};

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  error,
  hint,
}: PasswordFieldProps) {
  // Masqué par défaut. Sans JavaScript, le bouton reste sans effet (R29).
  const [visible, setVisible] = useState(false);

  return (
    <Field
      id={id}
      name={name}
      label={label}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      // Sans effet sur un champ masqué ; utiles quand la saisie est affichée.
      autoCapitalize="none"
      spellCheck={false}
      required
      error={error}
      hint={hint}
      trailing={
        <button
          // type="button" : un bouton sans type enverrait le formulaire.
          type="button"
          // Le nom accessible commence par le texte visible : une commande
          // vocale « Afficher » trouve le bouton.
          aria-label={
            visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          onClick={() => setVisible(!visible)}
          className="absolute inset-y-0 right-1.5 my-auto h-8 rounded-md px-3 text-small font-medium text-text-secondary transition-[color,translate] duration-200 hover:text-text-primary motion-safe:hover:-translate-y-px motion-reduce:duration-0"
        >
          {visible ? "Masquer" : "Afficher"}
        </button>
      }
    />
  );
}
