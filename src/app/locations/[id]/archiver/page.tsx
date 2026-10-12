// Page d'archivage d'une location (R39 et R40 de la spécification 04).
// Une page plutôt qu'un bouton direct : elle explique ce qui va se passer, et
// fonctionne à l'identique avec et sans JavaScript. L'afficher, la recharger ou
// la précharger n'archive rien : seul l'envoi en POST de son formulaire le fait.
// Server Component, rendu à chaque requête parce qu'il lit la session.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buildSignInPath, toSearchString } from "@/auth/return-path";
import { PRIMARY_BUTTON_LARGE_CLASSES } from "@/components/button-styles";
import { isRentalArchivable } from "@/rentals/rental-archivable";

import { DashboardHeader } from "../../../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../../../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../../../tableau-de-bord/sign-out-form";
import { buildRentalPath, readRentalAccess } from "../../rental-access";
import { archiveRentalAction } from "../actions";
import { ConfirmForm } from "../confirm-form";
import { RentalReminder } from "../rental-reminder";

// Titre générique (R37), partagé avec la page par readRentalAccess.
export async function generateMetadata({
  params,
}: PageProps<"/locations/[id]/archiver">): Promise<Metadata> {
  const { id } = await params;
  const access = await readRentalAccess(id);
  if (access.kind === "found") {
    return { title: "Archiver la location — Quittances" };
  }
  if (access.kind === "not-found") {
    return { title: "Location introuvable — Quittances" };
  }
  return {};
}

export default async function ArchiveRentalPage({
  params,
  searchParams,
}: PageProps<"/locations/[id]/archiver">) {
  // La session d'abord, puis la location de ce propriétaire (R21).
  const { id } = await params;
  const access = await readRentalAccess(id);

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    // Même redirection que l'identifiant existe ou non : aucune location n'a
    // été lue.
    redirect(
      buildSignInPath(
        buildRentalPath(id, "archiver"),
        toSearchString(await searchParams),
      ),
    );
  }
  if (access.kind === "not-found") {
    // 404 et écran « Location introuvable » : la même réponse pour la location
    // d'un autre compte, quel que soit son état, et pour un identifiant inconnu.
    notFound();
  }

  const { rental } = access;
  // À partir d'ici, la location appartient au demandeur : son état peut être
  // regardé. La page ne s'applique qu'à une location active et terminée (R39).
  // Déjà archivée, ou encore en cours : retour au détail, sans message (R40) ;
  // il porte lui-même la phrase qui explique qu'elle doit d'abord être
  // terminée. « Terminée » se calcule sur le serveur, à la date du jour à
  // Paris. Ce contrôle n'est qu'un affichage : l'action d'archivage porte la
  // même condition dans son écriture.
  if (
    rental.archivedAt !== null ||
    !isRentalArchivable(rental.endDate, new Date())
  ) {
    redirect(`/locations/${rental.id}`);
  }

  // L'identifiant est lié à l'action sur le serveur, à partir de la location
  // relue en base. L'action refait tous les contrôles (../actions.ts).
  const archiveThisRental = archiveRentalAction.bind(null, rental.id);

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto max-w-7xl px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        {/* Une colonne de 640px au plus (R36). */}
        <div className="flex w-full max-w-160 flex-col gap-6">
          <h1 className="font-display text-subtitle font-bold md:text-title">
            Archiver cette location
          </h1>
          <p>Vous allez archiver la location suivante.</p>
          {/* Le rappel n'affiche jamais l'adresse e-mail du locataire. */}
          <RentalReminder rental={rental} />
          <p className="text-text-secondary">
            La location quitte le tableau de bord et rejoint les archives avec
            ses quittances, qui restent téléchargeables. Rien n&apos;est effacé
            et vous pourrez la restaurer à tout moment.
          </p>
          <div className="flex flex-col gap-4">
            {/* Seul élément primaire de la page (R36) : archiver se défait. */}
            <ConfirmForm
              action={archiveThisRental}
              label="Archiver la location"
              pendingLabel="Archivage en cours"
              buttonClassName={PRIMARY_BUTTON_LARGE_CLASSES}
            />
            <Link
              href={`/locations/${rental.id}`}
              className="self-start text-primary underline"
            >
              Annuler
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
