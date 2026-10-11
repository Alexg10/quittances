import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardHeader } from "./dashboard-header";

describe("DashboardHeader", () => {
  it("R36 — est le repère banner et contient le logo, lien vers /tableau-de-bord", () => {
    render(<DashboardHeader />);

    const entete = screen.getByRole("banner");
    const logo = within(entete).getByRole("link", {
      name: "Quittances, tableau de bord",
    });
    expect(logo).toHaveAttribute("href", "/tableau-de-bord");
    expect(logo).toHaveTextContent("Quittances");
  });

  it("R36 — affiche à droite ce qu'on lui confie (le bouton Se déconnecter)", () => {
    render(
      <DashboardHeader>
        <button type="button">Se déconnecter</button>
      </DashboardHeader>,
    );

    expect(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Se déconnecter",
      }),
    ).toBeInTheDocument();
  });

  it("R36 — sans enfant, le logo est le seul élément interactif (écran de panne)", () => {
    render(<DashboardHeader />);

    const entete = screen.getByRole("banner");
    expect(within(entete).getAllByRole("link")).toHaveLength(1);
    expect(within(entete).queryByRole("button")).not.toBeInTheDocument();
  });

  it("R36 — pas de navigation ni de lien d'évitement", () => {
    render(<DashboardHeader />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Aller au contenu" }),
    ).not.toBeInTheDocument();
  });
});
