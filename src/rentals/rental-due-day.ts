// Jour d'échéance (R17 et R18 de la spécification 03).
// Aucun calcul de date d'échéance dans cette version : seulement la lecture du
// jour et le texte qui énonce la règle des mois courts.
import { isRawValueTooLong, type Parsed } from "./rental-messages";

// Texte d'aide du champ (R33).
export const DUE_DAY_HELP_TEXT =
  "Un nombre de 1 à 31. Les mois plus courts, l'échéance tombe le dernier jour du mois.";

// Un ou deux chiffres ASCII (\d sans l'indicateur « u »), ce qui exclut « 005 »,
// « 1,5 », « -1 », « +5 » et les chiffres pleine largeur.
const DUE_DAY_PATTERN = /^\d{1,2}$/;

export function parseDueDayInput(input: string): Parsed<number> {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: false, error: "L17" };
  }
  if (isRawValueTooLong(input) || !DUE_DAY_PATTERN.test(trimmed)) {
    return { ok: false, error: "L18" };
  }
  const day = Number(trimmed);
  if (day < 1 || day > 31) {
    return { ok: false, error: "L18" };
  }
  return { ok: true, value: day };
}

// Valeur affichée dans le détail. Au-delà du 28, le jour n'existe pas dans tous
// les mois : on dit ce qui se passe (R18).
export function formatDueDay(day: number): string {
  if (day <= 28) {
    return `Le ${day} de chaque mois`;
  }
  return `Le ${day} de chaque mois, ou le dernier jour du mois s'il est plus court`;
}
