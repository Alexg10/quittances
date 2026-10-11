import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  EMPTY_RENTAL_FORM_STATE,
  type RentalFormState,
} from "@/rentals/rental-form-state";

import { RentalForm } from "./rental-form";

// Les dix champs de R33, dans l'ordre, avec les valeurs de la spécification.
const FIELDS = [
  { name: "address", label: "Adresse", type: "text", inputmode: null, required: true, hint: null },
  {
    name: "addressComplement",
    label: "Complément d'adresse (facultatif)",
    type: "text",
    inputmode: null,
    required: false,
    hint: "Bâtiment, étage, numéro d'appartement.",
  },
  { name: "postalCode", label: "Code postal", type: "text", inputmode: "numeric", required: true, hint: null },
  { name: "city", label: "Ville", type: "text", inputmode: null, required: true, hint: null },
  {
    name: "tenantName",
    label: "Nom du locataire",
    type: "text",
    inputmode: null,
    required: true,
    hint: "Prénom et nom. Pour un couple ou une colocation à bail unique, indiquez tous les noms.",
  },
  {
    name: "tenantEmail",
    label: "Adresse e-mail du locataire",
    type: "email",
    inputmode: null,
    required: true,
    hint: "Aucun e-mail n'est envoyé au locataire pour l'instant.",
  },
  {
    name: "rent",
    label: "Loyer hors charges",
    type: "text",
    inputmode: "decimal",
    required: true,
    hint: "Montant mensuel en euros, par exemple 850 ou 850,50.",
  },
  {
    name: "charges",
    label: "Charges",
    type: "text",
    inputmode: "decimal",
    required: true,
    hint: "Montant mensuel en euros. Saisissez 0 s'il n'y a pas de charges.",
  },
  {
    name: "dueDay",
    label: "Jour d'échéance",
    type: "text",
    inputmode: "numeric",
    required: true,
    hint: "Un nombre de 1 à 31. Les mois plus courts, l'échéance tombe le dernier jour du mois.",
  },
  { name: "startDate", label: "Date de début du bail", type: "date", inputmode: null, required: true, hint: null },
] as const;

const FILLED: RentalFormState = {
  fields: {
    address: "12 rue des Lilas",
    addressComplement: "Bâtiment B",
    postalCode: "69003",
    city: "Lyon",
    tenantName: "Marie Durand",
    tenantEmail: "marie@quittances.test",
    rent: "850,00",
    charges: "1250,50",
    dueDay: "5",
    startDate: "2026-01-05",
  },
  errors: {},
};

function setup(
  props: Partial<React.ComponentProps<typeof RentalForm>> = {},
) {
  const action = vi.fn();
  const view = render(
    <RentalForm
      state={EMPTY_RENTAL_FORM_STATE}
      action={action}
      pending={false}
      submitLabel="Ajouter la location"
      pendingLabel="Ajout en cours"
      cancelHref="/tableau-de-bord"
      {...props}
    />,
  );
  return { ...view, action, form: view.container.querySelector("form")! };
}

const field = (label: string) => screen.getByLabelText(label);

describe("RentalForm — structure (R33, CA21)", () => {
  it("CA21 — présente les trois groupes nommés, dans l'ordre", () => {
    setup();

    const groupes = screen.getAllByRole("group").map((g) => g.querySelector("legend")?.textContent);
    expect(groupes).toEqual(["Le logement", "Le locataire", "Le loyer et le bail"]);
    expect(screen.getByRole("group", { name: "Le logement" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Le locataire" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Le loyer et le bail" })).toBeInTheDocument();
  });

  it("CA21 — les champs sont répartis dans le bon groupe", () => {
    setup();

    const logement = within(screen.getByRole("group", { name: "Le logement" }));
    const locataire = within(screen.getByRole("group", { name: "Le locataire" }));
    const loyer = within(screen.getByRole("group", { name: "Le loyer et le bail" }));
    expect(logement.getAllByRole("textbox")).toHaveLength(4);
    expect(logement.getByLabelText("Ville")).toBeInTheDocument();
    expect(locataire.getByLabelText("Nom du locataire")).toBeInTheDocument();
    expect(locataire.getByLabelText("Adresse e-mail du locataire")).toBeInTheDocument();
    expect(loyer.getByLabelText("Date de début du bail")).toBeInTheDocument();
    expect(loyer.getByLabelText("Charges")).toBeInTheDocument();
  });

  it("CA21 — exactement dix champs de saisie, dans l'ordre de R33", () => {
    const { form } = setup();

    const names = [...form.querySelectorAll("input")].map((i) => i.getAttribute("name"));
    expect(names).toEqual(FIELDS.map((f) => f.name));
  });

  it.each(FIELDS)(
    "CA21 — $label : libellé relié, name, type, inputmode, autocomplete, obligation, sans placeholder",
    (spec) => {
      setup();

      const input = field(spec.label);
      expect(input).toHaveAttribute("name", spec.name);
      expect(input).toHaveAttribute("type", spec.type);
      if (spec.inputmode) {
        expect(input).toHaveAttribute("inputmode", spec.inputmode);
      } else {
        expect(input).not.toHaveAttribute("inputmode");
      }
      expect(input).toHaveAttribute("autocomplete", "off");
      expect(input).not.toHaveAttribute("placeholder");
      if (spec.required) {
        expect(input).toBeRequired();
      } else {
        expect(input).not.toBeRequired();
      }
    },
  );

  it("CA21 — « Complément d'adresse » est le seul champ facultatif", () => {
    setup();

    const requis = screen.getAllByLabelText(/./, { selector: "input" }).filter((i) => (i as HTMLInputElement).required);
    expect(requis).toHaveLength(9);
  });

  it("CA21 — aucun champ de type number", () => {
    const { form } = setup();

    expect(form.querySelector('input[type="number"]')).toBeNull();
  });

  it("R33 — l'adresse e-mail n'a ni majuscule automatique ni correction", () => {
    setup();

    const email = field("Adresse e-mail du locataire");
    expect(email).toHaveAttribute("autocapitalize", "none");
    expect(email).toHaveAttribute("spellcheck", "false");
  });

  it.each(FIELDS.filter((f) => f.hint))(
    "CA21 — $label : le texte d'aide, mot pour mot, est la description accessible",
    (spec) => {
      setup();

      expect(field(spec.label)).toHaveAccessibleDescription(spec.hint!);
    },
  );

  it.each(FIELDS.filter((f) => !f.hint))(
    "CA21 — $label : aucun texte d'aide, aucune description",
    (spec) => {
      setup();

      expect(field(spec.label)).not.toHaveAccessibleDescription();
    },
  );

  it("R34 — les erreurs de validation natives sont désactivées (noValidate)", () => {
    const { form } = setup();

    expect(form).toHaveAttribute("novalidate");
  });

  it("R4 — aucun champ caché : ni identifiant de location ni de propriétaire", () => {
    const { form } = setup({ state: FILLED });

    expect(form.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
    expect(form.querySelectorAll("[name]")).toHaveLength(10);
  });

  it("R4 — l'identifiant d'une location ne figure nulle part dans le formulaire", () => {
    const { container } = setup({
      cancelHref: "/locations/7f3b2c1a-1111-4222-8333-444455556666",
    });

    // Seul le lien « Annuler » (une adresse, jamais un champ) peut porter l'identifiant.
    const champs = container.querySelectorAll("input, textarea, select");
    for (const c of champs) {
      expect(c.outerHTML).not.toContain("7f3b2c1a");
    }
  });
});

describe("RentalForm — état initial (CA21, R33)", () => {
  it("R33 — à l'état vide : aucune erreur, aucun message, aucun champ marqué invalide", () => {
    const { form } = setup();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(form.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });

  it("R33 — à l'ouverture, aucun champ ne prend le focus", () => {
    setup();

    expect(document.body).toHaveFocus();
  });

  it.each(FIELDS)("R33 — $label est vide à la création", (spec) => {
    setup();

    expect(field(spec.label)).toHaveValue("");
  });

  it("R33 — l'ordre de tabulation : dix champs, le bouton d'envoi, puis Annuler", async () => {
    setup();
    const user = userEvent.setup();

    const ordre: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      const el = document.activeElement as HTMLElement;
      ordre.push(el.getAttribute("name") ?? el.textContent ?? "");
    }

    expect(ordre).toEqual([
      ...FIELDS.map((f) => f.name),
      "Ajouter la location",
      "Annuler",
    ]);
  });
});

describe("RentalForm — modification : préremplissage (R32)", () => {
  it.each([
    ["Adresse", "12 rue des Lilas"],
    ["Complément d'adresse (facultatif)", "Bâtiment B"],
    ["Code postal", "69003"],
    ["Ville", "Lyon"],
    ["Nom du locataire", "Marie Durand"],
    ["Adresse e-mail du locataire", "marie@quittances.test"],
    ["Loyer hors charges", "850,00"],
    ["Charges", "1250,50"],
    ["Jour d'échéance", "5"],
    ["Date de début du bail", "2026-01-05"],
  ])("R32 — %s est prérempli avec « %s »", (label, valeur) => {
    setup({ state: FILLED });

    expect(field(label)).toHaveValue(valeur);
  });

  it("R32 — le formulaire prérempli n'affiche aucune erreur et ne prend pas le focus", () => {
    setup({ state: FILLED });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });
});

describe("RentalForm — erreurs de champ (R34, CA21)", () => {
  const WITH_ERRORS: RentalFormState = {
    fields: { ...FILLED.fields, city: "", postalCode: "7501", rent: "abc" },
    errors: { city: "L6", postalCode: "L5", rent: "L13" },
  };

  it("CA21 — chaque message apparaît sous le bon champ, dans sa description accessible", () => {
    setup({ state: WITH_ERRORS });

    expect(field("Ville")).toHaveAccessibleDescription("Saisissez la ville.");
    expect(field("Code postal")).toHaveAccessibleDescription(
      "Le code postal doit contenir 5 chiffres.",
    );
  });

  it("CA21 — le champ en erreur porte aria-invalid, les autres non", () => {
    setup({ state: WITH_ERRORS });

    expect(field("Ville")).toHaveAttribute("aria-invalid", "true");
    expect(field("Code postal")).toHaveAttribute("aria-invalid", "true");
    expect(field("Loyer hors charges")).toHaveAttribute("aria-invalid", "true");
    expect(field("Adresse")).not.toHaveAttribute("aria-invalid", "true");
    expect(field("Charges")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("CA21 — l'erreur est annoncée avant le texte d'aide (erreur puis aide)", () => {
    setup({ state: WITH_ERRORS });

    expect(field("Loyer hors charges")).toHaveAccessibleDescription(
      "Saisissez un montant en euros, par exemple 850 ou 850,50. Montant mensuel en euros, par exemple 850 ou 850,50.",
    );
  });

  it("CA21 — l'erreur est placée avant l'aide dans le document", () => {
    setup({
      state: {
        fields: { ...FILLED.fields, tenantEmail: "paul" },
        errors: { tenantEmail: "L11" },
      },
    });

    const erreur = screen.getByText("Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.");
    const aide = screen.getByText("Aucun e-mail n'est envoyé au locataire pour l'instant.");
    expect(erreur.compareDocumentPosition(aide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("R34 — toutes les valeurs saisies sont réaffichées telles quelles, y compris celles en erreur", () => {
    setup({ state: WITH_ERRORS });

    expect(field("Ville")).toHaveValue("");
    expect(field("Code postal")).toHaveValue("7501");
    expect(field("Loyer hors charges")).toHaveValue("abc");
    expect(field("Adresse")).toHaveValue("12 rue des Lilas");
    expect(field("Nom du locataire")).toHaveValue("Marie Durand");
    expect(field("Date de début du bail")).toHaveValue("2026-01-05");
  });

  it("R34 — le focus va sur le premier champ en erreur dans l'ordre de R33", () => {
    setup({
      state: {
        fields: { ...FILLED.fields, charges: "", dueDay: "", tenantName: "" },
        // Ordre des clés volontairement inversé par rapport à R33.
        errors: { dueDay: "L17", charges: "L16", tenantName: "L8" },
      },
    });

    expect(field("Nom du locataire")).toHaveFocus();
  });

  it("R34 — un message de formulaire passe avant le focus sur un champ", () => {
    setup({
      state: {
        fields: FILLED.fields,
        errors: { city: "L6" },
        formError: "Vous avez atteint la limite de 100 locations. Supprimez-en une pour en ajouter une autre.",
      },
    });

    expect(screen.getByRole("alert")).toHaveFocus();
  });
});

describe("RentalForm — message de formulaire (R34, CA21)", () => {
  const LIMIT =
    "Vous avez atteint la limite de 100 locations. Supprimez-en une pour en ajouter une autre.";

  it("CA21 — a le rôle alert et le texte reçu", () => {
    setup({ state: { ...FILLED, formError: LIMIT } });

    expect(screen.getByRole("alert")).toHaveTextContent(LIMIT);
  });

  it("CA21 — précède le premier groupe", () => {
    setup({ state: { ...FILLED, formError: LIMIT } });

    const alerte = screen.getByRole("alert");
    const premier = screen.getByRole("group", { name: "Le logement" });
    expect(alerte.compareDocumentPosition(premier) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("R34 — prend le focus", () => {
    setup({ state: { ...FILLED, formError: LIMIT } });

    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("R34 — les valeurs saisies restent affichées avec un message de formulaire", () => {
    setup({ state: { ...FILLED, formError: LIMIT } });

    expect(field("Adresse")).toHaveValue("12 rue des Lilas");
    expect(field("Charges")).toHaveValue("1250,50");
  });

  it("R34 — sans message de formulaire, aucune alerte", () => {
    setup({ state: FILLED });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("RentalForm — envoi, attente, annulation (R32, R34)", () => {
  it("R32 — création : le bouton porte le libellé reçu et reste actif", () => {
    setup();

    expect(screen.getByRole("button", { name: "Ajouter la location" })).toBeEnabled();
  });

  it("R32 — modification : le libellé d'envoi est celui qu'on lui donne", () => {
    setup({
      submitLabel: "Enregistrer les modifications",
      pendingLabel: "Enregistrement en cours",
    });

    expect(
      screen.getByRole("button", { name: "Enregistrer les modifications" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajouter la location" })).not.toBeInTheDocument();
  });

  it("R34 — en attente : le bouton affiche le libellé d'attente et est indisponible", () => {
    setup({ pending: true });

    const bouton = screen.getByRole("button", { name: "Ajout en cours" });
    expect(bouton).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Ajouter la location" })).not.toBeInTheDocument();
  });

  it("R34 — en attente en modification : libellé « Enregistrement en cours »", () => {
    setup({
      pending: true,
      submitLabel: "Enregistrer les modifications",
      pendingLabel: "Enregistrement en cours",
    });

    expect(screen.getByRole("button", { name: "Enregistrement en cours" })).toBeDisabled();
  });

  it("R34 — le bouton d'envoi est un bouton de type submit", () => {
    setup();

    expect(screen.getByRole("button", { name: "Ajouter la location" })).toHaveAttribute("type", "submit");
  });

  it("R34 — le seul bouton est le bouton d'envoi", () => {
    setup();

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("R32 — création : « Annuler » mène à /tableau-de-bord", () => {
    setup({ cancelHref: "/tableau-de-bord" });

    expect(screen.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", "/tableau-de-bord");
  });

  it("R32 — modification : « Annuler » mène à la cible reçue", () => {
    setup({ cancelHref: "/locations/7f3b2c1a-1111-4222-8333-444455556666" });

    expect(screen.getByRole("link", { name: "Annuler" })).toHaveAttribute(
      "href",
      "/locations/7f3b2c1a-1111-4222-8333-444455556666",
    );
  });

  it("R34 — « Annuler » est le seul lien du formulaire", () => {
    setup();

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("R34 — l'envoi appelle l'action avec les dix valeurs saisies", async () => {
    const { action } = setup();
    const user = userEvent.setup();

    await user.type(field("Adresse"), "12 rue des Lilas");
    await user.type(field("Charges"), "0");
    await user.click(screen.getByRole("button", { name: "Ajouter la location" }));

    expect(action).toHaveBeenCalledTimes(1);
    const data = action.mock.calls[0][0] as FormData;
    expect(data.get("address")).toBe("12 rue des Lilas");
    expect(data.get("charges")).toBe("0");
    expect([...data.keys()].sort()).toEqual(FIELDS.map((f) => f.name).sort());
  });

  it("R34 — un formulaire vide est quand même envoyé (c'est le serveur qui valide)", async () => {
    const { action } = setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Ajouter la location" }));

    expect(action).toHaveBeenCalledTimes(1);
  });
});
