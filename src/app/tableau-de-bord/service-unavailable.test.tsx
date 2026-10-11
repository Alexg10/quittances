import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceUnavailable } from "./service-unavailable";

// next/navigation : le routeur n'existe pas hors de Next. Seul refresh() nous
// intéresse (bouton « Réessayer » sans fonction retry).
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  router.refresh.mockClear();
});

describe("ServiceUnavailable (écran de panne)", () => {
  it("R24 — affiche le titre h1 et le texte exacts de « Contenus »", () => {
    render(<ServiceUnavailable />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Service momentanément indisponible",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cette page ne peut pas être affichée pour le moment."),
    ).toBeInTheDocument();
  });

  it("R24 — a les repères banner et main", () => {
    render(<ServiceUnavailable />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("R24 — l'en-tête n'affiche que le logo : pas de Se déconnecter", () => {
    render(<ServiceUnavailable />);

    const entete = screen.getByRole("banner");
    expect(within(entete).getByRole("link", { name: "Quittances, tableau de bord" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Se déconnecter" }),
    ).not.toBeInTheDocument();
    expect(within(entete).queryByRole("button")).not.toBeInTheDocument();
  });

  it("R24 — aucun contenu protégé : ni titre de la page, ni adresse, ni état vide", () => {
    render(<ServiceUnavailable />);

    expect(screen.queryByText(/Tableau de bord$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Connecté en tant que/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aucune location/)).not.toBeInTheDocument();
    expect(screen.queryByText("Ajouter une location")).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("R24 — le bouton « Réessayer » relance le chargement de la page (rafraîchit)", async () => {
    render(<ServiceUnavailable />);

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("R24 — fournie par error.tsx, la fonction retry remplace le rafraîchissement", async () => {
    const retry = vi.fn();
    render(<ServiceUnavailable retry={retry} />);

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("R24 — « Réessayer » est un bouton (type button), pas un lien", () => {
    render(<ServiceUnavailable />);

    expect(screen.getByRole("button", { name: "Réessayer" })).toHaveAttribute(
      "type",
      "button",
    );
  });
});
