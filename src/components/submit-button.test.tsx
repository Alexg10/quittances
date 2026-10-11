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

  it("R28 — en attente : opacité réduite (jsdom ne calcule pas le CSS, on lit la déclaration conditionnelle)", () => {
    render(<SubmitButton label="Créer mon compte" pendingLabel="Création en cours" pending />);

    expect(screen.getByRole("button")).toHaveClass("disabled:opacity-60");
  });

  it("R28 — hors attente : aucune opacité réduite appliquée au bouton actif", () => {
    render(<SubmitButton label="Créer mon compte" pendingLabel="Création en cours" pending={false} />);

    expect(screen.getByRole("button").className).not.toMatch(/(^|\s)opacity-/);
  });

  it("R28 — en attente : pas d'effet de survol (les effets sont réservés au bouton actif)", () => {
    render(<SubmitButton label="Créer mon compte" pendingLabel="Création en cours" pending />);

    const classes = screen.getByRole("button").className.split(/\s+/);
    const survols = classes.filter((c) => c.includes("hover:"));
    expect(survols.length).toBeGreaterThan(0);
    expect(survols.every((c) => c.includes("enabled:"))).toBe(true);
  });
});
