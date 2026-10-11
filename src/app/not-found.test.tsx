import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

// Les textes de la page 404 générale ne sont pas fixés par la spécification et
// n'ont pas été validés : on vérifie la structure (un titre, un lien d'accueil),
// pas les mots.
describe("Page 404 générale", () => {
  it("a un seul titre de niveau 1, non vide", () => {
    render(<NotFound />);

    const titres = screen.getAllByRole("heading", { level: 1 });
    expect(titres).toHaveLength(1);
    expect(titres[0].textContent?.trim()).not.toBe("");
  });

  it("propose un lien vers l'accueil (/) dans le contenu principal", () => {
    render(<NotFound />);

    const principal = screen.getByRole("main");
    const liens = Array.from(principal.querySelectorAll("a"));
    expect(liens.map((a) => a.getAttribute("href"))).toEqual(["/"]);
  });

  it("n'a aucun lien vers l'espace connecté ni vers une location", () => {
    const { container } = render(<NotFound />);

    for (const a of container.querySelectorAll("a")) {
      expect(a.getAttribute("href")).toBe("/");
    }
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("R43 — ne montre aucune donnée de session ni de location", () => {
    const { container } = render(<NotFound />);

    expect(container.textContent).not.toMatch(/@|€|Se déconnecter|tableau de bord/i);
  });
});
