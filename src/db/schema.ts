// Schéma Drizzle du compte propriétaire et des sessions (R1, R3, R6).
// Les quatre tables, leurs noms et leurs colonnes sont ceux que Better Auth attend :
// les noms de propriétés (emailVerified, userId…) sont ceux de la bibliothèque,
// les noms de colonnes en base sont en snake_case.
// Ce fichier est lu par drizzle-kit pour générer les migrations : il ne doit
// rien importer qui soit réservé au serveur Next.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
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
