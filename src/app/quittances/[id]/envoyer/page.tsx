// Page d'envoi d'une quittance au locataire par e-mail (R26 et « Contenus » de
// la spécification 05). Server Component, rendu à chaque requête parce qu'il
// lit la session. L'afficher, la recharger ou la précharger n'écrit rien : seul
// le POST du formulaire envoie (CA29).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { buildSignInPath, toSearchString } from "@/auth/return-path";
import { PRIMARY_BUTTON_LARGE_CLASSES } from "@/components/button-styles";
import { getEmailConfiguration } from "@/email/send-email";
import { formatMonthLabel } from "@/receipts/receipt-months";
import { getReceiptReference } from "@/receipts/receipt-reference";
import { SEND_MESSAGES } from "@/receipts/receipt-sending-messages";
import { isSendingInProgress } from "@/receipts/receipt-sending-state";
import { formatAmount, totalInCents } from "@/rentals/rental-amount";
import { formatArchiveDate } from "@/rentals/rental-archive-text";
import { formatDate } from "@/rentals/rental-dates";

import { ConfirmForm } from "../../../locations/[id]/confirm-form";
import { readRentalAccess } from "../../../locations/rental-access";
import { DashboardHeader } from "../../../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../../../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../../../tableau-de-bord/sign-out-form";
import { buildReceiptPath, readReceiptAccess } from "../../receipt-access";
import { sendReceiptAction } from "./actions";

// Titre générique : aucune donnée personnelle dans le titre du document (R27).
export async function generateMetadata({
  params,
}: PageProps<"/quittances/[id]/envoyer">): Promise<Metadata> {
  const { id } = await params;
  const access = await readReceiptAccess(id);
  if (access.kind === "found") {
    return { title: "Envoyer la quittance — Quittances" };
  }
  if (access.kind === "not-found") {
    return { title: "Quittance introuvable — Quittances" };
  }
  return {};
}

export default async function SendReceiptPage({
  params,
  searchParams,
}: PageProps<"/quittances/[id]/envoyer">) {
  // Les états, dans l'ordre de R26 : la session, la quittance de ce
  // propriétaire (appartenance avant état), la location, puis les blocs.
  const { id } = await params;
  const access = await readReceiptAccess(id);

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    redirect(
      buildSignInPath(
        buildReceiptPath(id, "envoyer"),
        toSearchString(await searchParams),
      ),
    );
  }
  if (access.kind === "not-found") {
    notFound();
  }

  const { owner, receipt } = access;
  const rentalPath = `/locations/${receipt.rentalId}`;

  const rentalAccess = await readRentalAccess(receipt.rentalId);
  if (rentalAccess.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (rentalAccess.kind !== "found") {
    // Location disparue entre les deux lectures, ou session perdue : la
    // quittance n'est plus atteignable.
    notFound();
  }
  const { rental } = rentalAccess;
  if (rental.archivedAt !== null) {
    // Consultation seule (R14) : retour au détail, sans message.
    redirect(rentalPath);
  }

  const alreadySent = receipt.emailSentAt !== null;
  const now = new Date();

  // Un seul état est affiché, le premier qui s'applique.
  let content: ReactNode;
  if (rental.emailConsentAt === null) {
    content = (
      <>
        <p>
          Le locataire n&apos;a pas donné son accord pour recevoir ses
          quittances par e-mail. Si c&apos;est le cas, indiquez-le dans la
          location. Sinon, téléchargez la quittance et remettez-la vous-même.
        </p>
        <div className="flex flex-col items-start gap-4">
          <Link href={`${rentalPath}/modifier`} className="text-primary underline">
            Modifier la location
          </Link>
          {/* Un <a> natif : cette adresse est un fichier, servi par un Route
              Handler (voir receipt-list). */}
          <a href={`/quittances/${receipt.id}/pdf`} className="text-primary underline">
            Télécharger la quittance
          </a>
          <Link href={rentalPath} className="text-primary underline">
            Retour à la location
          </Link>
        </div>
      </>
    );
  } else if (isSendingInProgress(receipt, now)) {
    content = (
      <>
        <p>Un envoi de cette quittance est en cours. Revenez dans un instant.</p>
        <Link href={rentalPath} className="self-start text-primary underline">
          Retour à la location
        </Link>
      </>
    );
  } else if (getEmailConfiguration() === null) {
    content = (
      <>
        <p>{SEND_MESSAGES.M4}</p>
        <Link href={rentalPath} className="self-start text-primary underline">
          Retour à la location
        </Link>
      </>
    );
  } else {
    // L'identifiant est lié à l'action sur le serveur, à partir de la
    // quittance relue en base ; l'action refait tous les contrôles.
    const sendThisReceipt = sendReceiptAction.bind(null, receipt.id);
    content = (
      <>
        <p>
          Vous allez envoyer la quittance suivante par e-mail à votre locataire.
        </p>
        {/* wrap-anywhere : une adresse très longue passe à la ligne. */}
        <p className="wrap-anywhere">
          <span className="block">
            {formatMonthLabel(receipt.month)}, du {formatDate(receipt.periodStart)}{" "}
            au {formatDate(receipt.periodEnd)}
          </span>
          <span className="block">{receipt.tenantName}</span>
          {/* L'adresse courante de la location : c'est là que le message part. */}
          <span className="block">Adresse e-mail : {rental.tenantEmail}</span>
          <span className="block">
            <span className="whitespace-nowrap tabular-nums">
              {formatAmount(
                totalInCents(receipt.rentInCents, receipt.chargesInCents),
              )}
            </span>{" "}
            charges comprises
          </span>
          <span className="block">
            Référence{" "}
            <span className="font-mono">
              {getReceiptReference(receipt.id, receipt.month)}
            </span>
          </span>
        </p>
        <p className="wrap-anywhere text-text-secondary">
          Le PDF de la quittance est joint au message. Votre locataire pourra
          vous répondre à {owner.email}.
        </p>
        {receipt.emailSentAt === null ? null : (
          <p className="wrap-anywhere">
            Cette quittance a déjà été envoyée le{" "}
            {formatArchiveDate(receipt.emailSentAt)} à {receipt.emailSentTo}. Le
            renvoi enverra un second message.
          </p>
        )}
        <div className="flex flex-col gap-4">
          {/* Seul élément primaire de la page. */}
          <ConfirmForm
            action={sendThisReceipt}
            label={alreadySent ? "Renvoyer la quittance" : "Envoyer la quittance"}
            pendingLabel="Envoi en cours"
            buttonClassName={PRIMARY_BUTTON_LARGE_CLASSES}
          />
          <Link href={rentalPath} className="self-start text-primary underline">
            Annuler
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto max-w-7xl px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        {/* Une colonne de 640px au plus. */}
        <div className="flex w-full max-w-160 flex-col gap-6">
          <h1 className="font-display text-subtitle font-bold md:text-title">
            {alreadySent ? "Renvoyer cette quittance" : "Envoyer cette quittance"}
          </h1>
          {content}
        </div>
      </main>
    </>
  );
}
