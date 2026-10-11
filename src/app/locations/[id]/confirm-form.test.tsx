import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ConfirmFormState } from "@/rentals/rental-operation-state";

import { ConfirmForm } from "./confirm-form";

// Seule frontière simulée : la Server Action, passée en prop. Le formulaire
// et le bouton sont réels.
type Action = (state: ConfirmFormState) => Promise<ConfirmFormState>;

const E8 = "Le service est momentanément indisponible. Réessayez dans quelques instants.";

const USAGES = [
  { nom: "réouverture", label: "Rouvrir la location", pendingLabel: "Réouverture en cours", cas: "CA37" },
  { nom: "suppression", label: "Supprimer définitivement", pendingLabel: "Suppression en cours", cas: "CA38" },
] as const;

function setup(
  usage: (typeof USAGES)[number],
  action: Action = vi.fn<Action>(async () => ({})),
) {
  const view = render(
    <ConfirmForm
      action={action}
      label={usage.label}
      pendingLabel={usage.pendingLabel}
      buttonClassName="bouton-test"
    />,
  );
  return { ...view, action, form: view.container.querySelector("form")! };
}

describe.each(USAGES)("ConfirmForm — $nom", (usage) => {
  it(`${usage.cas} — « ${usage.label} » est un bouton submit dans un formulaire, jamais un lien`, () => {
    const { form } = setup(usage);

    const bouton = screen.getByRole("button", { name: usage.label });
    expect(bouton).toHaveAttribute("type", "submit");
    expect(bouton.closest("form")).toBe(form);
    expect(bouton).toBeEnabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it(`${usage.cas} — aucun champ, aucun identifiant dans le formulaire`, () => {
    const { form } = setup(usage);

    expect(form.querySelectorAll("input, select, textarea, [name]")).toHaveLength(0);
  });

  it(`${usage.cas} — l'envoi appelle l'action une fois`, async () => {
    const { action } = setup(usage);

    await userEvent.click(screen.getByRole("button", { name: usage.label }));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it(`R34 — en attente : « ${usage.pendingLabel} », bouton indisponible, puis rétabli`, async () => {
    let terminer: (etat: ConfirmFormState) => void = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (terminer = resolve)));
    setup(usage, action);

    await userEvent.click(screen.getByRole("button", { name: usage.label }));

    expect(await screen.findByRole("button", { name: usage.pendingLabel })).toBeDisabled();
    expect(screen.queryByRole("button", { name: usage.label })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(usage.pendingLabel);

    await act(async () => terminer({}));
    expect(await screen.findByRole("button", { name: usage.label })).toBeEnabled();
  });

  it("R31, R34 — E8 : alerte au-dessus du bouton, avec le focus, et le bouton redevient actif", async () => {
    setup(usage, vi.fn<Action>(async () => ({ formError: E8 })));

    await userEvent.click(screen.getByRole("button", { name: usage.label }));

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(E8);
    expect(alerte).toHaveFocus();
    const bouton = screen.getByRole("button", { name: usage.label });
    expect(alerte.compareDocumentPosition(bouton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bouton).toBeEnabled();
  });

  it("R34 — avant tout envoi : aucune alerte, aucun message d'attente", () => {
    setup(usage);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("ConfirmForm — lien d'annulation", () => {
  // Le lien « Annuler » n'est pas dans ce composant : la spécification le place
  // sur la page de suppression, à côté du formulaire (« Contenus »). Il revient
  // à la QA, la page étant un Server Component async.
  it("CA38 — le composant ne rend aucun lien « Annuler » (c'est la page qui le pose)", () => {
    setup(USAGES[1]);

    expect(screen.queryByRole("link", { name: "Annuler" })).not.toBeInTheDocument();
  });
});
