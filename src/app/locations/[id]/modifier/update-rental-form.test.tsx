import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RentalFormState } from "@/rentals/rental-form-state";

import { UpdateRentalForm } from "./update-rental-form";

// Seule frontière simulée : la Server Action, passée en prop. Le formulaire
// de location est réel.
type Action = (state: RentalFormState, data: FormData) => Promise<RentalFormState>;

const CANCEL = "/locations/7f3b2c1a-1111-4222-8333-444455556666";

// CA32 : loyer 125050 centimes, charges nulles, début le 05/01/2026, dans la
// forme des champs (R16, R19).
const INITIAL: RentalFormState = {
  fields: {
    address: "12 rue des Lilas",
    addressComplement: "",
    postalCode: "69003",
    city: "Lyon",
    tenantName: "Marie Durand",
    tenantEmail: "marie@quittances.test",
    rent: "1250,50",
    charges: "0,00",
    dueDay: "5",
    startDate: "2026-01-05",
  },
  errors: {},
};

function setup(action: ReturnType<typeof vi.fn<Action>> = vi.fn<Action>(async (state) => state)) {
  const view = render(
    <UpdateRentalForm action={action} initialState={INITIAL} cancelHref={CANCEL} />,
  );
  return { ...view, action };
}

describe("UpdateRentalForm (R32, CA32)", () => {
  it.each([
    ["Adresse", "12 rue des Lilas"],
    ["Complément d'adresse (facultatif)", ""],
    ["Code postal", "69003"],
    ["Ville", "Lyon"],
    ["Nom du locataire", "Marie Durand"],
    ["Adresse e-mail du locataire", "marie@quittances.test"],
    ["Loyer hors charges", "1250,50"],
    ["Charges", "0,00"],
    ["Jour d'échéance", "5"],
    ["Date de début du bail", "2026-01-05"],
  ])("CA32 — %s est prérempli avec « %s »", (label, valeur) => {
    setup();

    expect(screen.getByLabelText(label)).toHaveValue(valeur);
  });

  it("CA32 — bouton « Enregistrer les modifications », de type submit", () => {
    setup();

    const bouton = screen.getByRole("button", { name: "Enregistrer les modifications" });
    expect(bouton).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("button", { name: "Ajouter la location" })).not.toBeInTheDocument();
  });

  it("CA32 — « Annuler » mène au détail de la location", () => {
    setup();

    expect(screen.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", CANCEL);
  });

  it("R4, R32 — aucun champ caché ni champ portant l'identifiant de la location", () => {
    const { container } = setup();

    expect(container.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
    expect(container.querySelectorAll("[name]")).toHaveLength(10);
    for (const c of container.querySelectorAll("input")) {
      expect(c.outerHTML).not.toContain("7f3b2c1a");
    }
  });

  it("R34 — en attente : « Enregistrement en cours », bouton indisponible, puis rétabli", async () => {
    let terminer: (etat: RentalFormState) => void = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (terminer = resolve)));
    setup(action);

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" }));

    expect(await screen.findByRole("button", { name: "Enregistrement en cours" })).toBeDisabled();

    const { act } = await import("@testing-library/react");
    await act(async () => terminer(INITIAL));
    expect(await screen.findByRole("button", { name: "Enregistrer les modifications" })).toBeEnabled();
  });

  it("CA36 — L22 renvoyé par l'action : message sous la date de début, valeurs conservées, focus", async () => {
    const reponse: RentalFormState = {
      fields: { ...INITIAL.fields, startDate: "2026-01-06" },
      errors: { startDate: "L22" },
    };
    setup(vi.fn<Action>(async () => reponse));

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" }));

    const date = screen.getByLabelText("Date de début du bail");
    await screen.findByText("La date de début ne peut pas être postérieure à la date de fin du bail.");
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(date).toHaveValue("2026-01-06");
    expect(date).toHaveFocus();
  });

  it("R31 — E8 : alerte de formulaire, valeurs saisies conservées", async () => {
    const E8 = "Le service est momentanément indisponible. Réessayez dans quelques instants.";
    setup(vi.fn<Action>(async (state) => ({ ...state, formError: E8 })));

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(E8);
    expect(screen.getByLabelText("Loyer hors charges")).toHaveValue("1250,50");
  });

  it("R34 — l'envoi transmet les dix champs et rien d'autre", async () => {
    const { action } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" }));

    const data = action.mock.calls[0][1];
    expect([...data.keys()].sort()).toEqual(Object.keys(INITIAL.fields).sort());
  });
});
