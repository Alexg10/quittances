import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RentalStatusChip } from "./rental-status-chip";

describe("RentalStatusChip", () => {
  it("R39 — statut en cours : le texte « En cours » est écrit en toutes lettres", () => {
    render(<RentalStatusChip status="ongoing" />);

    expect(screen.getByText("En cours")).toBeInTheDocument();
  });

  it("R39 — statut terminé : le texte « Terminée » est écrit en toutes lettres", () => {
    render(<RentalStatusChip status="ended" />);

    expect(screen.getByText("Terminée")).toBeInTheDocument();
  });

  it("R39 — le chip n'est jamais cliquable : ni lien ni bouton", () => {
    render(<RentalStatusChip status="ongoing" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
