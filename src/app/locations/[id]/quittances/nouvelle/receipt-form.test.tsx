import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ReceiptFormState } from "@/receipts/receipt-form-state";

import { ReceiptForm } from "./receipt-form";

// Seule frontière simulée : la Server Action, passée en prop. Le formulaire, ses
// champs, la liste, la case et le bouton sont réels.
type Action = (state: ReceiptFormState, formData: FormData) => Promise<ReceiptFormState>;

const E8 = "Le service est momentanément indisponible. Réessayez dans quelques instants.";
const LIBELLE_CASE =
  "Je confirme avoir reçu en totalité le loyer et les charges indiqués ci-dessus pour ce mois.";

// Les mois de CA23 : bail du 15/01 au 20/03/2026, le plus récent d'abord.
const MONTHS = [
  { value: "2026-03", label: "Mars 2026 (du 01/03/2026 au 20/03/2026)" },
  { value: "2026-02", label: "Février 2026" },
  { value: "2026-01", label: "Janvier 2026 (du 15/01/2026 au 31/01/2026)" },
];

// L'état de départ de la page : mois le plus récent, montants de la location
// (850,00 et 50,00), date vide, case non cochée.
const INITIAL: ReceiptFormState = {
  fields: { month: "2026-03", rent: "850,00", charges: "50,00", paymentDate: "", attestation: "" },
  errors: {},
};

function setup(
  action: Action = vi.fn<Action>(async () => INITIAL),
  initialState: ReceiptFormState = INITIAL,
) {
  const view = render(
    <ReceiptForm
      action={action}
      initialState={initialState}
      months={MONTHS}
      cancelHref="/locations/7f3b2c1a-1111-4222-8333-444455556666"
    />,
  );
  return { ...view, action, form: view.container.querySelector("form")! };
}

const mois = () => screen.getByRole("combobox", { name: "Mois" });
const loyer = () => screen.getByRole("textbox", { name: "Loyer hors charges" });
const charges = () => screen.getByRole("textbox", { name: "Charges" });
const date = () => screen.getByLabelText("Date du paiement");
const attestation = () => screen.getByRole("checkbox", { name: LIBELLE_CASE });
const bouton = () => screen.getByRole("button", { name: "Produire la quittance" });

// Clique sur le bouton, puis laisse la réponse (simulée) arriver et s'afficher.
async function envoyer() {
  await userEvent.click(bouton());
  await act(async () => {});
}

describe("ReceiptForm — contenu et structure (R12, R14, R35, CA23)", () => {
  it("CA23 — la liste des mois propose exactement ces options, dans cet ordre", () => {
    setup();

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Mars 2026 (du 01/03/2026 au 20/03/2026)",
      "Février 2026",
      "Janvier 2026 (du 15/01/2026 au 31/01/2026)",
    ]);
  });

  it("CA23 — le mois le plus récent est sélectionné", () => {
    setup();

    expect(mois()).toHaveValue("2026-03");
  });

  it("CA23 — les montants contiennent ceux de la location (850,00 et 50,00)", () => {
    setup();

    expect(loyer()).toHaveValue("850,00");
    expect(charges()).toHaveValue("50,00");
  });

  it("CA23 — la date est vide, la case décochée, aucun champ focalisé", () => {
    setup();

    expect(date()).toHaveValue("");
    expect(attestation()).not.toBeChecked();
    expect(document.body).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("R35 — noms des champs : month, rent, charges, paymentDate, attestation", () => {
    setup();

    expect(mois()).toHaveAttribute("name", "month");
    expect(loyer()).toHaveAttribute("name", "rent");
    expect(charges()).toHaveAttribute("name", "charges");
    expect(date()).toHaveAttribute("name", "paymentDate");
    expect(attestation()).toHaveAttribute("name", "attestation");
  });

  it("R12, R35 — les montants sont des champs de texte à clavier décimal, jamais de type number", () => {
    setup();

    for (const champ of [loyer(), charges()]) {
      expect(champ).toHaveAttribute("type", "text");
      expect(champ).toHaveAttribute("inputmode", "decimal");
    }
    expect(document.querySelector('input[type="number"]')).toBeNull();
  });

  it("R35 — la date est un champ de date", () => {
    setup();

    expect(date()).toHaveAttribute("type", "date");
  });

  it("R35 — tous les champs portent autocomplete=\"off\"", () => {
    setup();

    for (const champ of [mois(), loyer(), charges(), date()]) {
      expect(champ).toHaveAttribute("autocomplete", "off");
    }
  });

  it("R35 — les cinq champs sont obligatoires", () => {
    setup();

    for (const champ of [mois(), loyer(), charges(), date(), attestation()]) {
      expect(champ).toBeRequired();
    }
  });

  it("R35 — pas de placeholder", () => {
    setup();

    for (const champ of [loyer(), charges(), date()]) {
      expect(champ).not.toHaveAttribute("placeholder");
    }
  });

  it("R35 — pas de bulle native : le formulaire est noValidate", () => {
    const { form } = setup();

    expect(form).toHaveAttribute("novalidate");
  });

  it("CA23 — le mois n'a pas de texte d'aide", () => {
    setup();

    expect(mois()).not.toHaveAccessibleDescription();
  });

  it("CA23 — textes d'aide du loyer, des charges, de la date et de la case", () => {
    setup();

    expect(loyer()).toHaveAccessibleDescription(
      "Montant reçu pour ce mois, en euros. Modifiez-le si le mois est incomplet ou si le loyer a changé.",
    );
    expect(charges()).toHaveAccessibleDescription(
      "Montant reçu pour ce mois, en euros. Saisissez 0 s'il n'y a pas de charges.",
    );
    expect(date()).toHaveAccessibleDescription("Jour où vous avez reçu le paiement.");
    expect(attestation()).toHaveAccessibleDescription(
      "Une quittance atteste un paiement complet. Si le paiement est partiel, ne produisez pas de quittance.",
    );
  });

  it("R14 — la case porte le libellé exact de la spécification, relié à elle", () => {
    setup();

    expect(screen.getByLabelText(LIBELLE_CASE)).toBe(attestation());
  });

  it("CA23 — le bouton d'envoi est un submit « Produire la quittance »", () => {
    const { form } = setup();

    expect(bouton()).toHaveAttribute("type", "submit");
    expect(bouton()).toBeEnabled();
    expect(bouton().closest("form")).toBe(form);
  });

  it("CA23 — le lien « Annuler » mène au détail de la location", () => {
    setup();

    expect(screen.getByRole("link", { name: "Annuler" })).toHaveAttribute(
      "href",
      "/locations/7f3b2c1a-1111-4222-8333-444455556666",
    );
  });

  it("R6, R26 — aucun champ caché : ni identifiant, ni nom, ni montant figé", () => {
    const { form } = setup();

    expect(form.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
    expect(form.querySelectorAll("input, select, textarea")).toHaveLength(5);
  });

  it("R35 — ordre de tabulation : mois, loyer, charges, date, case, bouton d'envoi, Annuler", async () => {
    setup();
    const attendu = [mois(), loyer(), charges(), date(), attestation(), bouton(), screen.getByRole("link", { name: "Annuler" })];

    const rencontres: Element[] = [];
    for (let i = 0; i < attendu.length; i += 1) {
      await userEvent.tab();
      rencontres.push(document.activeElement!);
    }

    expect(rencontres).toEqual(attendu);
  });

  it("R35 — la sélection par nom accessible « Mois » ne trouve que la liste (pas de collision avec la case)", () => {
    setup();

    // Le libellé de la case se termine par « pour ce mois. » : une recherche
    // exacte par rôle ne doit trouver qu'un seul élément pour chaque nom.
    expect(screen.getAllByRole("combobox", { name: "Mois" })).toHaveLength(1);
    expect(screen.getAllByRole("textbox", { name: "Charges" })).toHaveLength(1);
    expect(screen.getAllByLabelText("Mois")).toHaveLength(1);
    expect(screen.getAllByLabelText("Charges")).toHaveLength(1);
  });
});

describe("ReceiptForm — envoi (R35, CA24)", () => {
  it("CA24 — envoie le mois choisi, les montants saisis, la date et « on » pour la case cochée", async () => {
    const { action } = setup();
    await userEvent.selectOptions(mois(), "2026-01");
    await userEvent.clear(loyer());
    await userEvent.type(loyer(), "425,5");
    await userEvent.clear(charges());
    await userEvent.type(charges(), "0");
    await userEvent.type(date(), "2026-01-20");
    await userEvent.click(attestation());

    await envoyer();

    expect(action).toHaveBeenCalledTimes(1);
    const donnees = vi.mocked(action).mock.calls[0][1];
    expect(Object.fromEntries(donnees.entries())).toEqual({
      month: "2026-01",
      rent: "425,5",
      charges: "0",
      paymentDate: "2026-01-20",
      attestation: "on",
    });
  });

  it("R14 — case décochée : l'attestation n'est pas envoyée du tout", async () => {
    const { action } = setup();

    await envoyer();

    const donnees = vi.mocked(action).mock.calls[0][1];
    expect(donnees.has("attestation")).toBe(false);
  });

  it("R35 — formulaire incomplet : l'envoi part quand même (le serveur valide)", async () => {
    const { action } = setup();

    await envoyer();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("R35 — en attente : « Production en cours », bouton indisponible, puis rétabli", async () => {
    let terminer: (etat: ReceiptFormState) => void = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (terminer = resolve)));
    setup(action);

    await userEvent.click(bouton());

    const attente = await screen.findByRole("button", { name: "Production en cours" });
    expect(attente).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Produire la quittance" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Production en cours");

    // Un second clic pendant l'attente n'envoie pas une seconde demande (CA26).
    await userEvent.click(attente);
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => terminer(INITIAL));
    expect(await screen.findByRole("button", { name: "Produire la quittance" })).toBeEnabled();
  });
});

describe("ReceiptForm — erreurs sous leur champ (Q1 à Q6, L12 à L16, L20, L21 ; CA25)", () => {
  const cible = {
    month: () => mois(),
    rent: () => loyer(),
    charges: () => charges(),
    paymentDate: () => date(),
    attestation: () => attestation(),
  } as const;

  it.each([
    ["Q1", "month", "Choisissez un mois."],
    ["Q2", "month", "Ce mois ne peut pas faire l'objet d'une quittance pour cette location."],
    ["Q3", "month", "Une quittance existe déjà pour ce mois. Supprimez-la depuis la page de la location pour en produire une nouvelle."],
    ["L12", "rent", "Saisissez le loyer hors charges."],
    ["L13", "rent", "Saisissez un montant en euros, par exemple 850 ou 850,50."],
    ["L14", "rent", "Le loyer hors charges doit être supérieur à zéro."],
    ["L15", "rent", "Le montant ne peut pas dépasser 99 999,99 euros."],
    ["L13", "charges", "Saisissez un montant en euros, par exemple 850 ou 850,50."],
    ["L15", "charges", "Le montant ne peut pas dépasser 99 999,99 euros."],
    ["L16", "charges", "Saisissez le montant des charges, ou 0 s'il n'y en a pas."],
    ["Q4", "paymentDate", "Saisissez la date du paiement."],
    ["L20", "paymentDate", "Saisissez une date valide."],
    ["L21", "paymentDate", "La date doit être comprise entre le 1er janvier 1950 et le 31 décembre 2099."],
    ["Q5", "paymentDate", "La date du paiement ne peut pas être dans le futur."],
    ["Q6", "attestation", "Cochez la case pour confirmer que le loyer et les charges ont été reçus en totalité."],
  ] as const)("%s — sous le champ « %s » : %s", async (code, nom, message) => {
    const action = vi.fn<Action>(async () => ({
      fields: { ...INITIAL.fields },
      errors: { [nom]: code },
    }));
    setup(action);

    await envoyer();

    const champ = cible[nom]();
    expect(champ).toHaveAttribute("aria-invalid", "true");
    expect(champ).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(champ).toHaveFocus();
    // Aucun autre champ n'est marqué en erreur.
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(1);
  });

  it("R35 — sous un champ à texte d'aide, l'erreur est annoncée avant l'aide", async () => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { ...INITIAL.fields },
        errors: { rent: "L13" },
      })),
    );

    await envoyer();

    expect(loyer()).toHaveAccessibleDescription(
      "Saisissez un montant en euros, par exemple 850 ou 850,50. Montant reçu pour ce mois, en euros. Modifiez-le si le mois est incomplet ou si le loyer a changé.",
    );
  });

  it("CA25 — L13, L16, Q5 et Q6 ensemble : sous leurs champs, focus sur « Loyer hors charges », valeurs conservées, case décochée", async () => {
    const action = vi.fn<Action>(async () => ({
      fields: { month: "2026-02", rent: "850,555", charges: "", paymentDate: "2099-12-31", attestation: "" },
      errors: { rent: "L13", charges: "L16", paymentDate: "Q5", attestation: "Q6" },
    }));
    setup(action);
    await userEvent.selectOptions(mois(), "2026-02");

    await envoyer();

    expect(screen.getByText("Saisissez un montant en euros, par exemple 850 ou 850,50.")).toBeInTheDocument();
    expect(screen.getByText("Saisissez le montant des charges, ou 0 s'il n'y en a pas.")).toBeInTheDocument();
    expect(screen.getByText("La date du paiement ne peut pas être dans le futur.")).toBeInTheDocument();
    expect(screen.getByText("Cochez la case pour confirmer que le loyer et les charges ont été reçus en totalité.")).toBeInTheDocument();
    expect(loyer()).toHaveFocus();
    expect(mois()).toHaveValue("2026-02");
    expect(loyer()).toHaveValue("850,555");
    expect(charges()).toHaveValue("");
    expect(date()).toHaveValue("2099-12-31");
    expect(attestation()).not.toBeChecked();
    expect(mois()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("R35 — le focus va au premier champ en erreur dans l'ordre du document (la date avant la case)", async () => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { ...INITIAL.fields },
        errors: { paymentDate: "Q4", attestation: "Q6" },
      })),
    );

    await envoyer();

    expect(date()).toHaveFocus();
  });

  it("R14, R35 — la case cochée par l'utilisateur revient décochée après une erreur", async () => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { ...INITIAL.fields, paymentDate: "2099-12-31" },
        errors: { paymentDate: "Q5" },
      })),
    );
    await userEvent.click(attestation());
    expect(attestation()).toBeChecked();

    await envoyer();

    expect(attestation()).not.toBeChecked();
  });

  it("R14 — même si le serveur renvoyait une attestation « on », la case reste décochée", async () => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { ...INITIAL.fields, attestation: "on", paymentDate: "2099-12-31" },
        errors: { paymentDate: "Q5" },
      })),
    );

    await envoyer();

    expect(attestation()).not.toBeChecked();
  });

  it("R35 — le mois choisi reste sélectionné après une erreur sur un autre champ", async () => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { ...INITIAL.fields, month: "2026-01" },
        errors: { charges: "L16" },
      })),
    );
    await userEvent.selectOptions(mois(), "2026-01");

    await envoyer();

    expect(mois()).toHaveValue("2026-01");
  });

  it("R35 — un mois que la liste ne propose plus : le navigateur retombe sur la première option", async () => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { ...INITIAL.fields, month: "2025-12" },
        errors: { month: "Q2" },
      })),
    );

    await envoyer();

    expect(mois()).toHaveValue("2026-03");
  });

  it("R35 — une date de paiement inexistante (2026-02-30) laisse le champ vide mais garde le message L20", async () => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { ...INITIAL.fields, paymentDate: "2026-02-30" },
        errors: { paymentDate: "L20" },
      })),
    );

    await envoyer();

    expect(date()).toHaveValue("");
    expect(screen.getByText("Saisissez une date valide.")).toBeInTheDocument();
  });

  it("R12 — les montants saisis sont réaffichés tels quels après une erreur", async () => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { ...INITIAL.fields, rent: " 1 250,5 ", charges: "abc" },
        errors: { charges: "L13" },
      })),
    );

    await envoyer();

    expect(loyer()).toHaveValue(" 1 250,5 ");
    expect(charges()).toHaveValue("abc");
  });
});

describe("ReceiptForm — messages de formulaire (Q7, Q8, Q9, E8 ; CA28)", () => {
  it.each([
    ["Q7", "Renseignez vos informations de bailleur avant de produire une quittance."],
    ["Q8", "Le nom du locataire ou l'adresse du logement contient des caractères que la quittance ne peut pas afficher. Modifiez la location puis réessayez."],
    ["Q9", "Vos informations de bailleur contiennent des caractères que la quittance ne peut pas afficher. Modifiez-les puis réessayez."],
    ["E8", E8],
  ])("%s — alerte avec le focus, au-dessus du bouton, valeurs conservées, case décochée", async (_code, message) => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { month: "2026-02", rent: "425,5", charges: "0", paymentDate: "2026-01-20", attestation: "" },
        errors: {},
        formError: message,
      })),
    );
    await userEvent.click(attestation());

    await envoyer();

    const alerte = screen.getByRole("alert");
    expect(alerte).toHaveTextContent(message);
    expect(alerte).toHaveFocus();
    expect(alerte.compareDocumentPosition(bouton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mois()).toHaveValue("2026-02");
    expect(loyer()).toHaveValue("425,5");
    expect(charges()).toHaveValue("0");
    expect(date()).toHaveValue("2026-01-20");
    expect(attestation()).not.toBeChecked();
    expect(bouton()).toBeEnabled();
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });

  it("R35 — le message de formulaire prend le focus avant un champ en erreur", async () => {
    setup(
      vi.fn<Action>(async () => ({
        fields: { ...INITIAL.fields },
        errors: { rent: "L13" },
        formError: E8,
      })),
    );

    await envoyer();

    expect(screen.getByRole("alert")).toHaveFocus();
  });
});
