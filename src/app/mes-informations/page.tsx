// Page « Mes informations » (R1 à R5 de la spécification 04) : le nom et
// l'adresse du bailleur, qui figurent sur les quittances.
// Server Component, rendu à chaque requête parce qu'il lit la session. Il
// contrôle l'accès, lit les informations du propriétaire courant et préremplit
// le formulaire ; seuls le formulaire et l'en-tête sont des Client Components.
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { buildSignInPath, toSearchString } from "@/auth/return-path";
import { toLandlordFormState } from "@/receipts/landlord-form-state";
import { LANDLORD_PATH } from "@/receipts/landlord-path";

import { readOwnerAccess } from "../locations/rental-access";
import { DashboardHeader } from "../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../tableau-de-bord/sign-out-form";
import { LandlordForm } from "./landlord-form";
import { readLandlord } from "./read-landlord";

// Un visiteur non connecté ne reçoit pas même le titre de la page.
export async function generateMetadata(): Promise<Metadata> {
  const access = await readOwnerAccess();
  if (access.kind !== "signed-in") {
    return {};
  }
  return { title: "Mes informations — Quittances" };
}

export default async function LandlordPage({
  searchParams,
}: PageProps<"/mes-informations">) {
  // La page vérifie elle-même la session (R21) ; l'action d'enregistrement la
  // vérifiera de nouveau à l'envoi.
  const access = await readOwnerAccess();

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    redirect(buildSignInPath(LANDLORD_PATH, toSearchString(await searchParams)));
  }

  // Seule lecture de la page : les informations du propriétaire courant.
  const landlord = await readLandlord(access.owner);
  if (landlord === "unavailable") {
    // Des informations illisibles ne sont jamais rendues comme un formulaire
    // vide : enregistrer par-dessus effacerait ce qui existe.
    return <ServiceUnavailable />;
  }

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto max-w-7xl px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        {/* Une colonne de 640px au plus (R36). */}
        <div className="flex w-full max-w-160 flex-col gap-6">
          <h1 className="font-display text-subtitle font-bold md:text-title">
            Mes informations
          </h1>
          <p className="text-text-secondary">
            Votre nom et votre adresse figurent sur les quittances que vous
            produisez. Une quittance déjà produite garde les informations du
            jour de sa production.
          </p>
          <LandlordForm initialState={toLandlordFormState(landlord)} />
        </div>
      </main>
    </>
  );
}
