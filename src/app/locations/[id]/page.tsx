// Détail d'une location (spécification 03, « Page /locations/<id> »), active ou
// archivée : la même adresse, deux présentations (R39 de la spécification 04).
// Une location archivée est en consultation seule : un bandeau, ses quittances
// téléchargeables, et deux gestes, restaurer ou supprimer définitivement.
// Server Component, rendu à chaque requête : ce qu'il affiche dépend de la
// session, et la lire suffit à ce que Next ne pré-rende pas la page. C'est la
// seule page de lecture où l'adresse e-mail du locataire apparaît (R43).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  buildSignInPath,
  DASHBOARD_PATH,
  toSearchString,
} from "@/auth/return-path";
import { PRIMARY_BUTTON_LINK_CLASSES } from "@/components/button-styles";
import { RentalStatusChip } from "@/components/rental-status-chip";
import { ARCHIVES_PATH } from "@/rentals/archives-path";
import { formatAmount, totalInCents } from "@/rentals/rental-amount";
import { isRentalArchivable } from "@/rentals/rental-archivable";
import { formatArchiveDate } from "@/rentals/rental-archive-text";
import {
  formatDate,
  getRentalStatus,
  getTodayInParis,
} from "@/rentals/rental-dates";
import { formatDueDay } from "@/rentals/rental-due-day";

import { DashboardHeader } from "../../tableau-de-bord/dashboard-header";
import { ServiceUnavailable } from "../../tableau-de-bord/service-unavailable";
import { SignOutForm } from "../../tableau-de-bord/sign-out-form";
import { buildRentalPath, readRentalAccess } from "../rental-access";
import { restoreRentalAction } from "./actions";
import { ReceiptList } from "./receipt-list";
import { ActiveRentalActions, ArchivedRentalActions } from "./rental-actions";
import { readRentalReceipts } from "./rental-receipts";

// Titres génériques : jamais une adresse ni un nom de locataire dans le titre
// du document (R43). Un visiteur non connecté ne reçoit que le titre du site.
// readRentalAccess est mémorisée le temps de la requête : le titre et la page
// partagent le même contrôle et la même lecture.
export async function generateMetadata({
  params,
}: PageProps<"/locations/[id]">): Promise<Metadata> {
  const { id } = await params;
  const access = await readRentalAccess(id);
  if (access.kind === "found") {
    return { title: "Location — Quittances" };
  }
  if (access.kind === "not-found") {
    return { title: "Location introuvable — Quittances" };
  }
  return {};
}

export default async function RentalPage({
  params,
  searchParams,
}: PageProps<"/locations/[id]">) {
  // `id` vient de l'adresse, donc du visiteur. Il n'est jamais utilisé ici
  // directement : readRentalAccess contrôle la session, puis lit la location de
  // ce propriétaire et d'aucun autre.
  const { id } = await params;
  const access = await readRentalAccess(id);

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    // Même redirection que l'identifiant existe ou non : aucune location n'a
    // été lue (R28).
    redirect(
      buildSignInPath(buildRentalPath(id), toSearchString(await searchParams)),
    );
  }
  if (access.kind === "not-found") {
    // Code HTTP 404 et écran de ./not-found.tsx : la même réponse pour la
    // location d'un autre compte, une location inexistante et un identifiant
    // mal formé (R5). Le code 404 est possible parce que rien n'a encore été
    // envoyé : la page n'a ni loading.tsx ni <Suspense> au-dessus d'elle.
    // Limite mesurée sur cette version de Next : le document de cette réponse
    // est vide, et c'est JavaScript qui y dessine l'écran.
    notFound();
  }

  const { owner, rental } = access;
  // Les quittances de cette location, pour ce propriétaire (spécification 04).
  // Une liste illisible n'est jamais rendue comme « Aucune quittance ».
  const receipts = await readRentalReceipts(owner, rental.id);
  if (receipts === "unavailable") {
    return <ServiceUnavailable />;
  }
  // R43 de la spécification 04 : une location ne se supprime directement que si
  // elle n'a aucune quittance. Ce n'est qu'un affichage : la condition est
  // recontrôlée par l'écriture elle-même.
  const hasReceipts = receipts.length > 0;
  // Un seul instant pour toute la page, lu sur l'horloge du serveur : le statut
  // et le lien « Archiver » ne peuvent pas se contredire autour de minuit.
  const now = new Date();
  // Le statut se calcule sur le serveur, à la date du jour à Paris (R20).
  const status = getRentalStatus(rental.endDate, getTodayInParis(now));
  // R39 : seule une location terminée peut être archivée. Même règle que le
  // statut, et même horloge : celle du serveur, jamais celle du navigateur.
  const isArchivable = isRentalArchivable(rental.endDate, now);
  // null tant que la location est active. Tout ce qui suit est décidé ici,
  // après le contrôle d'appartenance : un autre compte a déjà reçu « Location
  // introuvable » et n'apprend rien de l'état d'archivage (R40).
  const archivedAt = rental.archivedAt;
  // Les liens sont construits avec l'identifiant lu en base, pas avec celui de
  // l'adresse.
  const rentalPath = `/locations/${rental.id}`;

  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto max-w-7xl px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        {/* Une colonne de 640px au plus (R41). */}
        <div className="flex w-full max-w-160 flex-col gap-8">
          <div className="flex flex-col gap-4">
            {/* On revient d'où la location est rangée. */}
            {archivedAt === null ? (
              <Link
                href={DASHBOARD_PATH}
                className="self-start text-primary underline"
              >
                Retour au tableau de bord
              </Link>
            ) : (
              <Link
                href={ARCHIVES_PATH}
                className="self-start text-primary underline"
              >
                Retour aux archives
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {/* min-w-0 et wrap-anywhere : une adresse très longue passe à la
                  ligne au lieu de créer un défilement horizontal. */}
              <h1 className="min-w-0 wrap-anywhere font-display text-subtitle font-bold md:text-title">
                {rental.address}
              </h1>
              {/* Toujours « Terminée » pour une location archivée : la base
                  garantit qu'elle l'était à son archivage (R39). */}
              <RentalStatusChip status={status} />
            </div>
            {/* Bandeau d'une location archivée : un texte dans une carte
                bordée, sans couleur sémantique (R36). Il dit sans détour
                qu'archiver n'est pas effacer (R37). */}
            {archivedAt === null ? null : (
              <p className="rounded-xl border border-border bg-surface p-4">
                Location archivée le {formatArchiveDate(archivedAt)}. Elle
                n&apos;apparaît plus au tableau de bord et ne peut plus être
                modifiée. Restaurez-la pour la modifier ou produire une
                quittance.
              </p>
            )}
          </div>

          <DetailGroup title="Le logement">
            <DetailRow label="Adresse">{rental.address}</DetailRow>
            {rental.addressComplement ? (
              <DetailRow label="Complément d'adresse">
                {rental.addressComplement}
              </DetailRow>
            ) : null}
            <DetailRow label="Code postal et ville">
              {rental.postalCode} {rental.city}
            </DetailRow>
          </DetailGroup>

          <DetailGroup title="Le locataire">
            <DetailRow label="Nom">{rental.tenantName}</DetailRow>
            <DetailRow label="Adresse e-mail">{rental.tenantEmail}</DetailRow>
          </DetailGroup>

          <DetailGroup title="Le loyer et le bail">
            <DetailRow label="Loyer hors charges">
              <Amount cents={rental.rentInCents} />
            </DetailRow>
            <DetailRow label="Charges">
              <Amount cents={rental.chargesInCents} />
            </DetailRow>
            <DetailRow label="Total charges comprises">
              <Amount
                cents={totalInCents(rental.rentInCents, rental.chargesInCents)}
              />
            </DetailRow>
            <DetailRow label="Jour d'échéance">
              {formatDueDay(rental.dueDay)}
            </DetailRow>
            <DetailRow label="Date de début du bail">
              {formatDate(rental.startDate)}
            </DetailRow>
            {rental.endDate ? (
              <DetailRow label="Date de fin du bail">
                {formatDate(rental.endDate)}
              </DetailRow>
            ) : null}
          </DetailGroup>

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-display text-body font-bold">Quittances</h2>
              {/* Seul élément primaire de la page (R36 de la spécification 04).
                  Absent d'une location archivée : on n'y produit rien (R39). */}
              {archivedAt === null ? (
                <Link
                  href={`${rentalPath}/quittances/nouvelle`}
                  className={PRIMARY_BUTTON_LINK_CLASSES}
                >
                  Produire une quittance
                </Link>
              ) : null}
            </div>
            {hasReceipts ? (
              // Archivée : les quittances restent téléchargeables, mais ne se
              // suppriment pas.
              <ReceiptList receipts={receipts} canDelete={archivedAt === null} />
            ) : (
              <p className="text-text-secondary">
                Aucune quittance pour cette location.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-display text-body font-bold">Actions</h2>
            {archivedAt === null ? (
              <ActiveRentalActions
                rentalPath={rentalPath}
                hasEndDate={rental.endDate !== null}
                isArchivable={isArchivable}
                hasReceipts={hasReceipts}
              />
            ) : (
              <ArchivedRentalActions
                rentalPath={rentalPath}
                // L'identifiant est lié à l'action sur le serveur, à partir de
                // la location relue en base. Il voyage ensuite par le
                // navigateur, en clair : l'action refait tous les contrôles.
                restoreAction={restoreRentalAction.bind(null, rental.id)}
              />
            )}
          </section>
        </div>
      </main>
    </>
  );
}

type DetailGroupProps = {
  title: string;
  children: ReactNode;
};

// Un groupe d'informations : son nom, puis une liste de description (R41).
function DetailGroup({ title, children }: DetailGroupProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-body font-bold">{title}</h2>
      <dl className="flex flex-col gap-4">{children}</dl>
    </section>
  );
}

type DetailRowProps = {
  label: string;
  children: ReactNode;
};

// Une paire libellé et valeur. La valeur est toujours rendue comme du texte :
// React échappe « < » et « & », rien de ce qu'un propriétaire a saisi n'est
// interprété comme du HTML (R11).
function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="flex flex-col">
      <dt className="text-small text-text-secondary">{label}</dt>
      <dd className="wrap-anywhere">{children}</dd>
    </div>
  );
}

// Un montant ne se coupe jamais sur deux lignes, et ses chiffres sont
// tabulaires (R16).
function Amount({ cents }: { cents: number }) {
  return (
    <span className="whitespace-nowrap tabular-nums">{formatAmount(cents)}</span>
  );
}
