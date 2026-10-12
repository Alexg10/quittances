import { expect } from "@playwright/test";

import { creerLocation, type ValeursLocation } from "./aide-locations";

// Fonctions partagées par les specs de l'archivage (R39 à R43 de la spécification
// 04). Comme aide-locations.ts et aide-quittances.ts, la préparation directe passe
// par la base de test, pour les seuls comptes du domaine quittances.test. Les
// colonnes de type date sont lues en texte (`::text`).

async function surBaseDeTest<T>(requete: string, parametres: unknown[]): Promise<T[]> {
  const { Pool } = await import("pg");
  const { requireTestDatabaseUrl } = await import("../src/db/test-database");
  const pool = new Pool({ connectionString: requireTestDatabaseUrl(process.env) });
  try {
    const resultat = await pool.query(requete, parametres);
    return resultat.rows as T[];
  } finally {
    await pool.end();
  }
}

/** La date du jour à Europe/Paris, `AAAA-MM-JJ`, décalée de `jours` (négatif : le passé). */
export function jourDeParis(jours = 0): string {
  const maintenant = new Date();
  const base = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(maintenant);
  const [a, m, j] = base.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + jours));
  return d.toISOString().slice(0, 10);
}

/**
 * Crée une location archivée, sans passer par l'interface. La date de fin doit être
 * strictement antérieure au jour, à Paris, de l'archivage (contrainte de la base).
 * `archiveLe` est un instant ISO (`2026-09-15T10:00:00Z`).
 */
export async function creerLocationArchivee(
  email: string,
  surcharge: Partial<ValeursLocation> = {},
  archiveLe = "2026-09-15T10:00:00Z",
): Promise<{ id: string; valeurs: ValeursLocation }> {
  const location = await creerLocation(email, { startDate: "2026-01-15", endDate: "2026-06-30", ...surcharge });
  await archiverEnBase(email, location.id, archiveLe);
  return location;
}

/** Fixe la date d'archivage d'une location du compte (la base refuse une date de fin non antérieure). */
export async function archiverEnBase(email: string, rentalId: string, archiveLe: string) {
  expect(email).toMatch(/@quittances\.test$/);
  const lignes = await surBaseDeTest<{ id: string }>(
    `update rental set archived_at = $3::timestamptz
     where id = $2 and owner_id in (select id from "user" where email = $1) returning id`,
    [email, rentalId, archiveLe],
  );
  expect(lignes, "la location doit appartenir au compte").toHaveLength(1);
}

export type EtatLocation = {
  id: string;
  archived_at: string | null;
  end_date: string | null;
  start_date: string;
  address: string;
  tenant_name: string;
  tenant_email: string;
  rent_in_cents: number;
  updated_at: string;
  quittances: number;
};

/** L'état complet d'une location, relu en base (nul si elle n'existe plus). `updated_at` en texte, à la microseconde. */
export async function etatLocation(rentalId: string): Promise<EtatLocation | null> {
  const lignes = await surBaseDeTest<EtatLocation>(
    `select r.id, r.archived_at::text as archived_at, r.end_date::text as end_date, r.start_date::text as start_date,
       r.address, r.tenant_name, r.tenant_email, r.rent_in_cents, r.updated_at::text as updated_at,
       (select count(*)::int from receipt q where q.rental_id = r.id) as quittances
     from rental r
     where r.id = $1 and r.owner_id in (select id from "user" where email like '%@quittances.test')`,
    [rentalId],
  );
  return lignes[0] ?? null;
}

/** Nombre de lignes de la base de test qui contiennent l'un des textes (noms, adresses e-mail, adresses). */
export async function occurrencesEnBase(textes: string[]): Promise<number> {
  let total = 0;
  for (const t of textes) {
    const motif = `%${t}%`;
    const lignes = await surBaseDeTest<{ n: string }>(
      `select (
         (select count(*) from rental where tenant_name ilike $1 or tenant_email ilike $1 or address ilike $1)
         + (select count(*) from receipt where tenant_name ilike $1 or rental_address ilike $1 or landlord_name ilike $1)
       )::text as n`,
      [motif],
    );
    total += Number(lignes[0].n);
  }
  return total;
}

/** Nombre de quittances d'une location, quel que soit son propriétaire de test. */
export async function nombreDeQuittances(rentalId: string): Promise<number> {
  const l = await surBaseDeTest<{ n: string }>(`select count(*)::text as n from receipt where rental_id = $1`, [rentalId]);
  return Number(l[0].n);
}
