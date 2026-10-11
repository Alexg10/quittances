// Page de création d'une location (spécification 03, « Formulaire de
// location »). Server Component, rendu à chaque requête parce qu'il lit la
// session : il la vérifie et pose le titre ; seuls le formulaire et l'en-tête
// sont des Client Components.
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { buildSignInPath, toSearchString } from "@/auth/return-path";

import { DashboardHeader } from "../../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../../tableau-de-bord/sign-out-form";
import { buildRentalPath, readOwnerAccess } from "../rental-access";
import { CreateRentalForm } from "./create-rental-form";

// Un visiteur non connecté ne reçoit pas même le titre de la page (R28).
export async function generateMetadata(): Promise<Metadata> {
  const access = await readOwnerAccess();
  if (access.kind !== "signed-in") {
    return {};
  }
  return { title: "Ajouter une location — Quittances" };
}

export default async function NewRentalPage({
  searchParams,
}: PageProps<"/locations/nouvelle">) {
  // La page vérifie elle-même la session (R28) ; l'action de création la
  // vérifiera de nouveau à l'envoi.
  const access = await readOwnerAccess();

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    redirect(
      buildSignInPath(
        buildRentalPath("nouvelle"),
        toSearchString(await searchParams),
      ),
    );
  }

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <h1 className="font-display text-subtitle font-bold md:text-title">
          Ajouter une location
        </h1>
        <CreateRentalForm />
      </main>
    </>
  );
}
