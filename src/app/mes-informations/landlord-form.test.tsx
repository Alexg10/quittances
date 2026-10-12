import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  toLandlordFormState,
  type LandlordFormState,
} from "@/receipts/landlord-form-state";

import { saveLandlordAction } from "./actions";
import { LandlordForm } from "./landlord-form";

// Seule frontière simulée : la Server Action (session, base). Le formulaire,
// ses champs et son bouton sont réels.
vi.mock("./actions", () => ({ saveLandlordAction: vi.fn() }));
const action = vi.mocked(saveLandlordAction);

const E8 = "Le service est momentanément indisponible. Réessayez dans quelques instants.";

// Les cinq champs de « Contenus » et de R35, dans l'ordre.
const FIELDS = [
  { name: "name", label: "Nom du bailleur", autocomplete: "name", inputmode: null, required: true,
    hint: "Prénom et nom, ou dénomination pour une société. Pour plusieurs bailleurs, indiquez tous les noms." },
  { name: "address", label: "Adresse", autocomplete: "address-line1", inputmode: null, required: true, hint: null },
  { name: "addressComplement", label: "Complément d'adresse (facultatif)", autocomplete: "address-line2",
    inputmode: null, required: false, hint: "Bâtiment, étage, numéro d'appartement." },
  { name: "postalCode", label: "Code postal", autocomplete: "postal-code", inputmode: "numeric", required: true, hint: null },
  { name: "city", label: "Ville", autocomplete: "address-level2", inputmode: null, required: true, hint: null },
] as const;

const VALEURS = {
  name: "Marie Durand",
  address: "3 rue de la Paix",
  addressComplement: "",
  postalCode: "75002",
  city: "Paris",
};

function setup(initialState: LandlordFormState = toLandlordFormState(null)) {
  const view = render(<LandlordForm initialState={initialState} />);
  return { ...view, form: view.container.querySelector("form")! };
}

const champ = (label: string) => screen.getByRole("textbox", { name: label });
// Clique sur le bouton, puis laisse la réponse (simulée) de l'action arriver et être
// affichée avant de rendre la main.
async function envoyer() {
  await userEvent.click(
    screen.getByRole("button", { name: "Enregistrer mes informations" }),
  );
  await act(async () => {});
}

beforeEach(() => {
  action.mockReset();
  action.mockResolvedValue(toLandlordFormState(null));
});

describe("LandlordForm — contenu et structure (R35, CA19)", () => {
  it("CA19 — un groupe nommé « Le bailleur » contient les cinq champs", () => {
    setup();

    const groupe = within(screen.getByRole("group", { name: "Le bailleur" }));
    for (const { label } of FIELDS) {
      expect(groupe.getByRole("textbox", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("textbox")).toHaveLength(5);
  });

  it("CA19 — les cinq champs sont dans l'ordre de la spécification", () => {
    setup();

    const noms = screen.getAllByRole("textbox").map((c) => c.getAttribute("name"));
    expect(noms).toEqual(FIELDS.map((f) => f.name));
  });

  it.each(FIELDS)("CA19, R35 — $label : name, type texte, autocomplete, mode de saisie", (spec) => {
    setup();

    const input = champ(spec.label);
    expect(input).toHaveAttribute("name", spec.name);
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("autocomplete", spec.autocomplete);
    if (spec.inputmode) {
      expect(input).toHaveAttribute("inputmode", spec.inputmode);
    }
  });

  it.each(FIELDS)("R1 — $label : obligatoire seulement si la spécification le dit", (spec) => {
    setup();

    if (spec.required) {
      expect(champ(spec.label)).toBeRequired();
    } else {
      expect(champ(spec.label)).not.toBeRequired();
    }
  });

  it.each(FIELDS)("R35 — $label : pas de placeholder", (spec) => {
    setup();

    expect(champ(spec.label)).not.toHaveAttribute("placeholder");
  });

  it.each(FIELDS)("CA19 — $label : texte d'aide de « Contenus » (ou aucun)", (spec) => {
    setup();

    if (spec.hint) {
      expect(champ(spec.label)).toHaveAccessibleDescription(spec.hint);
    } else {
      expect(champ(spec.label)).not.toHaveAccessibleDescription();
    }
  });

  it("CA19 — le bouton d'envoi est un submit « Enregistrer mes informations »", () => {
    const { form } = setup();

    const bouton = screen.getByRole("button", { name: "Enregistrer mes informations" });
    expect(bouton).toHaveAttribute("type", "submit");
    expect(bouton).toBeEnabled();
    expect(bouton.closest("form")).toBe(form);
  });

  it("CA19 — le lien « Annuler » mène à /tableau-de-bord", () => {
    setup();

    expect(screen.getByRole("link", { name: "Annuler" })).toHaveAttribute(
      "href",
      "/tableau-de-bord",
    );
  });

  it("CA19, R35 — aucun lien vers /mes-informations et aucun champ caché", () => {
    const { form } = setup();

    expect(screen.queryByRole("link", { name: /mes informations/i })).not.toBeInTheDocument();
    expect(form.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
  });

  it("R35 — pas de bulle native : le formulaire est noValidate", () => {
    const { form } = setup();

    expect(form).toHaveAttribute("novalidate");
  });
});

describe("LandlordForm — état vide et préremplissage (R26, CA19)", () => {
  it("CA19 — état vide : cinq champs vides, aucun message, aucun champ focalisé", () => {
    setup();

    for (const { label } of FIELDS) {
      expect(champ(label)).toHaveValue("");
      expect(champ(label)).not.toHaveAttribute("aria-invalid", "true");
    }
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it("CA19 — préremplie avec les valeurs enregistrées, complément compris", () => {
    setup(
      toLandlordFormState({
        name: "SCI des Lilas",
        address: "3 rue de la Paix",
        addressComplement: "Bâtiment B",
        postalCode: "75002",
        city: "Paris",
      }),
    );

    expect(champ("Nom du bailleur")).toHaveValue("SCI des Lilas");
    expect(champ("Adresse")).toHaveValue("3 rue de la Paix");
    expect(champ("Complément d'adresse (facultatif)")).toHaveValue("Bâtiment B");
    expect(champ("Code postal")).toHaveValue("75002");
    expect(champ("Ville")).toHaveValue("Paris");
    expect(document.body).toHaveFocus();
  });

  it("R1 — sans complément enregistré, le champ est vide (ni « null » ni « undefined »)", () => {
    setup(
      toLandlordFormState({
        name: "Marie Durand",
        address: "3 rue de la Paix",
        addressComplement: null,
        postalCode: "75002",
        city: "Paris",
      }),
    );

    expect(champ("Complément d'adresse (facultatif)")).toHaveValue("");
  });
});

describe("toLandlordFormState (R26)", () => {
  it("R26 — sans informations : cinq champs vides, aucune erreur, aucun message", () => {
    expect(toLandlordFormState(null)).toEqual({
      fields: { name: "", address: "", addressComplement: "", postalCode: "", city: "" },
      errors: {},
    });
  });

  it("R26 — avec informations : les valeurs enregistrées, complément absent devenu chaîne vide", () => {
    expect(
      toLandlordFormState({
        name: "Marie Durand",
        address: "3 rue de la Paix",
        addressComplement: null,
        postalCode: "75002",
        city: "Paris",
      }),
    ).toEqual({
      fields: {
        name: "Marie Durand",
        address: "3 rue de la Paix",
        addressComplement: "",
        postalCode: "75002",
        city: "Paris",
      },
      errors: {},
    });
  });
});

describe("LandlordForm — envoi (R35)", () => {
  it("R35 — l'envoi appelle l'action une fois avec les cinq valeurs saisies sous leurs noms", async () => {
    setup();
    await userEvent.type(champ("Nom du bailleur"), "Marie Durand");
    await userEvent.type(champ("Adresse"), "3 rue de la Paix");
    await userEvent.type(champ("Code postal"), "75002");
    await userEvent.type(champ("Ville"), "Paris");

    await envoyer();

    expect(action).toHaveBeenCalledTimes(1);
    const donnees = action.mock.calls[0][1];
    expect(Object.fromEntries(donnees.entries())).toEqual(VALEURS);
  });

  it("R35 — formulaire vide : l'envoi part quand même (le serveur valide, pas le navigateur)", async () => {
    setup();

    await envoyer();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("R35 — en attente : « Enregistrement en cours », bouton indisponible, puis rétabli", async () => {
    let terminer: (etat: LandlordFormState) => void = () => {};
    action.mockImplementation(() => new Promise((resolve) => (terminer = resolve)));
    setup();

    await envoyer();

    const attente = await screen.findByRole("button", { name: "Enregistrement en cours" });
    expect(attente).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Enregistrer mes informations" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Enregistrement en cours");

    await act(async () => terminer(toLandlordFormState(null)));
    expect(
      await screen.findByRole("button", { name: "Enregistrer mes informations" }),
    ).toBeEnabled();
  });

  it("R35 — pendant l'attente, un second clic n'envoie pas une seconde demande", async () => {
    let terminer: (etat: LandlordFormState) => void = () => {};
    action.mockImplementation(() => new Promise((resolve) => (terminer = resolve)));
    setup();

    await envoyer();
    await userEvent.click(await screen.findByRole("button", { name: "Enregistrement en cours" }));

    expect(action).toHaveBeenCalledTimes(1);
    // Une action laissée en attente bloquerait les tests suivants : React
    // regroupe les actions asynchrones en cours.
    await act(async () => terminer(toLandlordFormState(null)));
  });
});

describe("LandlordForm — erreurs (B1 à B3, L2 à L7, L25, E8 ; CA20)", () => {
  it("CA20 — B1, B3, L4 et L6 sont sous leurs champs, avec aria-invalid, et le focus va à « Nom du bailleur »", async () => {
    action.mockResolvedValue({
      fields: { name: "", address: "", addressComplement: "", postalCode: "", city: "" },
      errors: { name: "B1", address: "B3", postalCode: "L4", city: "L6" },
    });
    setup();

    await envoyer();

    const attendus = [
      ["Nom du bailleur", "Saisissez le nom du bailleur."],
      ["Adresse", "Saisissez votre adresse."],
      ["Code postal", "Saisissez le code postal."],
      ["Ville", "Saisissez la ville."],
    ] as const;
    for (const [label, message] of attendus) {
      expect(champ(label)).toHaveAttribute("aria-invalid", "true");
      expect(champ(label)).toHaveAccessibleDescription(expect.stringContaining(message));
    }
    expect(champ("Complément d'adresse (facultatif)")).not.toHaveAttribute("aria-invalid", "true");
    expect(champ("Nom du bailleur")).toHaveFocus();
  });

  it.each([
    ["B1", "name", "Nom du bailleur", "Saisissez le nom du bailleur."],
    ["B2", "name", "Nom du bailleur", "Le nom du bailleur ne peut pas dépasser 100 caractères."],
    ["B3", "address", "Adresse", "Saisissez votre adresse."],
    ["L2", "address", "Adresse", "L'adresse ne peut pas dépasser 200 caractères."],
    ["L25", "address", "Adresse", "Ce champ contient des caractères non autorisés."],
    ["L3", "addressComplement", "Complément d'adresse (facultatif)", "Le complément d'adresse ne peut pas dépasser 100 caractères."],
    ["L25", "addressComplement", "Complément d'adresse (facultatif)", "Ce champ contient des caractères non autorisés."],
    ["L4", "postalCode", "Code postal", "Saisissez le code postal."],
    ["L5", "postalCode", "Code postal", "Le code postal doit contenir 5 chiffres."],
    ["L6", "city", "Ville", "Saisissez la ville."],
    ["L7", "city", "Ville", "La ville ne peut pas dépasser 100 caractères."],
    ["L25", "name", "Nom du bailleur", "Ce champ contient des caractères non autorisés."],
  ] as const)("%s — le message est sous « %s » (%s) : %s", async (code, nom, label, message) => {
    action.mockResolvedValue({
      fields: { ...toLandlordFormState(null).fields, [nom]: "valeur saisie" },
      errors: { [nom]: code },
    });
    setup();

    await envoyer();

    expect(champ(label)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(champ(label)).toHaveAccessibleDescription(expect.stringContaining(message));
  });

  it("R35 — l'erreur est annoncée avant le texte d'aide du champ", async () => {
    action.mockResolvedValue({
      fields: toLandlordFormState(null).fields,
      errors: { name: "B1" },
    });
    setup();

    await envoyer();

    expect(champ("Nom du bailleur")).toHaveAccessibleDescription(
      "Saisissez le nom du bailleur. Prénom et nom, ou dénomination pour une société. Pour plusieurs bailleurs, indiquez tous les noms.",
    );
  });

  it("CA20 — avec une seule erreur L5, chaque champ contient ce qui a été saisi et le focus va au code postal", async () => {
    action.mockResolvedValue({
      fields: {
        name: "Marie Durand",
        address: "3 rue de la Paix",
        addressComplement: "Bâtiment B",
        postalCode: "7501",
        city: "Paris",
      },
      errors: { postalCode: "L5" },
    });
    setup();

    await envoyer();

    expect(champ("Nom du bailleur")).toHaveValue("Marie Durand");
    expect(champ("Adresse")).toHaveValue("3 rue de la Paix");
    expect(champ("Complément d'adresse (facultatif)")).toHaveValue("Bâtiment B");
    expect(champ("Code postal")).toHaveValue("7501");
    expect(champ("Ville")).toHaveValue("Paris");
    expect(screen.getAllByText("Le code postal doit contenir 5 chiffres.")).toHaveLength(1);
    expect(champ("Code postal")).toHaveFocus();
  });

  it("R35 — le focus va au premier champ en erreur dans l'ordre du formulaire (ici la ville, seule en erreur)", async () => {
    action.mockResolvedValue({
      fields: { ...toLandlordFormState(null).fields, city: "x".repeat(101) },
      errors: { city: "L7" },
    });
    setup();

    await envoyer();

    expect(champ("Ville")).toHaveFocus();
  });

  it("R35 — E8 : message de formulaire (alerte) avec le focus, valeurs conservées, bouton redevenu actif", async () => {
    action.mockResolvedValue({
      fields: { ...toLandlordFormState(null).fields, ...VALEURS },
      errors: {},
      formError: E8,
    });
    setup();

    await envoyer();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(E8);
    expect(alerte).toHaveFocus();
    expect(champ("Nom du bailleur")).toHaveValue("Marie Durand");
    expect(champ("Code postal")).toHaveValue("75002");
    expect(screen.getByRole("button", { name: "Enregistrer mes informations" })).toBeEnabled();
    const bouton = screen.getByRole("button", { name: "Enregistrer mes informations" });
    expect(alerte.compareDocumentPosition(bouton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("R35 — sans erreur, aucun message d'erreur n'est affiché", () => {
    setup();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });
});
