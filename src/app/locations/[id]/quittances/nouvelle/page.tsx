// Page de production d'une quittance (R25 de la spécification 04).
// Server Component, rendu à chaque requête parce qu'il lit la session. Il
// contrôle l'accès, puis affiche le premier état qui s'applique, dans cet
// ordre : informations du bailleur manquantes, bail à venir, rien à produire,
// formulaire. Seuls le formulaire et l'en-tête sont des Client Components.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { buildSignInPath, toSearchString } from "@/auth/return-path";
import { PRIMARY_BUTTON_LINK_CLASSES } from "@/components/button-styles";
import { LANDLORD_PATH } from "@/receipts/landlord-path";
import { getProductionState } from "@/receipts/receipt-production";
import { formatAmountForInput } from "@/rentals/rental-amount";
import { formatDate } from "@/rentals/rental-dates";
import type { Rental } from "@/rentals/rental-store";

import { readLandlord } from "../../../../mes-informations/read-landlord";
import { DashboardHeader } from "../../../../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../../../../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../../../../tableau-de-bord/sign-out-form";
import { buildRentalPath, readRentalAccess } from "../../../rental-access";
import { produceReceiptAction } from "../../actions";
import { RentalReminder } from "../../rental-reminder";
import { readRentalReceipts } from "../../rental-receipts";
import { ReceiptForm } from "./receipt-form";

// Titre générique : jamais une adresse ni un nom dans le titre du document
// (R37). Partagé avec la page par readRentalAccess, mémorisée par requête.
export async function generateMetadata({
  params,
}: PageProps<"/locations/[id]/quittances/nouvelle">): Promise<Metadata> {
  const { id } = await params;
  const access = await readRentalAccess(id);
  if (access.kind === "found") {
    return { title: "Produire une quittance — Quittances" };
  }
  if (access.kind === "not-found") {
    return { title: "Location introuvable — Quittances" };
  }
  return {};
}

export default async function NewReceiptPage({
  params,
  searchParams,
}: PageProps<"/locations/[id]/quittances/nouvelle">) {
  // 1. La session, puis 2. la location de ce propriétaire (R25).
  const { id } = await params;
  const access = await readRentalAccess(id);

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    redirect(
      buildSignInPath(
        buildRentalPath(id, "quittances", "nouvelle"),
        toSearchString(await searchParams),
      ),
    );
  }
  if (access.kind === "not-found") {
    // 404 et écran « Location introuvable », le même que pour le détail.
    notFound();
  }

  const { owner, rental } = access;
  const rentalPath = `/locations/${rental.id}`;
  // Une location archivée ne reçoit pas de quittance : retour à son détail,
  // sans message (R40).
  if (rental.archivedAt !== null) {
    redirect(rentalPath);
  }

  // 3. Sans informations du bailleur, pas de quittance (R4).
  const landlord = await readLandlord(owner);
  if (landlord === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (landlord === null) {
    return (
      <ProductionLayout rental={rental}>
        <p>
          Avant de produire votre première quittance, renseignez votre nom et
          votre adresse. Ils figureront sur le document.
        </p>
        <div className="flex flex-col items-start gap-4">
          {/* Seul élément primaire de la page (R36). */}
          <Link href={LANDLORD_PATH} className={PRIMARY_BUTTON_LINK_CLASSES}>
            Renseigner mes informations
          </Link>
          <Link href={rentalPath} className="text-primary underline">
            Annuler
          </Link>
        </div>
      </ProductionLayout>
    );
  }

  // 4 à 6. Les mois encore disponibles, calculés sur le serveur à l'instant de
  // la requête. Une liste de quittances illisible n'est jamais lue comme
  // « aucune quittance » : elle proposerait des mois déjà pris.
  const receipts = await readRentalReceipts(owner, rental.id);
  if (receipts === "unavailable") {
    return <ServiceUnavailable />;
  }
  const production = getProductionState(
    rental.startDate,
    rental.endDate,
    receipts.map((receipt) => receipt.month),
    new Date(),
  );

  if (production.kind === "lease-not-started") {
    return (
      <ProductionLayout rental={rental}>
        <p>
          Le bail commence le {formatDate(rental.startDate)}. Aucune quittance
          ne peut être produite avant ce mois.
        </p>
        <BackToRentalLink href={rentalPath} />
      </ProductionLayout>
    );
  }
  if (production.kind === "nothing-to-produce") {
    return (
      <ProductionLayout rental={rental}>
        <p>Tous les mois écoulés de cette location ont déjà une quittance.</p>
        <BackToRentalLink href={rentalPath} />
      </ProductionLayout>
    );
  }

  // L'identifiant est lié à l'action ici, sur le serveur, à partir de la
  // location relue en base : il ne figure dans aucun champ du formulaire. Il
  // voyage quand même par le navigateur, en clair : l'action ne lui fait pas
  // confiance et refait tous les contrôles (voir ../../actions.ts).
  const action = produceReceiptAction.bind(null, rental.id);

  return (
    <ProductionLayout rental={rental}>
      <p>
        Le nom et l&apos;adresse du bailleur, le nom du locataire et
        l&apos;adresse du logement sont copiés dans la quittance tels
        qu&apos;ils sont enregistrés aujourd&apos;hui.
      </p>
      <ReceiptForm
        action={action}
        initialState={{
          fields: {
            // Le plus récent des mois proposés.
            month: production.months[0].value,
            // Les montants de la location, dans la forme d'un champ
            // (« 850,00 »). Modifiables, ils ne changent jamais la location.
            rent: formatAmountForInput(rental.rentInCents),
            charges: formatAmountForInput(rental.chargesInCents),
            paymentDate: "",
            attestation: "",
          },
          errors: {},
        }}
        months={production.months}
        cancelHref={rentalPath}
      />
    </ProductionLayout>
  );
}

type ProductionLayoutProps = {
  rental: Rental;
  // Le bloc propre à l'état affiché.
  children: ReactNode;
};

// Ce que les quatre états de la page ont en commun : l'en-tête, le titre et le
// rappel de la location.
function ProductionLayout({ rental, children }: ProductionLayoutProps) {
  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto max-w-7xl px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        {/* Une colonne de 640px au plus (R36). */}
        <div className="flex w-full max-w-160 flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-subtitle font-bold md:text-title">
              Produire une quittance
            </h1>
            <RentalReminder rental={rental} muted />
          </div>
          {children}
        </div>
      </main>
    </>
  );
}

function BackToRentalLink({ href }: { href: string }) {
  return (
    <Link href={href} className="self-start text-primary underline">
      Retour à la location
    </Link>
  );
}
