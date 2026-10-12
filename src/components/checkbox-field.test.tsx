import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CheckboxField } from "./checkbox-field";

const LIBELLE =
  "Je confirme avoir reçu en totalité le loyer et les charges indiqués ci-dessus pour ce mois.";

function setup(props: Partial<React.ComponentProps<typeof CheckboxField>> = {}) {
  return render(
    <form>
      <CheckboxField id="attestation" name="attestation" label={LIBELLE} {...props} />
    </form>,
  );
}

describe("CheckboxField (R14, R35)", () => {
  it("R35 — le libellé est relié à la case (rôle checkbox, nom = libellé)", () => {
    setup();

    expect(screen.getByRole("checkbox", { name: LIBELLE })).toBeInTheDocument();
  });

  it("R14 — la case n'est jamais cochée d'avance", () => {
    setup();

    expect(screen.getByRole("checkbox", { name: LIBELLE })).not.toBeChecked();
  });

  it("R14 — décochée, elle n'envoie rien du tout", () => {
    const { container } = setup();

    const donnees = new FormData(container.querySelector("form")!);
    expect(donnees.has("attestation")).toBe(false);
  });

  it("R14 — cochée, elle envoie « on » sous son nom (la valeur que les règles attendent)", async () => {
    const { container } = setup();

    await userEvent.click(screen.getByRole("checkbox", { name: LIBELLE }));

    const donnees = new FormData(container.querySelector("form")!);
    expect(donnees.get("attestation")).toBe("on");
  });

  it("R35 — cliquer le libellé coche la case", async () => {
    setup();

    await userEvent.click(screen.getByText(LIBELLE));

    expect(screen.getByRole("checkbox", { name: LIBELLE })).toBeChecked();
  });

  it("R35 — sans erreur : ni aria-invalid ni description", () => {
    setup();

    const case_ = screen.getByRole("checkbox", { name: LIBELLE });
    expect(case_).not.toHaveAttribute("aria-invalid", "true");
    expect(case_).not.toHaveAccessibleDescription();
  });

  it("R35 — avec erreur : aria-invalid et message dans la description accessible", () => {
    setup({ error: "Cochez la case." });

    const case_ = screen.getByRole("checkbox", { name: LIBELLE });
    expect(case_).toHaveAttribute("aria-invalid", "true");
    expect(case_).toHaveAccessibleDescription("Cochez la case.");
  });

  it("R35 — l'erreur précède l'aide, dans la description comme dans le document", () => {
    setup({ error: "Cochez la case.", hint: "Texte d'aide." });

    const case_ = screen.getByRole("checkbox", { name: LIBELLE });
    expect(case_).toHaveAccessibleDescription("Cochez la case. Texte d'aide.");
    const erreur = screen.getByText("Cochez la case.");
    const aide = screen.getByText("Texte d'aide.");
    expect(erreur.compareDocumentPosition(aide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("R35 — transmet required", () => {
    setup({ required: true });

    expect(screen.getByRole("checkbox", { name: LIBELLE })).toBeRequired();
  });
});
