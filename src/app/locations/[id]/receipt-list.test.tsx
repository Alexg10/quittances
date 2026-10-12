import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Receipt } from "@/receipts/receipt-store";

import { ReceiptList } from "./receipt-list";

// Doublure de `next/link` : rend un <a> marqué, pour distinguer un lien de page
// (Link, préchargé par Next) d'un <a> natif. Le préchargement lui-même ne se voit
// pas dans jsdom : seule la QA peut observer les requêtes dans le navigateur.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} data-next-link="" {...rest}>
      {children}
    </a>
  ),
}));

const ID_JANVIER = "3f9a1c2e-7b4d-4e8a-9c1f-0a2b3c4d5e6f";
const ID_MARS = "a1b2c3d4-1111-4222-8333-444455556666";

// Quittance de CA24 : janvier, période incomplète, 425,50 € de loyer, 0 de charges.
const JANVIER: Receipt = {
  id: ID_JANVIER,
  rentalId: "7f3b2c1a-1111-4222-8333-444455556666",
  month: "2026-01",
  periodStart: "2026-01-15",
  periodEnd: "2026-01-31",
  landlordName: "Marie Durand",
  landlordAddress: "3 rue de la Paix",
  landlordAddressComplement: null,
  landlordPostalCode: "75002",
  landlordCity: "Paris",
  tenantName: "Paul Martin",
  rentalAddress: "12 rue des Lilas",
  rentalAddressComplement: "Bât. B",
  rentalPostalCode: "69003",
  rentalCity: "Lyon",
  rentInCents: 42550,
  chargesInCents: 0,
  paymentDate: "2026-01-20",
  issueDate: "2026-10-12",
  producedAt: new Date("2026-10-12T10:00:00Z"),
};

// Mars : 850,00 € de loyer et 50,00 € de charges, soit 900,00 €.
const MARS: Receipt = {
  ...JANVIER,
  id: ID_MARS,
  month: "2026-03",
  periodStart: "2026-03-01",
  periodEnd: "2026-03-20",
  rentInCents: 85000,
  chargesInCents: 5000,
  paymentDate: "2026-03-05",
};

// Ramène toute espace (insécable, fine insécable comprise) à une espace ordinaire.
const normaliser = (texte: string | null) => (texte ?? "").replace(/\s/g, " ");

function setup(receipts: Receipt[]) {
  return render(<ReceiptList receipts={receipts} />);
}

const ligne = (index: number) => screen.getAllByRole("listitem")[index];

describe("ReceiptList — lignes (CA24, R16, R36)", () => {
  it("CA24 — une liste sémantique avec une ligne par quittance", () => {
    setup([MARS, JANVIER]);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("CA24 — les lignes suivent l'ordre reçu (mois le plus récent d'abord)", () => {
    setup([MARS, JANVIER]);

    expect(ligne(0)).toHaveTextContent("Mars 2026");
    expect(ligne(1)).toHaveTextContent("Janvier 2026");
  });

  it("CA24 — la ligne de janvier : mois, période, total, paiement, référence, dans cet ordre", () => {
    setup([JANVIER]);

    expect(normaliser(ligne(0).textContent)).toMatch(
      /Janvier 2026.*Du 15\/01\/2026 au 31\/01\/2026.*425,50 € charges comprises.*Payé le 20\/01\/2026.*Référence 2026-01-3F9A1C2E.*Télécharger.*Supprimer/,
    );
  });

  it("CA24 — le mois s'écrit en forme de titre (« Janvier 2026 »)", () => {
    setup([JANVIER]);

    expect(within(ligne(0)).getByText("Janvier 2026")).toBeInTheDocument();
  });

  it("CA24 — la période est « Du 15/01/2026 au 31/01/2026 »", () => {
    setup([JANVIER]);

    expect(normaliser(ligne(0).textContent)).toContain("Du 15/01/2026 au 31/01/2026");
  });

  it("R6 — le total est la somme du loyer et des charges : 850,00 + 50,00 = 900,00 € charges comprises", () => {
    setup([MARS]);

    expect(normaliser(ligne(0).textContent)).toContain("900,00 € charges comprises");
  });

  it("R16 — un montant de plus de mille euros garde ses espaces de milliers : 1 250,50 €", () => {
    setup([{ ...JANVIER, rentInCents: 100000, chargesInCents: 25050 }]);

    expect(normaliser(ligne(0).textContent)).toContain("1 250,50 € charges comprises");
  });

  it("R12 — des charges à zéro : le total est celui du loyer", () => {
    setup([JANVIER]);

    expect(normaliser(ligne(0).textContent)).toContain("425,50 € charges comprises");
  });

  it("CA24 — la date du paiement : « Payé le 20/01/2026 »", () => {
    setup([JANVIER]);

    expect(normaliser(ligne(0).textContent)).toContain("Payé le 20/01/2026");
  });

  it("R16 — la référence : mois, tiret, huit premiers caractères de l'identifiant en majuscules", () => {
    setup([JANVIER, MARS]);

    expect(normaliser(ligne(0).textContent)).toContain("Référence 2026-01-3F9A1C2E");
    expect(normaliser(ligne(1).textContent)).toContain("Référence 2026-03-A1B2C3D4");
  });

  it("CA24 — le montant ne se coupe jamais (white-space: nowrap sur son élément)", () => {
    setup([MARS]);

    const montant = within(ligne(0)).getByText(/900,00/);
    expect(montant.className).toContain("whitespace-nowrap");
  });
});

describe("ReceiptList — données personnelles (R37)", () => {
  it("R37 — la ligne n'affiche ni nom, ni adresse du locataire, du logement ou du bailleur", () => {
    setup([JANVIER]);

    const texte = normaliser(ligne(0).textContent);
    for (const interdit of ["Paul Martin", "Marie Durand", "rue des Lilas", "rue de la Paix", "Lyon", "Paris", "@"]) {
      expect(texte).not.toContain(interdit);
    }
  });

  it("R37 — l'identifiant complet de la quittance n'est affiché nulle part (seule la référence l'est)", () => {
    setup([JANVIER]);

    expect(normaliser(ligne(0).textContent)).not.toContain(ID_JANVIER);
  });
});

describe("ReceiptList — liens (R34, R36, CA24, CA33)", () => {
  it("CA24 — le lien Télécharger a le nom accessible de « Contenus » et mène à /quittances/<q>/pdf", () => {
    setup([JANVIER]);

    const lien = screen.getByRole("link", { name: "Télécharger la quittance, janvier 2026" });
    expect(lien).toHaveAttribute("href", `/quittances/${ID_JANVIER}/pdf`);
    expect(lien).toHaveTextContent("Télécharger");
  });

  it("CA24 — le lien Supprimer a le nom accessible de « Contenus » et mène à /quittances/<q>/supprimer", () => {
    setup([JANVIER]);

    const lien = screen.getByRole("link", { name: "Supprimer la quittance, janvier 2026" });
    expect(lien).toHaveAttribute("href", `/quittances/${ID_JANVIER}/supprimer`);
    expect(lien).toHaveTextContent("Supprimer");
  });

  it("CA33, R34 — le lien Télécharger n'a pas d'attribut download", () => {
    setup([JANVIER, MARS]);

    for (const lien of screen.getAllByRole("link", { name: /^Télécharger/ })) {
      expect(lien).not.toHaveAttribute("download");
    }
  });

  it("R34 — le lien Télécharger est un <a> natif, et non un Link de Next (qui le précharge)", () => {
    setup([JANVIER]);

    const lien = screen.getByRole("link", { name: /^Télécharger/ });
    expect(lien.tagName).toBe("A");
    expect(lien).not.toHaveAttribute("data-next-link");
  });

  it("R34 — le lien Supprimer, qui mène à une page, reste un Link", () => {
    setup([JANVIER]);

    expect(screen.getByRole("link", { name: /^Supprimer/ })).toHaveAttribute("data-next-link");
  });

  it("R36 — deux lignes : les noms accessibles des liens de même texte sont distincts", () => {
    setup([MARS, JANVIER]);

    const noms = screen.getAllByRole("link").map((l) => l.getAttribute("aria-label"));
    expect(noms).toEqual([
      "Télécharger la quittance, mars 2026",
      "Supprimer la quittance, mars 2026",
      "Télécharger la quittance, janvier 2026",
      "Supprimer la quittance, janvier 2026",
    ]);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("R36 — le nom accessible commence par le texte visible du lien", () => {
    setup([JANVIER]);

    for (const lien of screen.getAllByRole("link")) {
      expect(lien.getAttribute("aria-label")).toMatch(new RegExp(`^${lien.textContent}`));
    }
  });

  it("CA24 — chaque ligne a ses propres adresses (celle de sa quittance)", () => {
    setup([MARS, JANVIER]);

    expect(
      within(ligne(0)).getByRole("link", { name: /^Télécharger/ }),
    ).toHaveAttribute("href", `/quittances/${ID_MARS}/pdf`);
    expect(
      within(ligne(1)).getByRole("link", { name: /^Supprimer/ }),
    ).toHaveAttribute("href", `/quittances/${ID_JANVIER}/supprimer`);
  });

  it("R37 — aucun lien ne contient le nom du locataire ni une adresse e-mail", () => {
    setup([JANVIER]);

    for (const lien of screen.getAllByRole("link")) {
      expect(lien.getAttribute("href")).toMatch(/^\/quittances\/[0-9a-f-]{36}\/(pdf|supprimer)$/);
    }
  });
});

describe("ReceiptList — canDelete={false}, location archivée (R39, CA50)", () => {
  it("CA50 — les liens Télécharger restent, aucun lien Supprimer", () => {
    render(<ReceiptList receipts={[MARS, JANVIER]} canDelete={false} />);

    expect(screen.getAllByRole("link").map((lien) => lien.getAttribute("href"))).toEqual([
      `/quittances/${ID_MARS}/pdf`,
      `/quittances/${ID_JANVIER}/pdf`,
    ]);
    expect(screen.queryByRole("link", { name: /^Supprimer/ })).not.toBeInTheDocument();
  });

  it("CA50 — les lignes gardent leur contenu (mois, total, référence)", () => {
    render(<ReceiptList receipts={[JANVIER]} canDelete={false} />);

    const texte = normaliser(ligne(0).textContent);
    expect(texte).toMatch(/Janvier 2026.*425,50 € charges comprises.*Référence 2026-01-3F9A1C2E/);
  });

  it("CA24 — canDelete={true} explicite : les deux liens par ligne", () => {
    render(<ReceiptList receipts={[JANVIER]} canDelete />);

    expect(within(ligne(0)).getAllByRole("link")).toHaveLength(2);
  });
});
