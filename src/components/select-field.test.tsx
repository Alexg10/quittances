import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SelectField } from "./select-field";

const OPTIONS = [
  { value: "2026-03", label: "Mars 2026" },
  { value: "2026-02", label: "Février 2026" },
  { value: "2026-01", label: "Janvier 2026" },
];

function setup(props: Partial<React.ComponentProps<typeof SelectField>> = {}) {
  return render(
    <form>
      <SelectField
        id="month"
        name="month"
        label="Mois"
        options={OPTIONS}
        defaultValue="2026-03"
        {...props}
      />
    </form>,
  );
}

describe("SelectField (R35)", () => {
  it("R35 — le libellé visible est relié à la liste (rôle combobox, nom « Mois »)", () => {
    setup();

    expect(screen.getByRole("combobox", { name: "Mois" })).toBeInTheDocument();
  });

  it("R25 — propose les options dans l'ordre donné, avec leur libellé", () => {
    setup();

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Mars 2026", "Février 2026", "Janvier 2026"]);
  });

  it("R25 — l'option par défaut est sélectionnée à l'ouverture", () => {
    setup({ defaultValue: "2026-02" });

    expect(screen.getByRole("combobox", { name: "Mois" })).toHaveValue("2026-02");
    expect(screen.getByRole("option", { name: "Février 2026" })).toHaveProperty(
      "selected",
      true,
    );
  });

  it("R25 — par défaut absent des options : le navigateur sélectionne la première", () => {
    setup({ defaultValue: "2099-12" });

    expect(screen.getByRole("combobox", { name: "Mois" })).toHaveValue("2026-03");
  });

  it("R35 — envoie la valeur de l'option choisie sous le nom du champ", async () => {
    const { container } = setup();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Mois" }),
      "2026-01",
    );

    const donnees = new FormData(container.querySelector("form")!);
    expect(donnees.get("month")).toBe("2026-01");
  });

  it("R35 — sans erreur : ni aria-invalid ni description, aucune alerte", () => {
    setup();

    const liste = screen.getByRole("combobox", { name: "Mois" });
    expect(liste).not.toHaveAttribute("aria-invalid", "true");
    expect(liste).not.toHaveAccessibleDescription();
  });

  it("R35 — avec erreur : aria-invalid et message dans la description accessible", () => {
    setup({ error: "Choisissez un mois." });

    const liste = screen.getByRole("combobox", { name: "Mois" });
    expect(liste).toHaveAttribute("aria-invalid", "true");
    expect(liste).toHaveAccessibleDescription("Choisissez un mois.");
  });

  it("R35 — le message d'erreur précède le texte d'aide, dans la description comme dans le document", () => {
    setup({ error: "Choisissez un mois.", hint: "Texte d'aide." });

    const liste = screen.getByRole("combobox", { name: "Mois" });
    expect(liste).toHaveAccessibleDescription("Choisissez un mois. Texte d'aide.");
    const erreur = screen.getByText("Choisissez un mois.");
    const aide = screen.getByText("Texte d'aide.");
    expect(erreur.compareDocumentPosition(aide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("R35 — le texte d'aide seul fait partie de la description", () => {
    setup({ hint: "Texte d'aide." });

    expect(screen.getByRole("combobox", { name: "Mois" })).toHaveAccessibleDescription(
      "Texte d'aide.",
    );
  });

  it("R35 — transmet required et autocomplete=off", () => {
    setup({ required: true, autoComplete: "off" });

    const liste = screen.getByRole("combobox", { name: "Mois" });
    expect(liste).toBeRequired();
    expect(liste).toHaveAttribute("autocomplete", "off");
  });
});
