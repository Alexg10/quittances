// Dates du bail et statut d'une location (R19, R20, R21, R22 de la
// spécification 03).
// Une date de bail est une chaîne « AAAA-MM-JJ », sans heure ni fuseau. Elle ne
// passe jamais par un objet Date, dont l'interprétation dépend du fuseau de la
// machine : on la lit, la compare et l'affiche comme du texte. Les chaînes
// « AAAA-MM-JJ » se comparent correctement avec < et > (ordre alphabétique =
// ordre chronologique).
import type { Parsed } from "./rental-messages";

export const DATE_MIN = "1950-01-01";
export const DATE_MAX = "2099-12-31";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// Lit une date de bail (R19). `kind` choisit le message de champ vide : L19 pour
// le début, L23 pour la fin. Dans l'ordre : vide, forme ou jour inexistant (L20),
// bornes (L21). Aucune espace n'est tolérée : un champ de date n'en envoie pas.
export function parseDateInput(
  input: string,
  kind: "start" | "end",
): Parsed<string> {
  if (input === "") {
    return { ok: false, error: kind === "start" ? "L19" : "L23" };
  }
  const match = DATE_PATTERN.exec(input);
  if (match === null) {
    return { ok: false, error: "L20" };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return { ok: false, error: "L20" };
  }
  if (input < DATE_MIN || input > DATE_MAX) {
    return { ok: false, error: "L21" };
  }
  return { ok: true, value: input };
}

// Date de fin (R21) : lue comme une date, puis comparée à la date de début.
// Égale au début, elle est acceptée (bail d'un jour) ; avant, L24.
export function parseEndDateInput(
  input: string,
  startDate: string,
): Parsed<string> {
  const parsed = parseDateInput(input, "end");
  if (parsed.ok && parsed.value < startDate) {
    return { ok: false, error: "L24" };
  }
  return parsed;
}

// Cohérence côté début (R22) : une date de début postérieure à la date de fin
// existante est refusée (L22). Renvoie null si tout va bien.
export function checkStartAgainstEnd(
  startDate: string,
  endDate: string | null,
): "L22" | null {
  return endDate !== null && startDate > endDate ? "L22" : null;
}

// Affichage (R19) : « 2026-01-05 » -> « 05/01/2026 », par découpage du texte.
// La date doit déjà être valide.
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export type RentalStatus = "ongoing" | "ended";

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  ongoing: "En cours",
  ended: "Terminée",
};

// Statut (R20). `today` est la date du jour à Paris, passée en paramètre : la
// fonction ne lit jamais l'horloge. La date de fin est le dernier jour du bail,
// inclus : terminée seulement si elle est strictement antérieure à aujourd'hui.
// Une location sans date de fin, ou dont le début est à venir, est en cours.
export function getRentalStatus(
  endDate: string | null,
  today: string,
): RentalStatus {
  return endDate !== null && endDate < today ? "ended" : "ongoing";
}

const parisDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Date du jour à Europe/Paris (R20) pour un instant donné. L'horloge est un
// paramètre : l'appelant écrit getTodayInParis(new Date()), un test fournit un
// instant fixe. Intl applique les règles du fuseau, changements d'heure compris,
// quel que soit le fuseau du processus. On assemble les parties à la main plutôt
// que de compter sur l'ordre d'un format de langue.
export function getTodayInParis(now: Date): string {
  const parts = parisDateFormat.formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
