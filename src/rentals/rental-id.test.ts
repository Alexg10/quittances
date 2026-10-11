import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { isRentalId } from "./rental-id";

const VALIDE = "3b241101-e2bb-4255-8caf-4136c566a962";

describe("isRentalId (R6)", () => {
  it.each([
    [VALIDE],
    ["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
    ["0d2f4e1a-9b3c-4a7e-b5d1-123456789abc"],
  ])("accepte l'UUID v4 canonique %s", (id) => {
    expect(isRentalId(id)).toBe(true);
  });

  it("accepte les UUID v4 produits par le système (100 tirages)", () => {
    for (let i = 0; i < 100; i++) {
      expect(isRentalId(randomUUID())).toBe(true);
    }
  });

  it.each([
    ["majuscules", VALIDE.toUpperCase()],
    ["majuscule isolée", `3B241101${VALIDE.slice(8)}`],
    ["accolades", `{${VALIDE}}`],
    ["sans tirets", VALIDE.replaceAll("-", "")],
    ["espace au début", ` ${VALIDE}`],
    ["espace à la fin", `${VALIDE} `],
    ["saut de ligne final", `${VALIDE}\n`],
    ["saut de ligne initial", `\n${VALIDE}`],
    ["retour chariot final", `${VALIDE}\r`],
    ["caractère nul final", `${VALIDE}\u0000`],
    ["chaîne vide", ""],
    ["1", "1"],
    ["nouvelle2", "nouvelle2"],
    ["nouvelle", "nouvelle"],
    ["très longue (10 000 caractères)", "a".repeat(10_000)],
    ["très longue, préfixée d'un UUID valide", VALIDE + "a".repeat(10_000)],
    ["../", "../"],
    ["chemin relatif", `../${VALIDE}`],
    ["apostrophe", "'"],
    ["injection SQL", "' or 1=1 --"],
    ["injection SQL encodée", "%27%20or%201%3D1"],
    ["injection après un UUID valide", `${VALIDE}' or '1'='1`],
    ["tirets encodés", VALIDE.replaceAll("-", "%2D")],
    ["préfixe urn:uuid:", `urn:uuid:${VALIDE}`],
    ["35 caractères", VALIDE.slice(1)],
    ["37 caractères", `${VALIDE}a`],
    ["deux UUID collés", `${VALIDE}${VALIDE}`],
    ["tiret mal placé", "3b24110-1e2bb-4255-8caf-4136c566a962"],
    ["chiffre non hexadécimal", "3b241101-e2bb-4255-8caf-4136c566a96g"],
    ["chiffres pleine largeur", "３b241101-e2bb-4255-8caf-4136c566a962"],
    ["paramètre de requête", `${VALIDE}?a=1`],
    ["barre finale", `${VALIDE}/`],
  ])("refuse : %s", (_cas, id) => {
    expect(isRentalId(id)).toBe(false);
  });
});
