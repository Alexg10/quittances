// Page de confirmation de la suppression d'une quittance (R18 de la
// spécification 04). Une page, et non une boîte de dialogue : elle fonctionne à
// l'identique avec et sans JavaScript. L'afficher, la recharger ou la
// précharger ne supprime rien : seul l'envoi en POST de son formulaire le fait.
// Server Component, rendu à chaque requête parce qu'il lit la session.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buildSignInPath, toSearchString } from "@/auth/return-path";
import { DESTRUCTIVE_BUTTON_LARGE_CLASSES } from "@/components/button-styles";
import { formatArchiveDate } from "@/rentals/rental-archive-text";

import { ConfirmForm } from "../../../locations/[id]/confirm-form";
import { readRentalAccess } from "../../../locations/rental-access";
import { DashboardHeader } from "../../../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../../../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../../../tableau-de-bord/sign-out-form";
import { buildReceiptPath, readReceiptAccess } from "../../receipt-access";
import { deleteReceiptAction } from "./actions";
import { ReceiptReminder } from "./receipt-reminder";

// Titre générique : ni mois, ni nom, ni adresse dans le titre du document
// (R37). Partagé avec la page par readReceiptAccess, mémorisée par requête.
export async function generateMetadata({
  params,
}: PageProps<"/quittances/[id]/supprimer">): Promise<Metadata> {
  const { id } = await params;
  const access = await readReceiptAccess(id);
  if (access.kind === "found") {
    return { title: "Supprimer la quittance — Quittances" };
  }
  if (access.kind === "not-found") {
    return { title: "Quittance introuvable — Quittances" };
  }
  return {};
}

export default async function DeleteReceiptPage({
  params,
  searchParams,
}: PageProps<"/quittances/[id]/supprimer">) {
  // La session d'abord, puis la quittance de ce propriétaire (R21).
  const { id } = await params;
  const access = await readReceiptAccess(id);

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    // Même redirection que l'identifiant existe ou non : aucune quittance n'a
    // été lue.
    redirect(
      buildSignInPath(
        buildReceiptPath(id, "supprimer"),
        toSearchString(await searchParams),
      ),
    );
  }
  if (access.kind === "not-found") {
    // Code 404 et écran « Quittance introuvable » : la même réponse pour la
    // quittance d'un autre compte, supprimée, inconnue ou mal formée (R22).
    notFound();
  }

  const { receipt } = access;
  const rentalPath = `/locations/${receipt.rentalId}`;

  // Une quittance ne se supprime pas tant que sa location est archivée (R18) :
  // la page ne s'applique pas, retour au détail de la location (R40). La
  // location est lue pour ce même propriétaire ; l'action de suppression porte
  // la même condition dans son écriture.
  const rentalAccess = await readRentalAccess(receipt.rentalId);
  if (rentalAccess.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (rentalAccess.kind === "found" && rentalAccess.rental.archivedAt !== null) {
    redirect(rentalPath);
  }

  // L'identifiant est lié à l'action sur le serveur, à partir de la quittance
  // relue en base. L'action refait tous les contrôles (./actions.ts).
  const deleteThisReceipt = deleteReceiptAction.bind(null, receipt.id);

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto max-w-7xl px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        {/* Une colonne de 640px au plus (R36). */}
        <div className="flex w-full max-w-160 flex-col gap-6">
          <h1 className="font-display text-subtitle font-bold md:text-title">
            Supprimer cette quittance
          </h1>
          <p>Vous allez supprimer définitivement la quittance suivante.</p>
          {/* La page nomme ce qui va être supprimé, avec les valeurs figées. */}
          <ReceiptReminder receipt={receipt} />
          {/* Quittance déjà envoyée (R13 de la spécification 05) : la trace
              disparaît avec elle, le message reste chez le locataire. */}
          {receipt.emailSentAt === null ? null : (
            <p className="wrap-anywhere">
              Cette quittance a été envoyée par e-mail à {receipt.emailSentTo}{" "}
              le {formatArchiveDate(receipt.emailSentAt)}. La supprimer ici ne
              la retire pas de la messagerie de votre locataire, et
              l&apos;application n&apos;en gardera aucune trace.
            </p>
          )}
          <p className="text-text-secondary">
            Cette action est irréversible. Si vous avez déjà remis cette
            quittance à votre locataire, la supprimer ici ne la lui retire pas.
            Vous pourrez produire une nouvelle quittance pour ce mois.
          </p>
          {/* Pas de bouton primaire sur cette page (R36). */}
          <div className="flex flex-col gap-4">
            <ConfirmForm
              action={deleteThisReceipt}
              label="Supprimer définitivement"
              pendingLabel="Suppression en cours"
              buttonClassName={DESTRUCTIVE_BUTTON_LARGE_CLASSES}
            />
            <Link href={rentalPath} className="self-start text-primary underline">
              Annuler
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
