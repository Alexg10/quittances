import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReceiptNotFound } from "./receipt-not-found";

// Seule frontière simulée : les Server Actions de la déconnexion (session,
// base), importées par le bouton « Se déconnecter » de l'en-tête.
vi.mock("../tableau-de-bord/actions", () => ({
  closeSession: vi.fn(),
  signOut: vi.fn(),
}));

describe("ReceiptNotFound — écran « Quittance introuvable » (R22)", () => {
  it("R22 — le h1 est « Quittance introuvable »", () => {
    render(<ReceiptNotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Quittance introuvable" }),
    ).toBeInTheDocument();
  });

  it("R22 — le texte est « Cette quittance n'existe pas ou a été supprimée. »", () => {
    render(<ReceiptNotFound />);

    expect(
      screen.getByText("Cette quittance n'existe pas ou a été supprimée."),
    ).toBeInTheDocument();
  });

  it("R22 — le lien « Retour au tableau de bord » mène à /tableau-de-bord", () => {
    render(<ReceiptNotFound />);

    expect(
      screen.getByRole("link", { name: "Retour au tableau de bord" }),
    ).toHaveAttribute("href", "/tableau-de-bord");
  });

  it("R22 — rien d'autre dans la zone principale : un h1, un paragraphe, un lien", () => {
    render(<ReceiptNotFound />);

    const principal = screen.getByRole("main");
    expect(principal.children).toHaveLength(3);
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(principal.querySelectorAll("a")).toHaveLength(1);
    expect(principal.querySelectorAll("form, input, button")).toHaveLength(0);
  });

  it("R22 — l'écran ne reçoit aucune donnée : aucun nom, adresse, montant ni identifiant", () => {
    render(<ReceiptNotFound />);

    expect(screen.getByRole("main").textContent).not.toMatch(/\d/);
  });

  it("« Contenus » — l'en-tête complet est présent (logo et déconnexion)", () => {
    render(<ReceiptNotFound />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quittances, tableau de bord" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
  });
});
