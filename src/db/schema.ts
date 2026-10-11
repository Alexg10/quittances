// Schéma Drizzle du compte propriétaire et des sessions (R1, R3, R6 de la
// spécification 02), puis des locations (spécification 03).
// Les quatre premières tables, leurs noms et leurs colonnes sont ceux que Better
// Auth attend : les noms de propriétés (emailVerified, userId…) sont ceux de la
// bibliothèque, les noms de colonnes en base sont en snake_case.
// Ce fichier est lu par drizzle-kit pour générer les migrations : il ne doit
// rien importer qui soit réservé au serveur Next.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Le compte du propriétaire. `id` est l'identifiant interne de R1 : c'est lui que
// les tables métier référenceront pour l'isolation entre comptes (R2).
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    // Exigé par Better Auth, jamais demandé ni affiché (Q2) : toujours vide.
    name: text("name").notNull(),
    // Unicité de R6 garantie par la base : deux inscriptions simultanées avec la
    // même adresse ne peuvent pas aboutir toutes les deux.
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Seule la forme normalisée de R4 peut être enregistrée. Sans cette
    // contrainte, « Marie@… » et « marie@… » seraient deux adresses distinctes
    // pour l'index unique si un chemin de code oubliait de normaliser.
    check("user_email_normalized", sql`${table.email} = lower(btrim(${table.email}))`),
  ],
);

// Une ligne par navigateur connecté (R3). Supprimer la ligne ferme la session.
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Le jeton porté par le cookie de session.
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

// Le moyen de connexion d'un compte. Ici un seul par compte, « credential » :
// c'est cette table qui porte le hachage du mot de passe (colonne `password`).
// Les colonnes de jetons servent à la connexion par un tiers, hors périmètre.
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

// Jetons à usage unique (vérification d'adresse, réinitialisation). Inutilisée
// tant qu'aucun e-mail n'est envoyé, mais elle fait partie du schéma de base de
// Better Auth.
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Une location (R1 de la spécification 03) : un logement, un locataire, un
// loyer. Première table métier : elle porte l'identifiant du propriétaire, et
// toute requête qui la touche filtre dessus (voir src/rentals/rental-store.ts,
// seul module autorisé à l'interroger).
//
// Les contraintes CHECK répètent en base les bornes de R1. La validation des
// saisies reste faite par le code (elle produit les messages d'erreur) ; la base
// est le dernier rempart si un chemin de code oubliait une règle (R8).
export const rental = pgTable(
  "rental",
  {
    // UUID version 4, tiré au hasard par Postgres (gen_random_uuid) : il ne
    // révèle ni le nombre de locations ni leur ordre de création (R6).
    id: uuid("id").primaryKey().defaultRandom(),
    // NOT NULL : pas de location sans propriétaire. ON DELETE CASCADE : si le
    // compte disparaît, ses locations disparaissent avec lui (R4, point 1).
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    // Absent (NULL) plutôt que vide quand il n'y a pas de complément.
    addressComplement: text("address_complement"),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    tenantName: text("tenant_name").notNull(),
    tenantEmail: text("tenant_email").notNull(),
    // Montants en centimes entiers, jamais en nombre à virgule (R14). Le total
    // charges comprises n'est pas enregistré : il se calcule.
    rentInCents: integer("rent_in_cents").notNull(),
    chargesInCents: integer("charges_in_cents").notNull(),
    dueDay: smallint("due_day").notNull(),
    // Dates de calendrier, sans heure ni fuseau (R19). mode "string" : Drizzle
    // rend le texte « AAAA-MM-JJ » tel quel, sans passer par un objet Date qui
    // le décalerait selon le fuseau du serveur.
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // La liste d'un propriétaire filtre sur owner_id et trie par created_at :
    // cet index sert les deux. Il sert aussi à retrouver les locations d'un
    // compte qu'on supprime (cascade), et à les compter (limite de R9).
    index("rental_owner_id_created_at_idx").on(table.ownerId, table.createdAt),
    // char_length compte des caractères Unicode (points de code), comme R11.
    check(
      "rental_address_length",
      sql`char_length(${table.address}) between 1 and 200`,
    ),
    // Une comparaison avec NULL ne fait pas échouer un CHECK : l'absence de
    // complément est acceptée, une chaîne vide ne l'est pas.
    check(
      "rental_address_complement_length",
      sql`char_length(${table.addressComplement}) between 1 and 100`,
    ),
    check(
      "rental_postal_code_format",
      sql`${table.postalCode} ~ '^[0-9]{5}$'`,
    ),
    check("rental_city_length", sql`char_length(${table.city}) between 1 and 100`),
    check(
      "rental_tenant_name_length",
      sql`char_length(${table.tenantName}) between 1 and 100`,
    ),
    // Même règle que pour l'adresse du compte : seule la forme normalisée
    // (sans espace autour, en minuscules) peut être enregistrée (R13).
    check(
      "rental_tenant_email_normalized",
      sql`${table.tenantEmail} = lower(btrim(${table.tenantEmail})) and char_length(${table.tenantEmail}) between 3 and 254`,
    ),
    check(
      "rental_rent_in_cents_range",
      sql`${table.rentInCents} between 1 and 9999999`,
    ),
    check(
      "rental_charges_in_cents_range",
      sql`${table.chargesInCents} between 0 and 9999999`,
    ),
    check("rental_due_day_range", sql`${table.dueDay} between 1 and 31`),
    check(
      "rental_start_date_range",
      sql`${table.startDate} between '1950-01-01' and '2099-12-31'`,
    ),
    check(
      "rental_end_date_range",
      sql`${table.endDate} between '1950-01-01' and '2099-12-31'`,
    ),
    // Égale à la date de début, la date de fin est acceptée : bail d'un jour (R21).
    check(
      "rental_end_date_not_before_start_date",
      sql`${table.endDate} >= ${table.startDate}`,
    ),
  ],
);
