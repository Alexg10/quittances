// Espace réservé du propriétaire (T3 de la spécification 02). Volontairement
// presque vide : il prouve que la session fonctionne et pose la règle
// d'isolation entre comptes.
//
// Server Component, rendu à chaque requête : ce qu'il affiche dépend du cookie
// de session. Rien ne le déclare : lire la session, donc les en-têtes de la
// requête, suffit à ce que Next ne pré-rende pas la page (`ƒ` au build). Le
// serveur envoie la page complète, lisible sans JavaScript ; il n'y a pas
// d'état de chargement. Seuls le logo et le formulaire de déconnexion sont des
// Client Components.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { getCurrentOwner, type Owner } from "@/auth/current-owner";
import { PRIMARY_BUTTON_LINK_CLASSES } from "@/components/button-styles";
import {
  buildSignInPath,
  DASHBOARD_PATH,
  toSearchString,
} from "@/auth/return-path";

import { getTodayInParis } from "@/rentals/rental-dates";
import { splitRentals } from "@/rentals/rental-list";
import {
  listRentals,
  RentalStoreError,
  type Rental,
} from "@/rentals/rental-store";

import { DashboardHeader } from "./dashboard-header";
import { EmptyRentals } from "./empty-rentals";
import { RentalList } from "./rental-list";
import { ServiceUnavailable } from "./service-unavailable";
import { SignOutForm } from "./sign-out-form";

// Le titre dépend de la session : un visiteur non connecté ne doit pas même
// recevoir « Tableau de bord » dans le titre du document (R23).
export async function generateMetadata(): Promise<Metadata> {
  const owner = await readOwner();
  if (owner === "unavailable" || owner === null) {
    // Le titre par défaut du site, défini dans le layout racine, s'applique.
    return {};
  }
  return { title: "Tableau de bord — Quittances" };
}

export default async function DashboardPage({
  searchParams,
}: PageProps<"/tableau-de-bord">) {
  // La page vérifie elle-même la session (R2), même si le proxy a déjà
  // redirigé les visiteurs sans cookie : lui n'est qu'un confort.
  const owner = await readOwner();

  if (owner === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (owner === null) {
    // redirect() fonctionne en levant une erreur : il est appelé hors de tout
    // try, qui l'intercepterait.
    redirect(
      buildSignInPath(DASHBOARD_PATH, toSearchString(await searchParams)),
    );
  }

  // Seule lecture de locations de la page : celle du propriétaire courant.
  const rentals = await readRentals(owner);
  if (rentals === "unavailable") {
    // Une liste illisible n'est jamais rendue comme « Aucune location » (R31).
    return <ServiceUnavailable />;
  }
  // Le statut se calcule sur le serveur, à la date du jour à Paris (R20).
  const today = getTodayInParis(new Date());
  const { ongoing, ended } = splitRentals(rentals, today);

  return (
    <>
      <DashboardHeader>
        {/* Seul élément client de la page, avec le logo. */}
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <h1 className="font-display text-subtitle font-bold md:text-title">
          Tableau de bord
        </h1>
        {/* wrap-anywhere : une adresse longue passe à la ligne au lieu de
            créer un défilement horizontal. */}
        <p className="wrap-anywhere text-text-secondary">
          Connecté en tant que{" "}
          <span className="text-text-primary">{owner.email}</span>
        </p>

        {rentals.length === 0 ? (
          <EmptyRentals />
        ) : (
          <>
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-body font-bold">
                  Locations en cours
                </h2>
                <Link
                  href="/locations/nouvelle"
                  className={PRIMARY_BUTTON_LINK_CLASSES}
                >
                  Ajouter une location
                </Link>
              </div>
              {ongoing.length > 0 ? (
                <RentalList rentals={ongoing} status="ongoing" />
              ) : (
                <p className="text-text-secondary">Aucune location en cours.</p>
              )}
            </section>
            {ended.length > 0 ? (
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-body font-bold">
                  Locations terminées
                </h2>
                <RentalList rentals={ended} status="ended" />
              </section>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}

// Le propriétaire courant, null sans session, ou "unavailable" si la session
// n'a pas pu être vérifiée (base injoignable). Une panne est un cas attendu :
// elle est rendue comme un état de la page, pas comme une exception.
// `cache` de React garde le résultat le temps d'une requête : generateMetadata
// et la page partagent un seul appel, donc une seule ligne de journal en cas de
// panne. Rien n'est conservé d'une requête à l'autre ni d'un compte à l'autre.
const readOwner = cache(async (): Promise<Owner | null | "unavailable"> => {
  try {
    return await getCurrentOwner();
  } catch (error) {
    // Next signale certaines situations par des erreurs internes (une page
    // rendue hors requête pendant le build, par exemple) : on les lui rend.
    unstable_rethrow(error);
    // On ne journalise que le type de l'erreur : son message peut contenir
    // des détails de connexion.
    console.error(
      "Tableau de bord : session non vérifiable",
      error instanceof Error ? error.name : typeof error,
    );
    return "unavailable";
  }
});

// Les locations du propriétaire courant, ou "unavailable" si la base ne répond
// pas. Une RentalStoreError est une panne attendue : un état de la page. Toute
// autre erreur remonte à error.tsx.
async function readRentals(owner: Owner): Promise<Rental[] | "unavailable"> {
  try {
    return await listRentals(owner);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof RentalStoreError) {
      // Seul le type est journalisé : jamais de valeur saisie (R43).
      console.error("Tableau de bord : locations illisibles", error.name);
      return "unavailable";
    }
    throw error;
  }
}
