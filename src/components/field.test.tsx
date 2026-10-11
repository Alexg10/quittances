import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "./field";

describe("Field", () => {
  it("R30 — relie le libellé au champ", () => {
    render(<Field id="email" name="email" label="Adresse e-mail" />);

    expect(
      screen.getByRole("textbox", { name: "Adresse e-mail" }),
    ).toBeInTheDocument();
  });

  it("R30 — n'a pas de placeholder", () => {
    render(<Field id="email" label="Adresse e-mail" />);

    expect(screen.getByLabelText("Adresse e-mail")).not.toHaveAttribute(
      "placeholder",
    );
  });

  it("R25 — sans erreur : ni aria-invalid à true ni description", () => {
    render(<Field id="email" label="Adresse e-mail" />);

    const input = screen.getByLabelText("Adresse e-mail");
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(input).not.toHaveAccessibleDescription();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("R25 — avec erreur : aria-invalid et message dans la description accessible", () => {
    render(
      <Field id="email" label="Adresse e-mail" error="Saisissez votre adresse e-mail." />,
    );

    const input = screen.getByLabelText("Adresse e-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Saisissez votre adresse e-mail.");
  });

  it("R32 — le texte d'aide fait partie de la description accessible", () => {
    render(<Field id="pw" label="Mot de passe" hint="12 caractères au minimum." />);

    expect(screen.getByLabelText("Mot de passe")).toHaveAccessibleDescription(
      "12 caractères au minimum.",
    );
  });

  it("R32 — l'erreur est annoncée avant l'aide", () => {
    render(
      <Field id="pw" label="Mot de passe" error="Erreur ici." hint="Aide ici." />,
    );

    expect(screen.getByLabelText("Mot de passe")).toHaveAccessibleDescription(
      "Erreur ici. Aide ici.",
    );
  });

  it("R32 — l'erreur est placée avant l'aide dans le document", () => {
    render(
      <Field id="pw" label="Mot de passe" error="Erreur ici." hint="Aide ici." />,
    );

    const erreur = screen.getByText("Erreur ici.");
    const aide = screen.getByText("Aide ici.");
    expect(
      erreur.compareDocumentPosition(aide) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("R30 — transmet les attributs du champ (type, name, autocomplete, required)", () => {
    render(
      <Field
        id="email"
        name="email"
        label="Adresse e-mail"
        type="email"
        autoComplete="username"
        required
      />,
    );

    const input = screen.getByLabelText("Adresse e-mail");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toHaveAttribute("autocomplete", "username");
    expect(input).toBeRequired();
  });
});
