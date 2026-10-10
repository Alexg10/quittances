// Normalisation de l'adresse e-mail (R4) : espaces de début et de fin retirés,
// puis minuscules. Rien d'autre : les points et le suffixe « +… » sont conservés.
// Fonction pure, sans dépendance : utilisable et testable partout.
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
