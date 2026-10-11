import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PasswordField } from "./password-field";

function renderInForm(onSubmit = vi.fn()) {
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <PasswordField
        id="password"
        name="password"
        label="Mot de passe"
        autoComplete="new-password"
      />
    </form>,
  );
  return onSubmit;
}

describe("PasswordField", () => {
  it("R8 — la saisie est masquée par défaut, le bouton propose d'afficher", () => {
    renderInForm();

    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute("type", "password");
    const bouton = screen.getByRole("button", { name: "Afficher le mot de passe" });
    expect(bouton).toHaveTextContent("Afficher");
  });

  it("CA15 — Afficher rend la saisie lisible et le bouton devient Masquer", async () => {
    const user = userEvent.setup();
    renderInForm();

    await user.type(screen.getByLabelText("Mot de passe"), "phrase secrète");
    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));

    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute("type", "text");
    const bouton = screen.getByRole("button", { name: "Masquer le mot de passe" });
    expect(bouton).toHaveTextContent("Masquer");
  });

  it("CA15 — Masquer remet le type password et la valeur n'a pas changé", async () => {
    const user = userEvent.setup();
    renderInForm();

    await user.type(screen.getByLabelText("Mot de passe"), "phrase secrète");
    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    await user.click(screen.getByRole("button", { name: "Masquer le mot de passe" }));

    const champ = screen.getByLabelText("Mot de passe");
    expect(champ).toHaveAttribute("type", "password");
    expect(champ).toHaveValue("phrase secrète");
  });

  it("CA15 — le bouton n'envoie pas le formulaire", async () => {
    const user = userEvent.setup();
    const onSubmit = renderInForm();

    // Champ rempli : un champ obligatoire vide bloquerait l'envoi pour une autre raison.
    await user.type(screen.getByLabelText("Mot de passe"), "phrase secrète");
    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    await user.click(screen.getByRole("button", { name: "Masquer le mot de passe" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("R30 — champ obligatoire, autocomplete donné, sans placeholder", () => {
    renderInForm();

    const champ = screen.getByLabelText("Mot de passe");
    expect(champ).toBeRequired();
    expect(champ).toHaveAttribute("autocomplete", "new-password");
    expect(champ).not.toHaveAttribute("placeholder");
  });

  it("R25 — affiche l'erreur et le texte d'aide dans la description du champ", () => {
    render(
      <PasswordField
        id="password"
        name="password"
        label="Mot de passe"
        autoComplete="new-password"
        error="Erreur ici."
        hint="Aide ici."
      />,
    );

    const champ = screen.getByLabelText("Mot de passe");
    expect(champ).toHaveAttribute("aria-invalid", "true");
    expect(champ).toHaveAccessibleDescription("Erreur ici. Aide ici.");
  });
});
