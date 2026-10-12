import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArchivedRentalList, type ArchivedRentalRowData } from "./archived-rental-list";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ID_A = "3f9a1c2e-7b4d-4e8a-9c1f-0a2b3c4d5e6f";
const ID_B = "a1b2c3d4-1111-4222-8333-444455556666";
const ID_C = "b2c3d4e5-2222-4333-8444-555566667777";

const SANS: ArchivedRentalRowData = {
  id: ID_A,
  address: "12 rue des Lilas",
  addressComplement: "Bât. B",
  postalCode: "69003",
  city: "Lyon",
  tenantName: "Paul Martin",
  archivedAt: new Date("2026-09-15T12:00:00Z"),
  receiptCount: 2,
};
const UNE: ArchivedRentalRowData = {
  ...SANS,
  id: ID_B,
  address: "5 avenue Foch",
  addressComplement: null,
  postalCode: "75016",
  city: "Paris",
  tenantName: "Léa Bernard",
  archivedAt: new Date("2026-09-10T12:00:00Z"),
  receiptCount: 1,
};
const AUCUNE: ArchivedRentalRowData = {
  ...SANS,
  id: ID_C,
  address: "8 rue Neuve",
  addressComplement: null,
  postalCode: "33000",
  city: "Bordeaux",
  tenantName: "Jo Petit",
  archivedAt: new Date("2026-09-01T12:00:00Z"),
  receiptCount: 0,
};

const normaliser = (texte: string | null) => (texte ?? "").replace(/\s+/g, " ").trim();

describe("ArchivedRentalList — R41, CA49, CA54", () => {
  it("CA54 — une liste sémantique avec une ligne par location", () => {
    render(<ArchivedRentalList rentals={[SANS, UNE, AUCUNE]} />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("CA54 — l'ordre reçu est conservé (15/09, 10/09, 01/09)", () => {
    render(<ArchivedRentalList rentals={[SANS, UNE, AUCUNE]} />);

    const dates = screen.getAllByRole("listitem").map((l) => normaliser(l.textContent).match(/Archivée le (\d{2}\/\d{2}\/\d{4})/)![1]);
    expect(dates).toEqual(["15/09/2026", "10/09/2026", "01/09/2026"]);
  });

  it("R41 — l'adresse, suivie d'une virgule et du complément, est un lien vers le détail", () => {
    render(<ArchivedRentalList rentals={[SANS]} />);

    const lien = screen.getByRole("link", { name: "12 rue des Lilas, Bât. B" });
    expect(lien).toHaveAttribute("href", `/locations/${ID_A}`);
  });

  it("R41 — sans complément, l'adresse seule, sans virgule", () => {
    render(<ArchivedRentalList rentals={[UNE]} />);

    expect(screen.getByRole("link", { name: "5 avenue Foch" })).toHaveAttribute("href", `/locations/${ID_B}`);
  });

  it("R41 — l'adresse est le seul lien de la ligne", () => {
    render(<ArchivedRentalList rentals={[SANS, UNE]} />);

    for (const ligne of screen.getAllByRole("listitem")) {
      expect(within(ligne).getAllByRole("link")).toHaveLength(1);
    }
  });

  it("R41 — la ligne : adresse, code postal et ville, locataire, date, nombre de quittances, dans cet ordre", () => {
    render(<ArchivedRentalList rentals={[SANS]} />);

    const ligne = screen.getByRole("listitem");
    const blocs = [
      ...within(ligne).getAllByRole("link"),
      ...Array.from(ligne.querySelectorAll("p")),
    ].map((e) => normaliser(e.textContent));
    expect(blocs).toEqual([
      "12 rue des Lilas, Bât. B",
      "69003 Lyon",
      "Paul Martin",
      "Archivée le 15/09/2026",
      "2 quittances",
    ]);
  });

  it.each([
    [AUCUNE, "Aucune quittance"],
    [UNE, "1 quittance"],
    [SANS, "2 quittances"],
  ])("CA54 — nombre de quittances de %#", (location, attendu) => {
    render(<ArchivedRentalList rentals={[location]} />);

    expect(screen.getByRole("listitem")).toHaveTextContent(new RegExp(`${attendu}$`));
  });

  it("R40 — la date est le jour à Paris : 31/10 à 23:30 UTC s'affiche au 01/11/2026", () => {
    render(<ArchivedRentalList rentals={[{ ...SANS, archivedAt: new Date("2026-10-31T23:30:00Z") }]} />);

    expect(screen.getByRole("listitem")).toHaveTextContent("Archivée le 01/11/2026");
  });

  it("R37 — l'adresse e-mail du locataire n'apparaît jamais, même si l'objet reçu la contient", () => {
    const avecEmail = { ...SANS, tenantEmail: "paul.martin@exemple.test" } as ArchivedRentalRowData;
    const { container } = render(<ArchivedRentalList rentals={[avecEmail]} />);

    expect(container.innerHTML).not.toContain("paul.martin@exemple.test");
    expect(container.innerHTML).not.toContain("@");
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
    for (const lien of screen.getAllByRole("link")) {
      expect(lien.getAttribute("href")).not.toMatch(/^mailto:/);
    }
  });

  it("R41 — aucun montant, aucun symbole d'euro", () => {
    const avecMontants = { ...SANS, rentInCents: 65000, chargesInCents: 5000 } as ArchivedRentalRowData;
    render(<ArchivedRentalList rentals={[avecMontants]} />);

    expect(screen.getByRole("listitem").textContent).not.toMatch(/€|\d,\d\d/);
  });

  it("R41 — les valeurs sont rendues comme du texte, jamais comme du HTML", () => {
    render(<ArchivedRentalList rentals={[{ ...SANS, tenantName: "<b>Gras</b>" }]} />);

    expect(screen.getByText("<b>Gras</b>")).toBeInTheDocument();
  });

  it("une liste vide ne rend aucune ligne (l'état vide est posé par la page)", () => {
    render(<ArchivedRentalList rentals={[]} />);

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText("Aucune location archivée.")).not.toBeInTheDocument();
  });
});
