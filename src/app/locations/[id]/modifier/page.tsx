// Page de modification d'une location (spécification 03, « Formulaire de
// location »). Server Component, rendu à chaque requête parce qu'il lit la
// session. Il contrôle l'accès, lit la location et préremplit le formulaire ;
// seuls le formulaire et l'en-tête sont des Client Components.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { buildSignInPath, toSearchString } from "@/auth/return-path";
import { toRentalFormFields } from "@/rentals/rental-validation";

import { DashboardHeader } from "../../../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../../../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../../../tableau-de-bord/sign-out-form";
import { buildRentalPath, readRentalAccess } from "../../rental-access";
import { updateRentalAction } from "../actions";
import { UpdateRentalForm } from "./update-rental-form";

// Titre générique (R43). readRentalAccess est mémorisée le temps de la
// requête : le titre et la page partagent le même contrôle et la même lecture.
export async function generateMetadata({
  params,
}: PageProps<"/locations/[id]/modifier">): Promise<Metadata> {
  const { id } = await params;
  const access = await readRentalAccess(id);
  if (access.kind === "found") {
    return { title: "Modifier la location — Quittances" };
  }
  if (access.kind === "not-found") {
    return { title: "Location introuvable — Quittances" };
  }
  return {};
}

export default async function UpdateRentalPage({
  params,
  searchParams,
}: PageProps<"/locations/[id]/modifier">) {
  // `id` vient de l'adresse, donc du visiteur : readRentalAccess contrôle la
  // session, puis lit la location de ce propriétaire et d'aucun autre.
  const { id } = await params;
  const access = await readRentalAccess(id);

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    redirect(
      buildSignInPath(
        buildRentalPath(id, "modifier"),
        toSearchString(await searchParams),
      ),
    );
  }
  if (access.kind === "not-found") {
    // 404 et écran de ../not-found.tsx, le même que pour le détail (R5).
    notFound();
  }

  const { rental } = access;
  // Une location archivée est en consultation seule (R39 de la spécification
  // 04) : la page ne s'applique pas, retour au détail, sans message (R40). Ce
  // contrôle vient après celui de l'appartenance : un autre compte a déjà reçu
  // « Location introuvable » et n'apprend rien de l'état d'archivage.
  if (rental.archivedAt !== null) {
    redirect(`/locations/${rental.id}`);
  }
  // L'identifiant est lié à l'action ici, sur le serveur, à partir de la
  // location relue en base : il ne figure dans aucun champ du formulaire.
  // L'action reçoit (rentalId, étatPrécédent, formulaire). Elle refait tous les
  // contrôles : voir ../actions.ts.
  const action = updateRentalAction.bind(null, rental.id);

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <h1 className="font-display text-subtitle font-bold md:text-title">
          Modifier la location
        </h1>
        <UpdateRentalForm
          action={action}
          // Valeurs de départ : celles de la base, dans la forme des champs
          // (« 1250,50 », « 2026-01-05 »). La date de fin n'en fait pas partie.
          initialState={{ fields: toRentalFormFields(rental, rental.emailConsentAt !== null), errors: {} }}
          cancelHref={`/locations/${rental.id}`}
        />
      </main>
    </>
  );
}
