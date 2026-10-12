// Caractères que le document sait afficher (R17 de la spécification 04). Un
// caractère absent de la police produirait un trou dans le document : on refuse
// le texte avant de produire la quittance.
//
// La règle est écrite à la main, sans lire les polices à l'exécution. Elle a été
// vérifiée contre DM Sans 400 et 500, qui dessinent tout le texte saisi (Plus
// Jakarta Sans ne dessine que le titre, qui est fixe).
//
// Ensemble garanti par R17 : U+0020 à U+007E ; U+00A1 à U+00FF sauf U+00AD ;
// U+0100 à U+017F ; ‘ ’ “ ” – — … €. Écart : DM Sans n'a pas de dessin pour
// quinze caractères de U+0100 à U+017F (Ĉ ĉ Ĝ ĝ Ĥ ĥ Ĵ ĵ ĸ ŉ Ŝ ŝ Ŧ ŧ ſ, utilisés
// par l'espéranto, le sami ou le finnois ancien). Ils ne sont pas affichables ici,
// et la règle ne répond « oui » pour aucun autre caractère que ceux ci-dessus.

const DISPLAYABLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0020, 0x007e],
  [0x00a1, 0x00ff],
  [0x0100, 0x017f],
];

// Typographie courante : ‘ ’ “ ” – — … €.
const DISPLAYABLE_PUNCTUATION: ReadonlySet<number> = new Set([
  0x2018, 0x2019, 0x201c, 0x201d, 0x2013, 0x2014, 0x2026, 0x20ac,
]);

// Dans les intervalles ci-dessus, les points de code que la police ne dessine pas.
const MISSING_FROM_FONT: ReadonlySet<number> = new Set([
  0x00ad, // trait d'union conditionnel : invisible, jamais dessiné
  0x0108, 0x0109, 0x011c, 0x011d, 0x0124, 0x0125, 0x0134, 0x0135, 0x0138,
  0x0149, 0x015c, 0x015d, 0x0166, 0x0167, 0x017f,
]);

// Un point de code est-il affichable ?
export function isDisplayableCodePoint(codePoint: number): boolean {
  if (MISSING_FROM_FONT.has(codePoint)) {
    return false;
  }
  return (
    DISPLAYABLE_PUNCTUATION.has(codePoint) ||
    DISPLAYABLE_RANGES.some(([first, last]) => codePoint >= first && codePoint <= last)
  );
}

// Un texte est affichable si chacun de ses caractères l'est. `for…of` parcourt les
// points de code (pas les unités UTF-16) : « 😀 » est un caractère, pas deux.
// Un texte vide est affichable.
export function isDisplayableText(text: string): boolean {
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || !isDisplayableCodePoint(codePoint)) {
      return false;
    }
  }
  return true;
}
