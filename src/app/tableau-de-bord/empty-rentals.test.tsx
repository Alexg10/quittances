import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyRentals } from "./empty-rentals";

describe("EmptyRentals", () => {
  it("CA16 — le titre h2 est « Aucune location pour l'instant » et c'est le seul h2", () => {
    render(<EmptyRentals />);

    const titres = screen.getAllByRole("heading", { level: 2 });
    expect(titres).toHaveLength(1);
    expect(titres[0]).toHaveTextContent("Aucune location pour l'instant");
  });

  it("CA16 — affiche le texte d'invitation mot pour mot", () => {
    render(<EmptyRentals />);

    expect(
      screen.getByText(
        "Ajoutez votre première location pour préparer vos quittances.",
      ),
    ).toBeInTheDocument();
  });

  it("CA16 — le lien « Ajouter une location » mène à /locations/nouvelle", () => {
    render(<EmptyRentals />);

    expect(
      screen.getByRole("link", { name: "Ajouter une location" }),
    ).toHaveAttribute("href", "/locations/nouvelle");
  });

  it("CA16 — un seul lien et aucun bouton (un lien reste un lien, R40)", () => {
    render(<EmptyRentals />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("CA16 — l'ancien texte de la spécification 02 a disparu", () => {
    render(<EmptyRentals />);

    expect(
      screen.queryByText(/arrivera dans une prochaine version/),
    ).not.toBeInTheDocument();
  });
});
