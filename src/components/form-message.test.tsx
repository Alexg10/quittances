import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormMessage } from "./form-message";

describe("FormMessage", () => {
  it("R25 — affiche le message avec le rôle alert", () => {
    render(<FormMessage message="Adresse e-mail ou mot de passe incorrect." />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Adresse e-mail ou mot de passe incorrect.",
    );
  });

  it("R34 — sans message, ne rend rien", () => {
    const { container } = render(<FormMessage />);

    expect(container).toBeEmptyDOMElement();
  });

  it("R34 — un message vide ne rend rien non plus", () => {
    render(<FormMessage message="" />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("R27 — peut recevoir le focus par le code", () => {
    render(<FormMessage message="Erreur." />);
    const alerte = screen.getByRole("alert");

    alerte.focus();

    expect(alerte).toHaveFocus();
  });
});
