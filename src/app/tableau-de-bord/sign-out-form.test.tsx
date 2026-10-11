import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignOutForm } from "./sign-out-form";

// Seule frontière simulée : les Server Actions, qui parlent au serveur et à la
// base. Le formulaire, lui, est réel.
const actions = vi.hoisted(() => ({
  closeSession: vi.fn<() => Promise<void>>(),
  signOut: vi.fn(),
}));
vi.mock("./actions", () => actions);

// Journal commun, pour vérifier l'ordre des appels (R18).
let journal: string[];
const assign = vi.fn((destination: string) => {
  journal.push(`assign:${destination}`);
});

beforeEach(() => {
  journal = [];
  assign.mockClear();
  actions.closeSession.mockReset();
  vi.stubGlobal("location", { assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignOutForm", () => {
  it("R18 — est un bouton de type submit « Se déconnecter » dans un formulaire, jamais un lien", () => {
    render(<SignOutForm />);

    const bouton = screen.getByRole("button", { name: "Se déconnecter" });
    expect(bouton).toHaveAttribute("type", "submit");
    expect(bouton.closest("form")).not.toBeNull();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("R18 — ferme la session avant de recharger le document, puis va exactement sur /connexion", async () => {
    actions.closeSession.mockImplementation(async () => {
      journal.push("closeSession");
    });
    render(<SignOutForm />);

    await userEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(journal).toEqual(["closeSession", "assign:/connexion"]);
  });

  it("R18 — ne change pas de page tant que le serveur n'a pas répondu", async () => {
    let terminer: () => void = () => {};
    actions.closeSession.mockImplementation(
      () => new Promise<void>((resolve) => (terminer = resolve)),
    );
    render(<SignOutForm />);

    await userEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    await waitFor(() => expect(actions.closeSession).toHaveBeenCalled());
    expect(assign).not.toHaveBeenCalled();

    terminer();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/connexion"));
  });

  it("R28 — le bouton est désactivé pendant l'attente : une seule déconnexion part", async () => {
    let terminer: () => void = () => {};
    actions.closeSession.mockImplementation(
      () => new Promise<void>((resolve) => (terminer = resolve)),
    );
    render(<SignOutForm />);
    const bouton = screen.getByRole("button", { name: "Se déconnecter" });

    await userEvent.click(bouton);
    await waitFor(() => expect(bouton).toBeDisabled());
    await userEvent.click(bouton);

    expect(actions.closeSession).toHaveBeenCalledTimes(1);
    terminer();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
  });

  it("R28 — le bouton désactivé se distingue visuellement du bouton actif (opacité réduite)", async () => {
    // jsdom ne charge pas la feuille de style : on ne peut que lire la
    // déclaration d'opacité conditionnelle. L'opacité calculée (60 %) est à
    // vérifier dans le navigateur.
    actions.closeSession.mockImplementation(() => new Promise<void>(() => {}));
    render(<SignOutForm />);
    const bouton = screen.getByRole("button", { name: "Se déconnecter" });
    expect(bouton.className).not.toMatch(/(^|\s)opacity-/);

    await userEvent.click(bouton);

    await waitFor(() => expect(bouton).toBeDisabled());
    expect(bouton.className).toMatch(/disabled:opacity-60/);
  });

  it("R24 — si la fermeture de la session échoue (panne), la page ne change pas", async () => {
    // L'erreur d'une action remonte à la limite d'erreur de la page (error.tsx),
    // dont le rendu est vérifié par ServiceUnavailable. Ici : seul compte
    // l'absence de navigation, alors que le serveur n'a pas fermé la session.
    vi.spyOn(console, "error").mockImplementation(() => {});
    actions.closeSession.mockRejectedValue(new Error("base injoignable"));
    render(<SignOutForm />);

    await userEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    await waitFor(() => expect(actions.closeSession).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(assign).not.toHaveBeenCalled();
  });
});
