// Coupe des mots trop longs (R28 de la spécification 04). Fonction pure : la
// largeur d'un caractère est fournie par l'appelant, ce fichier ne connaît ni la
// police ni la bibliothèque PDF.
//
// Pourquoi le faire à la main : la bibliothèque PDF ajoute un « - » quand elle
// coupe un mot, ce que R28 interdit, et si on lui interdit la césure elle laisse
// un mot trop long sortir de la page. On coupe donc nous-mêmes les mots qui ne
// tiennent pas sur une ligne, en insérant une espace ordinaire : la bibliothèque
// y passe à la ligne sans rien ajouter, et la coupe tombe en fin de ligne parce
// que chaque morceau remplit presque une ligne. Une vraie coupure (saut de ligne)
// n'est pas possible : la police n'a pas de dessin pour ce caractère, et la
// bibliothèque ajouterait alors une police standard non incorporée au fichier.

// Largeur d'un caractère, en points (unité du PDF), pour un corps donné.
export type MeasureCharacter = (character: string) => number;

// Coupe chaque mot (suite de caractères sans espace) dont la largeur dépasse
// `maxWidth`, au dernier caractère qui tient, en insérant une espace. Le texte lu
// sans ses espaces est inchangé.
export function breakLongWords(
  text: string,
  maxWidth: number,
  measure: MeasureCharacter,
): string {
  return text
    .split(" ")
    .map((word) => breakWord(word, maxWidth, measure))
    .join(" ");
}

function breakWord(
  word: string,
  maxWidth: number,
  measure: MeasureCharacter,
): string {
  const lines: string[] = [];
  let line = "";
  let lineWidth = 0;
  // `for…of` parcourt les points de code : un caractère hors du plan de base
  // n'est jamais coupé en deux.
  for (const character of word) {
    const width = measure(character);
    // `line !== ""` : un caractère plus large que la ligne tient seul, sinon la
    // boucle ne finirait pas de produire des lignes vides.
    if (line !== "" && lineWidth + width > maxWidth) {
      lines.push(line);
      line = "";
      lineWidth = 0;
    }
    line += character;
    lineWidth += width;
  }
  lines.push(line);
  return lines.join(" ");
}
