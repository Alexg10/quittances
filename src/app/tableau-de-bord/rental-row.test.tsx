import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RentalList } from "./rental-list";
import { RentalRow, type RentalRowData } from "./rental-row";

// Les montants contiennent des espaces fines ou insécables (R16) : les critères
// les comparent après remplacement de toute espace par une espace ordinaire.
const plain = (text: string | null) => (text ?? "").replace(/\s/g, " ");

const BASE: RentalRowData = {
  id: "7f3b2c1a-1111-4222-8333-444455556666",
  address: "12 rue des Lilas",
  addressComplement: null,
  postalCode: "69003",
  city: "Lyon",
  tenantName: "Marie Durand",
  dueDay: 5,
  rentInCents: 85000,
  chargesInCents: 5050,
  endDate: null,
};

function renderRow(overrides: Partial<RentalRowData>, status: "ongoing" | "ended" = "ongoing") {
  render(
    <ul>
      <RentalRow rental={{ ...BASE, ...overrides }} status={status} />
    </ul>,
  );
  return screen.getByRole("listitem");
}

describe("RentalRow — contenu (R36)", () => {
  it("CA17 — le lien porte l'adresse et mène à /locations/<id>", () => {
    renderRow({});

    expect(
      screen.getByRole("link", { name: "12 rue des Lilas" }),
    ).toHaveAttribute("href", `/locations/${BASE.id}`);
  });

  it("R36 — l'adresse est suivie d'une virgule et du complément quand il existe", () => {
    renderRow({ addressComplement: "Bâtiment B, 2e étage" });

    expect(
      screen.getByRole("link", { name: "12 rue des Lilas, Bâtiment B, 2e étage" }),
    ).toBeInTheDocument();
  });

  it("R36 — sans complément : ni virgule ni texte superflu dans le lien", () => {
    renderRow({});

    expect(screen.getByRole("link")).toHaveAccessibleName("12 rue des Lilas");
  });

  it("R36 — l'adresse est le seul lien de la ligne", () => {
    renderRow({});

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("R36 — affiche le code postal et la ville, le nom du locataire", () => {
    renderRow({});

    expect(screen.getByText("69003 Lyon")).toBeInTheDocument();
    expect(screen.getByText("Marie Durand")).toBeInTheDocument();
  });

  it("R36 — affiche « Échéance le N du mois »", () => {
    renderRow({ dueDay: 31 });

    expect(screen.getByText("Échéance le 31 du mois")).toBeInTheDocument();
  });

  it("CA17, R16 — le total charges comprises (850,00 + 50,50) s'affiche « 900,50 € charges comprises »", () => {
    const item = renderRow({});

    expect(plain(item.textContent)).toContain("900,50 € charges comprises");
  });

  it("R16 — le total est un total : 650 € + 50 € = 700,00 €", () => {
    const item = renderRow({ rentInCents: 65000, chargesInCents: 5000 });

    expect(plain(item.textContent)).toContain("700,00 € charges comprises");
  });

  it("R16 — des charges à zéro donnent le loyer seul, avec deux décimales", () => {
    const item = renderRow({ rentInCents: 85000, chargesInCents: 0 });

    expect(plain(item.textContent)).toContain("850,00 € charges comprises");
  });

  it("R16 — groupement des milliers : 1 250,50 €", () => {
    const item = renderRow({ rentInCents: 120000, chargesInCents: 5050 });

    expect(plain(item.textContent)).toContain("1 250,50 € charges comprises");
  });

  it("R16 — total maximal : 199 999,98 €", () => {
    const item = renderRow({ rentInCents: 9999999, chargesInCents: 9999999 });

    expect(plain(item.textContent)).toContain("199 999,98 € charges comprises");
  });

  it("R16 — l'espace fine insécable (U+202F) groupe les milliers, l'espace insécable (U+00A0) précède €", () => {
    const item = renderRow({ rentInCents: 120000, chargesInCents: 5050 });

    expect(item.textContent).toContain("1 250,50 €");
  });

  it("R36 — l'ordre des éléments : adresse, ville, locataire, échéance, montant, statut", () => {
    const item = renderRow({});
    const text = plain(item.textContent);

    const positions = [
      "12 rue des Lilas",
      "69003 Lyon",
      "Marie Durand",
      "Échéance le 5 du mois",
      "900,50 € charges comprises",
      "En cours",
    ].map((part) => text.indexOf(part));

    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe("RentalRow — statut et fin (R36, R39, R19)", () => {
  it("CA17 — en cours sans date de fin : chip « En cours », aucune mention de fin", () => {
    const item = renderRow({});

    expect(within(item).getByText("En cours")).toBeInTheDocument();
    expect(item).not.toHaveTextContent("Fin prévue");
    expect(item).not.toHaveTextContent("Terminée");
  });

  it("CA17, R19 — en cours avec date de fin : « Fin prévue le 15/03/2027 »", () => {
    const item = renderRow({ endDate: "2027-03-15" });

    expect(within(item).getByText("En cours")).toBeInTheDocument();
    expect(plain(item.textContent)).toContain("Fin prévue le 15/03/2027");
    expect(item).not.toHaveTextContent("Terminée le");
  });

  it("CA18, R19 — terminée : chip « Terminée » et « Terminée le 30/06/2026 »", () => {
    const item = renderRow({ endDate: "2026-06-30" }, "ended");

    expect(plain(item.textContent)).toContain("Terminée le 30/06/2026");
    expect(within(item).getAllByText(/Terminée/)).toHaveLength(2);
    expect(item).not.toHaveTextContent("En cours");
    expect(item).not.toHaveTextContent("Fin prévue");
  });

  it("R19 — la date ne subit aucune conversion de fuseau : 2026-01-01 donne 01/01/2026", () => {
    const item = renderRow({ endDate: "2026-01-01" }, "ended");

    expect(plain(item.textContent)).toContain("Terminée le 01/01/2026");
  });
});

describe("RentalRow — données du locataire (R36, R43)", () => {
  it("CA17 — l'adresse e-mail du locataire n'apparaît nulle part, même si la donnée la porte", () => {
    // Le type de la ligne ne la prévoit pas ; on force l'objet complet de la
    // base pour prouver que le composant ne l'écrit jamais.
    const complete = { ...BASE, tenantEmail: "marie.durand@quittances.test" };
    const { container } = render(
      <ul>
        <RentalRow rental={complete} status="ongoing" />
      </ul>,
    );

    expect(container.innerHTML).not.toContain("marie.durand@quittances.test");
    expect(container.innerHTML).not.toContain("@");
  });

  it("R11 — une valeur contenant du HTML est affichée comme du texte", () => {
    const item = renderRow({ tenantName: "<b>Marie</b> & Paul" });

    expect(item).toHaveTextContent("<b>Marie</b> & Paul");
    expect(item.querySelector("b")).toBeNull();
  });
});

describe("RentalList (R35)", () => {
  const rentals: RentalRowData[] = [
    { ...BASE, id: "11111111-1111-4111-8111-111111111111", address: "1 rue A" },
    { ...BASE, id: "22222222-2222-4222-8222-222222222222", address: "2 rue B" },
    { ...BASE, id: "33333333-3333-4333-8333-333333333333", address: "3 rue C" },
  ];

  it("R35 — est une liste sémantique avec un élément par location", () => {
    render(<RentalList rentals={rentals} status="ongoing" />);

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("CA17 — conserve l'ordre reçu", () => {
    render(<RentalList rentals={rentals} status="ongoing" />);

    const liens = screen.getAllByRole("link").map((l) => l.textContent);
    expect(liens).toEqual(["1 rue A", "2 rue B", "3 rue C"]);
  });

  it("CA17 — chaque ligne mène au détail de sa propre location", () => {
    render(<RentalList rentals={rentals} status="ongoing" />);

    expect(screen.getByRole("link", { name: "2 rue B" })).toHaveAttribute(
      "href",
      "/locations/22222222-2222-4222-8222-222222222222",
    );
  });

  it("CA18 — le statut du groupe se retrouve dans chaque ligne", () => {
    render(
      <RentalList
        rentals={rentals.map((r) => ({ ...r, endDate: "2026-06-30" }))}
        status="ended"
      />,
    );

    const items = screen.getAllByRole("listitem");
    for (const item of items) {
      expect(within(item).getByText("Terminée")).toBeInTheDocument();
    }
  });
});
