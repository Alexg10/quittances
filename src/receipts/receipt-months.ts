// Mois d'une quittance (R8 à R11 de la spécification 04). Fonctions pures :
// l'instant « maintenant » est toujours un paramètre, jamais lu ici.
//
// Un mois est une chaîne « AAAA-MM », comme une date de bail est une chaîne
// « AAAA-MM-JJ » : on la lit, la compare et l'affiche comme du texte, sans objet
// Date, dont l'interprétation dépend du fuseau de la machine. Les chaînes
// « AAAA-MM » se comparent correctement avec < et >.
import { formatDate, getTodayInParis } from "../rentals/rental-dates";
import type { ReceiptParsed } from "./receipt-messages";

// R10 : sept caractères, quatre chiffres ASCII (\d sans l'indicateur « u »), un
// tiret, un mois de 01 à 12. En JavaScript, `$` ne reconnaît que la fin du texte
// (pas avant un saut de ligne final), donc « 2026-10\n » est refusé.
const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

export function isMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

// R10 : seule la forme « AAAA-MM » est lue. Toute autre valeur donne Q1.
export function parseMonthInput(input: string): ReceiptParsed<string> {
  return isMonth(input)
    ? { ok: true, value: input }
    : { ok: false, error: "Q1" };
}

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const;

// R11, forme de titre : « 2026-10 » -> « Octobre 2026 ». Le mois doit être valide.
export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${MONTH_NAMES[Number(monthNumber) - 1]} ${year}`;
}

// R11, forme de phrase (métadonnées, noms accessibles) : « octobre 2026 ».
export function formatMonthInSentence(month: string): string {
  return formatMonthLabel(month).toLowerCase();
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 12
    ? `${year + 1}-01`
    : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
}

// Dernier mois qu'une location peut recevoir (R8) : le plus petit du mois courant
// à Paris et du mois de la date de fin si elle existe.
function lastAcceptableMonth(endDate: string | null, now: Date): string {
  const currentMonth = monthOf(getTodayInParis(now));
  return endDate !== null && monthOf(endDate) < currentMonth
    ? monthOf(endDate)
    : currentMonth;
}

// R8 : les mois acceptés, du plus ancien au plus récent. Du mois du début du bail
// au plus tôt entre le mois courant à Paris et le mois de fin ; la comparaison se
// fait par mois, jamais par jour ; jamais un mois futur. Vide si le bail commence
// après le mois courant. `now` est un instant : le fuseau du processus est sans
// effet.
export function getAcceptedMonths(
  startDate: string,
  endDate: string | null,
  now: Date,
): string[] {
  const last = lastAcceptableMonth(endDate, now);
  const months: string[] = [];
  for (let month = monthOf(startDate); month <= last; month = nextMonth(month)) {
    months.push(month);
  }
  return months;
}

// R8 sans construire la liste : « ce mois est-il accepté ? ».
export function isMonthAccepted(
  month: string,
  startDate: string,
  endDate: string | null,
  now: Date,
): boolean {
  return (
    month >= monthOf(startDate) && month <= lastAcceptableMonth(endDate, now)
  );
}

// R10 : la valeur reçue du navigateur, puis son acceptation par R8. Mal formée :
// Q1 ; bien formée mais refusée : Q2. Les mois proposés à l'écran ne sont jamais
// une autorisation, le serveur rappelle cette fonction à chaque envoi.
export function validateMonthInput(
  input: string,
  startDate: string,
  endDate: string | null,
  now: Date,
): ReceiptParsed<string> {
  const parsed = parseMonthInput(input);
  if (!parsed.ok) {
    return parsed;
  }
  return isMonthAccepted(parsed.value, startDate, endDate, now)
    ? parsed
    : { ok: false, error: "Q2" };
}

export type ReceiptPeriod = {
  // « AAAA-MM-JJ ».
  start: string;
  end: string;
  // Vrai si la période couvre tout le mois (R9).
  complete: boolean;
};

function lastDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  // Jour 0 du mois suivant = dernier jour de ce mois. `Date.UTC` et `getUTCDate`
  // ne passent par aucun fuseau : le résultat est le même partout.
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

// R9 : la partie du mois couverte par le bail. Commence au plus tard du premier
// jour du mois et de la date de début ; finit au plus tôt du dernier jour du mois
// et de la date de fin. Le mois doit être accepté par R8.
export function getReceiptPeriod(
  month: string,
  startDate: string,
  endDate: string | null,
): ReceiptPeriod {
  const firstDay = `${month}-01`;
  const lastDay = lastDayOfMonth(month);
  const start = startDate > firstDay ? startDate : firstDay;
  const end = endDate !== null && endDate < lastDay ? endDate : lastDay;
  return { start, end, complete: start === firstDay && end === lastDay };
}

// R11 : texte d'une option de la liste des mois. Une période incomplète est
// signalée : « Janvier 2026 (du 15/01/2026 au 31/01/2026) ».
export function formatMonthOption(
  month: string,
  period: ReceiptPeriod,
): string {
  const label = formatMonthLabel(month);
  return period.complete
    ? label
    : `${label} (du ${formatDate(period.start)} au ${formatDate(period.end)})`;
}
