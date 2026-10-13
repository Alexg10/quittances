// Schéma Drizzle du compte propriétaire et des sessions (R1, R3, R6 de la
// spécification 02), des locations (spécification 03), puis des informations du
// bailleur et des quittances (spécification 04).
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
  foreignKey,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
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
    // Instant de l'archivage (R39 de la spécification 04). NULL : la location
    // est active. Renseigné par le système, jamais par un formulaire. Archiver
    // et restaurer ne touchent pas à updated_at : ranger n'est pas modifier.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    // Instant où le propriétaire a attesté l'accord du locataire pour recevoir
    // ses quittances par e-mail (R1 et R2 de la spécification 05). NULL : aucun
    // accord attesté. Calculé par le store à partir de la case du formulaire,
    // jamais lu dans une requête.
    emailConsentAt: timestamp("email_consent_at", { withTimezone: true }),
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
    // Invariant de R39 et R42 : une location archivée est terminée. Sa date de
    // fin existe et précède strictement le jour, à Paris, de son archivage.
    // « is not null » est écrit en toutes lettres : sans lui, une date de fin
    // absente donnerait NULL à la comparaison, et un CHECK laisse passer NULL.
    // Cette contrainte interdit aussi, par ricochet, de rouvrir une location
    // archivée ou de reporter sa date de fin au-delà du jour de son archivage.
    check(
      "rental_archived_only_if_ended",
      sql`${table.archivedAt} is null or (${table.endDate} is not null and ${table.endDate} < (${table.archivedAt} at time zone 'Europe/Paris')::date)`,
    ),
    // Aucune ligne de plus n'est interdite par cette unicité (id est déjà la
    // clé primaire). Elle existe pour que la table des quittances puisse
    // référencer le couple (location, propriétaire) : voir `receipt`.
    unique("rental_id_owner_id_unique").on(table.id, table.ownerId),
  ],
);

// Les informations du bailleur (R1 de la spécification 04) : zéro ou une ligne
// par compte, complète ou absente. La clé primaire EST l'identifiant du compte :
// la base garantit ainsi « au plus un jeu d'informations par compte », et
// l'enregistrement est une insertion qui remplace la ligne si elle existe.
// Seul module autorisé à l'interroger : src/receipts/landlord-store.ts (et la
// production d'une quittance, qui la relit dans sa transaction).
export const landlord = pgTable(
  "landlord",
  {
    // ON DELETE CASCADE : elles disparaissent avec le compte (R20).
    ownerId: text("owner_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address").notNull(),
    // Absent (NULL) plutôt que vide quand il n'y a pas de complément.
    addressComplement: text("address_complement"),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Les bornes de R1, répétées en base (R23).
    check("landlord_name_length", sql`char_length(${table.name}) between 1 and 100`),
    check(
      "landlord_address_length",
      sql`char_length(${table.address}) between 1 and 200`,
    ),
    check(
      "landlord_address_complement_length",
      sql`char_length(${table.addressComplement}) between 1 and 100`,
    ),
    check(
      "landlord_postal_code_format",
      sql`${table.postalCode} ~ '^[0-9]{5}$'`,
    ),
    check("landlord_city_length", sql`char_length(${table.city}) between 1 and 100`),
  ],
);

// Une quittance (R6 de la spécification 04). Elle porte une COPIE de tout ce
// qu'elle affiche : nom et adresse du bailleur, nom du locataire, adresse du
// logement, montants, dates. Rien n'est relu ensuite dans `rental` ni dans
// `landlord`, et aucune opération ne modifie une ligne de cette table.
// Seul module autorisé à l'interroger : src/receipts/receipt-store.ts (et la
// suppression définitive d'une location, dans src/rentals/rental-store.ts).
//
// Deux clés étrangères, deux comportements voulus :
//
// - vers le compte, ON DELETE CASCADE : si le compte disparaît, ses quittances
//   disparaissent avec lui (R20) ;
// - vers la location, ON DELETE NO ACTION : la base REFUSE d'effacer une
//   location qui a encore une quittance (R43). Pas de cascade silencieuse : un
//   chemin de code qui oublierait la règle obtient une erreur, pas une perte de
//   documents. La suppression définitive efface donc elle-même les quittances,
//   puis la location, dans une même transaction.
//
// Pourquoi NO ACTION et pas RESTRICT. RESTRICT est contrôlé à l'instant où la
// ligne de la location est effacée. NO ACTION est contrôlé à la fin de
// l'instruction. Quand on efface un compte, Postgres efface en cascade ses
// locations ET ses quittances dans la même instruction : à la fin, plus aucune
// quittance ne référence les locations effacées, et le contrôle passe. Avec
// RESTRICT, l'effacement du compte serait refusé dès la première location qui
// a une quittance.
export const receipt = pgTable(
  "receipt",
  {
    // UUID version 4 : la référence affichée en est tirée (R16).
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rentalId: uuid("rental_id").notNull(),
    // Mois de rattachement, « AAAA-MM » (R8).
    month: text("month").notNull(),
    // Dates de calendrier, rendues comme du texte « AAAA-MM-JJ » (voir `rental`).
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    landlordName: text("landlord_name").notNull(),
    landlordAddress: text("landlord_address").notNull(),
    landlordAddressComplement: text("landlord_address_complement"),
    landlordPostalCode: text("landlord_postal_code").notNull(),
    landlordCity: text("landlord_city").notNull(),
    tenantName: text("tenant_name").notNull(),
    rentalAddress: text("rental_address").notNull(),
    rentalAddressComplement: text("rental_address_complement"),
    rentalPostalCode: text("rental_postal_code").notNull(),
    rentalCity: text("rental_city").notNull(),
    // Centimes entiers. Le total n'est pas enregistré : il se calcule.
    rentInCents: integer("rent_in_cents").notNull(),
    chargesInCents: integer("charges_in_cents").notNull(),
    paymentDate: date("payment_date", { mode: "string" }).notNull(),
    // Le jour, à Paris, de la production.
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    // L'instant de production : c'est la date de création du PDF (R30).
    producedAt: timestamp("produced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // La clé étrangère vers la location porte sur le couple (location,
    // propriétaire) : la base garantit qu'une quittance a le même propriétaire
    // que sa location. C'est ce qui permet aux lectures de filtrer sur
    // receipt.owner_id en étant sûres de filtrer sur le propriétaire de la
    // location. Aucun onDelete : NO ACTION, voir plus haut.
    foreignKey({
      name: "receipt_rental_id_owner_id_rental_fk",
      columns: [table.rentalId, table.ownerId],
      foreignColumns: [rental.id, rental.ownerId],
    }),
    // R15 : une quittance par location et par mois, garantie par la base. Deux
    // productions simultanées du même mois en créent exactement une. L'index
    // de cette unicité sert aussi à lister les quittances d'une location.
    unique("receipt_rental_id_month_unique").on(table.rentalId, table.month),
    // Pour retrouver les quittances d'un compte qu'on supprime (cascade).
    index("receipt_owner_id_idx").on(table.ownerId),
    check(
      "receipt_month_format",
      sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
    check(
      "receipt_period_end_not_before_start",
      sql`${table.periodEnd} >= ${table.periodStart}`,
    ),
    // La période ne sort pas de son mois (R9) : ses deux bornes, écrites
    // « AAAA-MM », sont le mois de la quittance.
    check(
      "receipt_period_within_month",
      sql`to_char(${table.periodStart}, 'YYYY-MM') = ${table.month} and to_char(${table.periodEnd}, 'YYYY-MM') = ${table.month}`,
    ),
    // R13 : la date d'émission n'est jamais antérieure à la date du paiement.
    check(
      "receipt_payment_date_not_after_issue_date",
      sql`${table.paymentDate} <= ${table.issueDate}`,
    ),
    check(
      "receipt_payment_date_range",
      sql`${table.paymentDate} between '1950-01-01' and '2099-12-31'`,
    ),
    check(
      "receipt_rent_in_cents_range",
      sql`${table.rentInCents} between 1 and 9999999`,
    ),
    check(
      "receipt_charges_in_cents_range",
      sql`${table.chargesInCents} between 0 and 9999999`,
    ),
    // Les valeurs figées respectent les bornes de leur source (R1 de la
    // spécification 03 pour le logement et le locataire, R1 de la 04 pour le
    // bailleur).
    check(
      "receipt_landlord_name_length",
      sql`char_length(${table.landlordName}) between 1 and 100`,
    ),
    check(
      "receipt_landlord_address_length",
      sql`char_length(${table.landlordAddress}) between 1 and 200`,
    ),
    check(
      "receipt_landlord_address_complement_length",
      sql`char_length(${table.landlordAddressComplement}) between 1 and 100`,
    ),
    check(
      "receipt_landlord_postal_code_format",
      sql`${table.landlordPostalCode} ~ '^[0-9]{5}$'`,
    ),
    check(
      "receipt_landlord_city_length",
      sql`char_length(${table.landlordCity}) between 1 and 100`,
    ),
    check(
      "receipt_tenant_name_length",
      sql`char_length(${table.tenantName}) between 1 and 100`,
    ),
    check(
      "receipt_rental_address_length",
      sql`char_length(${table.rentalAddress}) between 1 and 200`,
    ),
    check(
      "receipt_rental_address_complement_length",
      sql`char_length(${table.rentalAddressComplement}) between 1 and 100`,
    ),
    check(
      "receipt_rental_postal_code_format",
      sql`${table.rentalPostalCode} ~ '^[0-9]{5}$'`,
    ),
    check(
      "receipt_rental_city_length",
      sql`char_length(${table.rentalCity}) between 1 and 100`,
    ),
  ],
);
