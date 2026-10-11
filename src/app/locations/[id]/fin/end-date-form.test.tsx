import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EndDateFormState } from "@/rentals/rental-operation-state";

import { EndDateForm } from "./end-date-form";

// Seule frontière simulée : la Server Action, passée en prop (elle parle à la
// base). Le formulaire, le champ et le bouton sont réels.
type Action = (state: EndDateFormState, data: FormData) => Promise<EndDateFormState>;

const E8 = "Le service est momentanément indisponible. Réessayez dans quelques instants.";
const CANCEL = "/locations/7f3b2c1a-1111-4222-8333-444455556666";

function setup(initialEndDate = "", reponse?: EndDateFormState) {
  const action = vi.fn<Action>(async (state) => reponse ?? state);
  const view = render(
    <EndDateForm action={action} initialEndDate={initialEndDate} cancelHref={CANCEL} />,
  );
  return { ...view, action, form: view.container.querySelector("form")! };
}

const champ = () => screen.getByLabelText("Date de fin du bail");
const envoyer = () => userEvent.click(screen.getByRole("button", { name: "Enregistrer la date de fin" }));

describe("EndDateForm — contenus (R21, CA35)", () => {
  it("CA35 — champ de date obligatoire, vide sans date de fin", () => {
    setup();

    expect(champ()).toHaveAttribute("type", "date");
    expect(champ()).toHaveAttribute("name", "endDate");
    expect(champ()).toBeRequired();
    expect(champ()).toHaveValue("");
  });

  it("CA35 — le texte d'aide est la description accessible du champ", () => {
    setup();

    expect(champ()).toHaveAccessibleDescription(
      "Dernier jour du bail. La date peut être à venir.",
    );
  });

  it("CA35 — bouton d'envoi « Enregistrer la date de fin », de type submit", () => {
    setup();

    const bouton = screen.getByRole("button", { name: "Enregistrer la date de fin" });
    expect(bouton).toHaveAttribute("type", "submit");
    expect(bouton).toBeEnabled();
  });

  it("CA35 — lien « Annuler » vers le détail de la location", () => {
    setup();

    expect(screen.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", CANCEL);
  });

  it("R34 — erreurs natives désactivées (noValidate)", () => {
    const { form } = setup();

    expect(form).toHaveAttribute("novalidate");
  });

  it("CA37 — prérempli avec la date de fin enregistrée", () => {
    setup("2026-06-30");

    expect(champ()).toHaveValue("2026-06-30");
  });

  it("CA35 — aucune erreur ni aucun focus à l'ouverture", () => {
    const { form } = setup("2026-06-30");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(form.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
    expect(document.body).toHaveFocus();
  });

  it("R4 — aucun champ caché : ni identifiant de location ni de propriétaire", () => {
    const { form } = setup("2026-06-30");

    expect(form.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
    expect([...form.querySelectorAll("[name]")].map((e) => e.getAttribute("name"))).toEqual(["endDate"]);
    for (const c of form.querySelectorAll("input")) expect(c.outerHTML).not.toContain("7f3b2c1a");
  });
});

describe("EndDateForm — erreurs (R21, R34, CA36)", () => {
  it.each([
    ["L23", "", "Saisissez la date de fin du bail."],
    ["L20", "2026-02-30", "Saisissez une date valide."],
    ["L21", "2100-01-01", "La date doit être comprise entre le 1er janvier 1950 et le 31 décembre 2099."],
    ["L24", "2026-01-04", "La date de fin ne peut pas être antérieure à la date de début du bail."],
  ] as const)(
    "CA36 — %s : message sous le champ, aria-invalid, description accessible et focus",
    async (code, saisie, message) => {
      setup("", { endDate: saisie, error: code });

      await envoyer();

      await screen.findByText(message);
      expect(champ()).toHaveAttribute("aria-invalid", "true");
      expect(champ()).toHaveAccessibleDescription(
        `${message} Dernier jour du bail. La date peut être à venir.`,
      );
      expect(champ()).toHaveFocus();
    },
  );

  it("CA36 — L24 : la date réelle saisie est conservée dans le champ", async () => {
    setup("", { endDate: "2026-01-04", error: "L24" });

    await envoyer();

    await screen.findByText(/ne peut pas être antérieure/);
    expect(champ()).toHaveValue("2026-01-04");
  });

  it("CA36 — L21 : la date réelle hors bornes est conservée dans le champ", async () => {
    setup("", { endDate: "2100-01-01", error: "L21" });

    await envoyer();

    await screen.findByText(/comprise entre le 1er janvier 1950/);
    expect(champ()).toHaveValue("2100-01-01");
  });

  it("note de tête — L20 sur une date inexistante : le champ revient vide, le message reste affiché", async () => {
    setup("", { endDate: "2026-02-30", error: "L20" });

    await envoyer();

    await screen.findByText("Saisissez une date valide.");
    expect(champ()).toHaveValue("");
  });

  it("R34 — le message est placé avant le texte d'aide", async () => {
    setup("", { endDate: "", error: "L23" });

    await envoyer();

    const erreur = await screen.findByText("Saisissez la date de fin du bail.");
    const aide = screen.getByText("Dernier jour du bail. La date peut être à venir.");
    expect(erreur.compareDocumentPosition(aide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("R31, R34 — E8 : alerte de formulaire avant le champ, avec le focus, valeur conservée", async () => {
    const { form } = setup("", { endDate: "2026-06-30", formError: E8 });

    await envoyer();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(E8);
    expect(alerte).toHaveFocus();
    expect(alerte.compareDocumentPosition(champ()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(champ()).toHaveValue("2026-06-30");
    expect(form.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });

  it("R34 — l'envoi appelle l'action avec la seule date saisie", async () => {
    const { action } = setup();
    const user = userEvent.setup();

    await user.type(champ(), "2026-06-30");
    await user.click(screen.getByRole("button", { name: "Enregistrer la date de fin" }));

    expect(action).toHaveBeenCalledTimes(1);
    const data = action.mock.calls[0][1];
    expect([...data.keys()]).toEqual(["endDate"]);
    expect(data.get("endDate")).toBe("2026-06-30");
  });
});

describe("EndDateForm — attente (R34)", () => {
  it("R34 — en attente : libellé « Enregistrement en cours », bouton indisponible, puis rétabli", async () => {
    let terminer: (etat: EndDateFormState) => void = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (terminer = resolve)));
    render(<EndDateForm action={action} initialEndDate="" cancelHref={CANCEL} />);

    await envoyer();

    const bouton = await screen.findByRole("button", { name: "Enregistrement en cours" });
    expect(bouton).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Enregistrer la date de fin" })).not.toBeInTheDocument();

    const { act } = await import("@testing-library/react");
    await act(async () => terminer({ endDate: "" }));
    expect(await screen.findByRole("button", { name: "Enregistrer la date de fin" })).toBeEnabled();
  });
});
