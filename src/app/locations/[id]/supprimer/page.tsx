// Page de confirmation de la suppression (R23 et R24 de la spécification 03).
// Une page, et non une boîte de dialogue : elle fonctionne à l'identique avec
// et sans JavaScript. L'afficher, la recharger ou la précharger ne supprime
// rien : seul l'envoi en POST de son formulaire le fait.
// Server Component, rendu à chaque requête parce qu'il lit la session.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buildSignInPath, toSearchString } from "@/auth/return-path";
import { DESTRUCTIVE_BUTTON_LARGE_CLASSES } from "@/components/button-styles";

import { DashboardHeader } from "../../../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../../../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../../../tableau-de-bord/sign-out-form";
import { buildRentalPath, readRentalAccess } from "../../rental-access";
import { deleteRentalAction } from "../actions";
import { ConfirmForm } from "../confirm-form";
import { RentalReminder } from "../rental-reminder";

// Titre générique (R43), partagé avec la page par readRentalAccess.
export async function generateMetadata({
  params,
}: PageProps<"/locations/[id]/supprimer">): Promise<Metadata> {
  const { id } = await params;
  const access = await readRentalAccess(id);
  if (access.kind === "found") {
    return { title: "Supprimer la location — Quittances" };
  }
  if (access.kind === "not-found") {
    return { title: "Location introuvable — Quittances" };
  }
  return {};
}

export default async function DeleteRentalPage({
  params,
  searchParams,
}: PageProps<"/locations/[id]/supprimer">) {
  // La session d'abord, puis la location de ce propriétaire (R28).
  const { id } = await params;
  const access = await readRentalAccess(id);

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    redirect(
      buildSignInPath(
        buildRentalPath(id, "supprimer"),
        toSearchString(await searchParams),
      ),
    );
  }
  if (access.kind === "not-found") {
    notFound();
  }

  const { rental } = access;
  // L'identifiant est lié à l'action sur le serveur, à partir de la location
  // relue en base. L'action refait tous les contrôles (../actions.ts).
  const deleteThisRental = deleteRentalAction.bind(null, rental.id);

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto max-w-7xl px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        {/* Une colonne de 640px au plus (R41). */}
        <div className="flex w-full max-w-160 flex-col gap-6">
          <h1 className="font-display text-subtitle font-bold md:text-title">
            Supprimer cette location
          </h1>
          <p>Vous allez supprimer définitivement la location suivante.</p>
          {/* La page nomme ce qui va être supprimé (R24). */}
          <RentalReminder rental={rental} />
          <p className="text-text-secondary">
            Cette action est irréversible. Pour conserver la location sans la
            supprimer, mettez-y fin.
          </p>
          {/* Pas de bouton primaire sur cette page (R40). */}
          <div className="flex flex-col gap-4">
            <ConfirmForm
              action={deleteThisRental}
              label="Supprimer définitivement"
              pendingLabel="Suppression en cours"
              buttonClassName={DESTRUCTIVE_BUTTON_LARGE_CLASSES}
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
