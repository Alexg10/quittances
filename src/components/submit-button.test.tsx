import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubmitButton } from "./submit-button";

describe("SubmitButton", () => {
  it("affiche son libellé, actif et de type submit, hors attente", () => {
    render(<SubmitButton label="Créer mon compte" pendingLabel="Création en cours" pending={false} />);

    const bouton = screen.getByRole("button", { name: "Créer mon compte" });
    expect(bouton).toBeEnabled();
    expect(bouton).toHaveAttribute("type", "submit");
  });

  it("R28 — en attente : libellé d'attente et bouton désactivé", () => {
    render(<SubmitButton label="Créer mon compte" pendingLabel="Création en cours" pending />);

    const bouton = screen.getByRole("button", { name: "Création en cours" });
    expect(bouton).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Créer mon compte" })).not.toBeInTheDocument();
  });

  it("R28 — en attente : le libellé d'attente est annoncé dans une zone de statut", () => {
    render(<SubmitButton label="Créer mon compte" pendingLabel="Création en cours" pending />);

    expect(screen.getByRole("status")).toHaveTextContent("Création en cours");
  });

  it("R28 — hors attente : la zone de statut est vide", () => {
    render(<SubmitButton label="Créer mon compte" pendingLabel="Création en cours" pending={false} />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
