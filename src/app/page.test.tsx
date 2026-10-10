import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

// Textes recopiés depuis la section « Contenus » de
// docs/specs/01-accueil-et-design-system.md (R15 : mot pour mot).
const TITRE_H1 = "Vos quittances de loyer, envoyées sans y penser.";
const SURTITRE = "Pour les propriétaires bailleurs";
const ACCROCHE =
  "Le jour de l'échéance, Quittances vous demande par e-mail si le loyer est arrivé. Vous confirmez, la quittance PDF part chez votre locataire. Sinon, il reçoit une relance.";
const INTRO_ETAPES = "Trois étapes, une fois par mois et par location.";
const TEXTE_INSCRIPTIONS =
  "Quittances est en cours de développement. La création de compte n'est pas encore disponible.";
const TEXTE_PIED =
  "Quittances, l'envoi des quittances de loyer et des relances pour les propriétaires bailleurs.";

const ETAPES = [
  {
    titre: "Vous recevez un e-mail le jour J",
    texte:
      "Vous choisissez le jour d'échéance de chaque location. Ce jour-là, Quittances vous demande si le loyer a bien été reçu.",
  },
  {
    titre: "Vous confirmez, ou non, le loyer",
    texte:
      "Rien ne part sans votre réponse. C'est vous qui pointez chaque paiement.",
  },
  {
    titre: "Votre locataire reçoit le bon e-mail",
    texte:
      "Si le loyer est confirmé, la quittance en PDF lui est envoyée. Sinon, il reçoit une relance. Il n'a aucun compte à créer.",
  },
];

const CARTES = [
  {
    titre: "Plusieurs locations, un seul compte",
    texte:
      "Suivez tous vos biens au même endroit, chacun avec son locataire, son loyer et son jour d'échéance.",
  },
  {
    titre: "Quittances en PDF",
    texte:
      "Une quittance prête à imprimer, envoyée par e-mail à votre locataire dès que vous confirmez le loyer.",
  },
  {
    titre: "Relances des loyers non reçus",
    texte:
      "Si vous indiquez que le loyer n'est pas arrivé, votre locataire reçoit un e-mail de relance.",
  },
  {
    titre: "Tableau de bord et exports",
    texte:
      "Voyez d'un coup d'œil les loyers reçus et les impayés, et exportez-les.",
  },
];

describe("Page d'accueil", () => {
  it("CA11 — contient exactement un titre de niveau 1 au texte exact", () => {
    render(<Home />);

    const h1 = screen.getAllByRole("heading", { level: 1 });

    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent(TITRE_H1, { normalizeWhitespace: true });
    expect(h1[0].textContent).toBe(TITRE_H1);
  });

  it("CA12 — contient exactement trois titres de niveau 2, dans l'ordre", () => {
    render(<Home />);

    const h2 = screen.getAllByRole("heading", { level: 2 });

    expect(h2.map((h) => h.textContent)).toEqual([
      "Comment ça marche",
      "Ce que fait Quittances",
      "Les inscriptions ouvrent bientôt",
    ]);
  });

  it("CA13 — affiche le surtitre au texte exact", () => {
    render(<Home />);

    expect(screen.getByText(SURTITRE)).toBeInTheDocument();
  });

  it("CA13 — affiche l'accroche au texte exact", () => {
    render(<Home />);

    expect(screen.getByText(ACCROCHE)).toBeInTheDocument();
  });

  it("CA14 — la section « Comment ça marche » contient l'introduction", () => {
    render(<Home />);
    const section = screen.getByRole("region", { name: "Comment ça marche" });

    expect(within(section).getByText(INTRO_ETAPES)).toBeInTheDocument();
  });

  it("CA14 — contient une liste ordonnée de trois étapes (titres h3 et textes, dans l'ordre)", () => {
    render(<Home />);
    const section = screen.getByRole("region", { name: "Comment ça marche" });

    const liste = within(section).getByRole("list");
    const items = within(liste).getAllByRole("listitem");

    expect(liste.tagName).toBe("OL");
    expect(items).toHaveLength(3);
    ETAPES.forEach((etape, i) => {
      const h3 = within(items[i]).getByRole("heading", { level: 3 });
      expect(h3.textContent).toBe(etape.titre);
      expect(within(items[i]).getByText(etape.texte)).toBeInTheDocument();
    });
  });

  it("CA14 — le numéro d'étape est masqué aux lecteurs d'écran (R-contenus)", () => {
    render(<Home />);
    const section = screen.getByRole("region", { name: "Comment ça marche" });
    const items = within(section).getAllByRole("listitem");

    items.forEach((item, i) => {
      // Les numéros 1, 2, 3 sont décoratifs : absents de l'arbre d'accessibilité.
      const numero = within(item).queryByText(String(i + 1), {
        ignore: "h3, p",
      });
      expect(numero).not.toBeNull();
      expect(numero).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("CA15 — la section « Ce que fait Quittances » contient une liste non ordonnée de quatre cartes (h3 et textes, dans l'ordre)", () => {
    render(<Home />);
    const section = screen.getByRole("region", {
      name: "Ce que fait Quittances",
    });

    const liste = within(section).getByRole("list");
    const items = within(liste).getAllByRole("listitem");

    expect(liste.tagName).toBe("UL");
    expect(items).toHaveLength(4);
    CARTES.forEach((carte, i) => {
      const h3 = within(items[i]).getByRole("heading", { level: 3 });
      expect(h3.textContent).toBe(carte.titre);
      expect(within(items[i]).getByText(carte.texte)).toBeInTheDocument();
    });
  });

  it("CA16 — la section « Les inscriptions ouvrent bientôt » contient le texte exact", () => {
    render(<Home />);
    const section = screen.getByRole("region", {
      name: "Les inscriptions ouvrent bientôt",
    });

    expect(within(section).getByText(TEXTE_INSCRIPTIONS)).toBeInTheDocument();
  });

  it("CA16 — la section « Les inscriptions ouvrent bientôt » ne contient ni lien, ni bouton, ni champ", () => {
    render(<Home />);
    const section = screen.getByRole("region", {
      name: "Les inscriptions ouvrent bientôt",
    });

    expect(within(section).queryByRole("link")).toBeNull();
    expect(within(section).queryByRole("button")).toBeNull();
    expect(within(section).queryByRole("textbox")).toBeNull();
    expect(section.querySelector("a, button, input, textarea, select")).toBeNull();
  });

  it("CA17 — le pied de page (contentinfo) contient le texte exact", () => {
    render(<Home />);

    const pied = screen.getByRole("contentinfo");

    expect(within(pied).getByText(TEXTE_PIED)).toBeInTheDocument();
  });

  it("CA17 — le pied de page ne contient aucun lien", () => {
    render(<Home />);

    const pied = screen.getByRole("contentinfo");

    expect(within(pied).queryByRole("link")).toBeNull();
    expect(pied.querySelector("a")).toBeNull();
  });

  it("CA18 — le lien « Voir comment ça marche » pointe vers #fonctionnement", () => {
    render(<Home />);

    const lien = screen.getByRole("link", { name: "Voir comment ça marche" });

    expect(lien).toHaveAttribute("href", "#fonctionnement");
  });

  it("CA18 — l'élément d'identifiant fonctionnement existe et contient le titre « Comment ça marche »", () => {
    const { container } = render(<Home />);

    const cible = container.querySelector("#fonctionnement");

    expect(cible).not.toBeNull();
    expect(
      within(cible as HTMLElement).getByRole("heading", {
        name: "Comment ça marche",
      }),
    ).toBeInTheDocument();
  });

  it("CA19 — le texte de la page ne contient aucun terme interdit", () => {
    const { container } = render(<Home />);
    const termes = [
      "whatsapp",
      "sms",
      "paiement en ligne",
      "prélèvement",
      "banque",
      "bancaire",
      "gratuit",
      "tarif",
      "prix",
      "conforme",
      "légal",
      "créer mon compte",
      "s'inscrire",
      "se connecter",
    ];
    // Espaces normalisés pour qu'un terme coupé par un retour à la ligne soit trouvé.
    const texte = (container.textContent ?? "")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const trouves = termes.filter((terme) => texte.includes(terme));

    expect(trouves).toEqual([]);
  });

  it("CA20 — la page ne contient aucun button, form, input, textarea, select ni img", () => {
    const { container } = render(<Home />);

    const interdits = container.querySelectorAll(
      "button, form, input, textarea, select, img",
    );

    expect(interdits).toHaveLength(0);
  });

  it("CA20 — la cible de chaque lien est /, #contenu, #fonctionnement ou #fonctionnalites", () => {
    render(<Home />);
    const autorisees = ["/", "#contenu", "#fonctionnement", "#fonctionnalites"];

    const liens = screen.getAllByRole("link");
    const cibles = liens.map((lien) => lien.getAttribute("href"));

    expect(liens.length).toBeGreaterThan(0);
    cibles.forEach((cible) => expect(autorisees).toContain(cible));
  });

  it("CA22 — aucun niveau de titre n'est sauté dans l'ordre du document", () => {
    render(<Home />);

    const niveaux = screen
      .getAllByRole("heading")
      .map((h) => Number(h.tagName.slice(1)));

    expect(niveaux[0]).toBe(1);
    expect(Math.max(...niveaux)).toBeLessThanOrEqual(3);
    niveaux.slice(1).forEach((niveau, i) => {
      // niveau est celui qui suit niveaux[i] : on ne peut descendre que d'un cran à la fois.
      expect(niveau).toBeLessThanOrEqual(niveaux[i] + 1);
    });
  });
});
