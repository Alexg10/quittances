// Page « Archives » (R41 de la spécification 04) : les locations archivées du
// propriétaire connecté, la plus récemment archivée d'abord.
// Server Component, rendu à chaque requête : ce qu'il affiche dépend du cookie
// de session, et lire la session suffit à ce que Next ne pré-rende pas la page.
// Aucun Client Component propre à cette page : seuls l'en-tête et la
// déconnexion envoient du JavaScript.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";

import type { Owner } from "@/auth/current-owner";
import {
  buildSignInPath,
  DASHBOARD_PATH,
  toSearchString,
} from "@/auth/return-path";
import { ARCHIVES_PATH } from "@/rentals/archives-path";
import {
  listArchivedRentals,
  RentalStoreError,
  type ArchivedRental,
} from "@/rentals/rental-store";

import { readOwnerAccess } from "../locations/rental-access";
import { DashboardHeader } from "../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../tableau-de-bord/sign-out-form";
import { ArchivedRentalList } from "./archived-rental-list";

// Un visiteur non connecté ne reçoit pas même le titre de la page.
export async function generateMetadata(): Promise<Metadata> {
  const access = await readOwnerAccess();
  if (access.kind !== "signed-in") {
    return {};
  }
  return { title: "Archives — Quittances" };
}

export default async function ArchivesPage({
  searchParams,
}: PageProps<"/archives">) {
  // La page vérifie elle-même la session (R21) : le proxy, qui redirige plus
  // tôt les visiteurs sans cookie, n'est qu'un confort.
  const access = await readOwnerAccess();

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    redirect(buildSignInPath(ARCHIVES_PATH, toSearchString(await searchParams)));
  }

  // Seule lecture de la page : les locations archivées du propriétaire de la
  // session. Aucune adresse ni aucun paramètre ne désigne un compte.
  const rentals = await readArchivedRentals(access.owner);
  if (rentals === "unavailable") {
    // Une liste illisible n'est jamais rendue comme « Aucune location
    // archivée » (R41).
    return <ServiceUnavailable />;
  }

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <div className="flex flex-col gap-4">
          <Link
            href={DASHBOARD_PATH}
            className="self-start text-primary underline"
          >
            Retour au tableau de bord
          </Link>
          <h1 className="font-display text-subtitle font-bold md:text-title">
            Archives
          </h1>
        </div>
        <p className="text-text-secondary">
          Les locations archivées sont conservées ici avec leurs quittances.
          Ouvrez une location pour télécharger ses quittances, la restaurer ou
          la supprimer définitivement.
        </p>

        {rentals.length === 0 ? (
          <p>Aucune location archivée.</p>
        ) : (
          <ArchivedRentalList rentals={rentals} />
        )}
      </main>
    </>
  );
}

// Les locations archivées du propriétaire courant, ou "unavailable" si la base
// ne répond pas. Une RentalStoreError est une panne attendue : un état de la
// page. Toute autre erreur remonte à error.tsx.
async function readArchivedRentals(
  owner: Owner,
): Promise<ArchivedRental[] | "unavailable"> {
  try {
    return await listArchivedRentals(owner);
  } catch (error) {
    // Next signale certaines situations par des erreurs internes : on les lui
    // rend.
    unstable_rethrow(error);
    if (error instanceof RentalStoreError) {
      // Seul le type est journalisé : jamais de valeur saisie (R37).
      console.error("Archives : locations illisibles", error.name);
      return "unavailable";
    }
    throw error;
  }
}
