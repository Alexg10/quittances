import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DESTRUCTIVE_BUTTON_SMALL_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from "@/components/button-styles";
import type { ConfirmFormState } from "@/rentals/rental-operation-state";

import { ActiveRentalActions, ArchivedRentalActions } from "./rental-actions";

// Doublure de `next/link` : un <a> simple. Seule frontière simulée avec la
// Server Action passée en prop ; ConfirmForm est réel.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const CHEMIN = "/locations/7f3b2c1a-1111-4222-8333-444455556666";

const PHRASE_A =
  "Une location ne peut être archivée qu'une fois terminée, c'est-à-dire le lendemain de sa date de fin.";
const PHRASE_B =
  "Une location qui a des quittances ne peut pas être supprimée directement. Archivez-la, puis supprimez-la depuis les archives.";

type Cas = {
  nom: string;
  hasEndDate: boolean;
  isArchivable: boolean;
  hasReceipts: boolean;
  liens: [string, string][];
  phrases: string[];
};

const MODIFIER: [string, string] = ["Modifier", `${CHEMIN}/modifier`];
const METTRE_FIN: [string, string] = ["Mettre fin à la location", `${CHEMIN}/fin`];
const MODIFIER_FIN: [string, string] = ["Modifier la fin de la location", `${CHEMIN}/fin`];
const ARCHIVER: [string, string] = ["Archiver", `${CHEMIN}/archiver`];
const SUPPRIMER: [string, string] = ["Supprimer", `${CHEMIN}/supprimer`];

const CAS: Cas[] = [
  { nom: "en cours, sans quittance, sans date de fin", hasEndDate: false, isArchivable: false, hasReceipts: false, liens: [MODIFIER, METTRE_FIN, SUPPRIMER], phrases: [PHRASE_A] },
  { nom: "en cours, sans quittance, date de fin à venir", hasEndDate: true, isArchivable: false, hasReceipts: false, liens: [MODIFIER, MODIFIER_FIN, SUPPRIMER], phrases: [PHRASE_A] },
  { nom: "en cours, avec quittance, sans date de fin", hasEndDate: false, isArchivable: false, hasReceipts: true, liens: [MODIFIER, METTRE_FIN], phrases: [PHRASE_A, PHRASE_B] },
  { nom: "en cours, avec quittance, date de fin à venir", hasEndDate: true, isArchivable: false, hasReceipts: true, liens: [MODIFIER, MODIFIER_FIN], phrases: [PHRASE_A, PHRASE_B] },
  { nom: "terminée, sans quittance", hasEndDate: true, isArchivable: true, hasReceipts: false, liens: [MODIFIER, MODIFIER_FIN, ARCHIVER, SUPPRIMER], phrases: [] },
  { nom: "terminée, avec quittance", hasEndDate: true, isArchivable: true, hasReceipts: true, liens: [MODIFIER, MODIFIER_FIN, ARCHIVER], phrases: [PHRASE_B] },
];

function setupActive(cas: Cas) {
  return render(
    <ActiveRentalActions
      rentalPath={CHEMIN}
      hasEndDate={cas.hasEndDate}
      isArchivable={cas.isArchivable}
      hasReceipts={cas.hasReceipts}
    />,
  );
}

const normaliser = (texte: string | null) => (texte ?? "").replace(/\s+/g, " ").trim();

describe.each(CAS)("ActiveRentalActions — $nom (R43)", (cas) => {
  it("CA49 — exactement ces liens, dans cet ordre, avec ces cibles", () => {
    setupActive(cas);

    const obtenus = screen
      .getAllByRole("link")
      .map((lien) => [normaliser(lien.textContent), lien.getAttribute("href")]);
    expect(obtenus).toEqual(cas.liens);
  });

  it("CA49 — les phrases A et B présentes ou absentes, mot pour mot", () => {
    const { container } = setupActive(cas);

    const paragraphes = Array.from(container.querySelectorAll("p")).map((p) =>
      normaliser(p.textContent),
    );
    expect(paragraphes).toEqual(cas.phrases);
  });

  it("jamais de lien désactivé : aucun lien aria-disabled, aucun bouton", () => {
    setupActive(cas);

    for (const lien of screen.getAllByRole("link")) {
      expect(lien).not.toHaveAttribute("aria-disabled");
      expect(lien).not.toHaveAttribute("tabindex", "-1");
    }
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("R36 — Supprimer est destructif, les autres liens sont secondaires", () => {
    setupActive(cas);

    for (const lien of screen.getAllByRole("link")) {
      const destructif = normaliser(lien.textContent) === "Supprimer";
      const attendu = destructif
        ? DESTRUCTIVE_BUTTON_SMALL_CLASSES
        : SECONDARY_BUTTON_CLASSES;
      expect(lien.className).toBe(attendu);
    }
  });
});

describe("ActiveRentalActions — phrases", () => {
  it("CA49 — la phrase A précède la phrase B", () => {
    const { container } = setupActive(CAS[2]);

    const [premiere, seconde] = Array.from(container.querySelectorAll("p"));
    expect(normaliser(premiere.textContent)).toBe(PHRASE_A);
    expect(normaliser(seconde.textContent)).toBe(PHRASE_B);
  });

  it("CA49 — les phrases viennent après les liens", () => {
    setupActive(CAS[2]);

    const dernierLien = screen.getAllByRole("link").at(-1)!;
    const phrase = screen.getByText(PHRASE_A);
    expect(dernierLien.compareDocumentPosition(phrase) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("ArchivedRentalActions — location archivée (R39, R40, CA50)", () => {
  function setupArchived(action = vi.fn(async (): Promise<ConfirmFormState> => ({}))) {
    const view = render(<ArchivedRentalActions rentalPath={CHEMIN} restoreAction={action} />);
    return { ...view, action };
  }

  it("CA50 — `Restaurer la location` est un bouton submit dans un formulaire, jamais un lien", () => {
    const { container } = setupArchived();

    const bouton = screen.getByRole("button", { name: "Restaurer la location" });
    expect(bouton).toHaveAttribute("type", "submit");
    expect(bouton.closest("form")).toBe(container.querySelector("form"));
    expect(screen.queryByRole("link", { name: "Restaurer la location" })).not.toBeInTheDocument();
  });

  it("CA50 — `Supprimer définitivement` est un lien vers la page de suppression, pas un bouton", () => {
    setupArchived();

    const lien = screen.getByRole("link", { name: "Supprimer définitivement" });
    expect(lien).toHaveAttribute("href", `${CHEMIN}/supprimer`);
    expect(screen.queryByRole("button", { name: "Supprimer définitivement" })).not.toBeInTheDocument();
  });

  it("CA50 — un seul lien et un seul bouton, restaurer avant supprimer", () => {
    setupArchived();

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const bouton = screen.getByRole("button", { name: "Restaurer la location" });
    const lien = screen.getByRole("link", { name: "Supprimer définitivement" });
    expect(bouton.compareDocumentPosition(lien) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(["Modifier", "Mettre fin à la location", "Modifier la fin de la location", "Archiver", "Produire une quittance"])(
    "R39 — aucune action « %s »",
    (nom) => {
      setupArchived();

      expect(screen.queryByRole("link", { name: nom })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: nom })).not.toBeInTheDocument();
    },
  );

  it("R40 — le lien `Retour aux archives` n'est pas dans ce groupe (c'est la page qui le pose)", () => {
    setupArchived();

    expect(screen.queryByRole("link", { name: "Retour aux archives" })).not.toBeInTheDocument();
  });

  it("R36 — Supprimer définitivement est destructif, Restaurer est secondaire", () => {
    setupArchived();

    expect(screen.getByRole("link", { name: "Supprimer définitivement" }).className).toBe(
      DESTRUCTIVE_BUTTON_SMALL_CLASSES,
    );
    expect(screen.getByRole("button", { name: "Restaurer la location" }).className).toContain(
      SECONDARY_BUTTON_CLASSES,
    );
  });
});
