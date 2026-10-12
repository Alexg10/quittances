// Page « Fin de la location » (R21 de la spécification 03) : poser ou modifier
// la date de fin, et rouvrir la location quand elle en a une.
// Server Component, rendu à chaque requête parce qu'il lit la session. Seuls
// les deux formulaires et l'en-tête sont des Client Components.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { buildSignInPath, toSearchString } from "@/auth/return-path";
import { SECONDARY_BUTTON_CLASSES } from "@/components/button-styles";

import { DashboardHeader } from "../../../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../../../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../../../tableau-de-bord/sign-out-form";
import { buildRentalPath, readRentalAccess } from "../../rental-access";
import { reopenRentalAction, setRentalEndDateAction } from "../actions";
import { ConfirmForm } from "../confirm-form";
import { RentalReminder } from "../rental-reminder";
import { EndDateForm } from "./end-date-form";

// Titre générique (R43), partagé avec la page par readRentalAccess.
export async function generateMetadata({
  params,
}: PageProps<"/locations/[id]/fin">): Promise<Metadata> {
  const { id } = await params;
  const access = await readRentalAccess(id);
  if (access.kind === "found") {
    return { title: "Fin de la location — Quittances" };
  }
  if (access.kind === "not-found") {
    return { title: "Location introuvable — Quittances" };
  }
  return {};
}

export default async function RentalEndPage({
  params,
  searchParams,
}: PageProps<"/locations/[id]/fin">) {
  // La session d'abord, puis la location de ce propriétaire (R28).
  const { id } = await params;
  const access = await readRentalAccess(id);

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    redirect(
      buildSignInPath(
        buildRentalPath(id, "fin"),
        toSearchString(await searchParams),
      ),
    );
  }
  if (access.kind === "not-found") {
    notFound();
  }

  const { rental } = access;
  // Une location archivée est en consultation seule (R39 de la spécification
  // 04) : ni date de fin ni réouverture. La page ne s'applique pas, retour au
  // détail, sans message (R40), après le contrôle d'appartenance.
  if (rental.archivedAt !== null) {
    redirect(`/locations/${rental.id}`);
  }
  // L'identifiant est lié aux deux actions sur le serveur, à partir de la
  // location relue en base. Elles refont tous les contrôles (../actions.ts).
  const setEndDate = setRentalEndDateAction.bind(null, rental.id);
  const reopen = reopenRentalAction.bind(null, rental.id);

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto max-w-7xl px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        {/* Une colonne de 640px au plus (R41). */}
        <div className="flex w-full max-w-160 flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-subtitle font-bold md:text-title">
              Fin de la location
            </h1>
            <RentalReminder rental={rental} muted />
            <p>
              La location reste dans votre compte. Elle passe au statut Terminée
              le lendemain de la date de fin.
            </p>
          </div>

          <EndDateForm
            action={setEndDate}
            // Vide sans date de fin, prérempli sinon.
            initialEndDate={rental.endDate ?? ""}
            cancelHref={`/locations/${rental.id}`}
          />

          {/* Seulement si la location a une date de fin, passée ou à venir. */}
          {rental.endDate ? (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-body font-bold">
                Rouvrir la location
              </h2>
              <p>
                La date de fin est retirée et la location redevient En cours.
              </p>
              <ConfirmForm
                action={reopen}
                label="Rouvrir la location"
                pendingLabel="Réouverture en cours"
                buttonClassName={SECONDARY_BUTTON_CLASSES}
              />
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}
