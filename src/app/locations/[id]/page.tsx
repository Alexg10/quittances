// Détail d'une location (spécification 03, « Page /locations/<id> »).
// Server Component, rendu à chaque requête : ce qu'il affiche dépend de la
// session. C'est la seule page de lecture où l'adresse e-mail du locataire
// apparaît (R43).
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  buildSignInPath,
  DASHBOARD_PATH,
  toSearchString,
} from "@/auth/return-path";
import {
  DESTRUCTIVE_BUTTON_SMALL_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from "@/components/button-styles";
import { RentalStatusChip } from "@/components/rental-status-chip";
import { formatAmount, totalInCents } from "@/rentals/rental-amount";
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
import { RentalNotFound } from "../rental-not-found";

// Rendu bloquant, comme /tableau-de-bord (R30) : tout s'affiche sans
// JavaScript, et rien n'est envoyé au navigateur avant que la session et la
// location aient été contrôlées.
export const instant = false;

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
    // Le même écran pour la location d'un autre compte, une location inexistante
    // et un identifiant mal formé (R5). Il est rendu comme un contenu ordinaire
    // plutôt que par notFound() : mesuré sur cette version de Next, notFound()
    // répond ici par un document vide que seul JavaScript remplit, et avec le
    // code 200 (la page est reprise d'une coque pré-rendue, `cacheComponents`).
    return <RentalNotFound />;
  }

  const { rental } = access;
  // Le statut se calcule sur le serveur, à la date du jour à Paris (R20).
  const status = getRentalStatus(rental.endDate, getTodayInParis(new Date()));
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
            <Link
              href={DASHBOARD_PATH}
              className="self-start text-primary underline"
            >
              Retour au tableau de bord
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              {/* min-w-0 et wrap-anywhere : une adresse très longue passe à la
                  ligne au lieu de créer un défilement horizontal. */}
              <h1 className="min-w-0 wrap-anywhere font-display text-subtitle font-bold md:text-title">
                {rental.address}
              </h1>
              <RentalStatusChip status={status} />
            </div>
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
            <h2 className="font-display text-body font-bold">Actions</h2>
            {/* Trois liens, pas des boutons : chacun mène à une page (R40).
                Aucun n'agit par lui-même : afficher ou précharger une page ne
                modifie jamais rien (R24). */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`${rentalPath}/modifier`}
                className={SECONDARY_BUTTON_CLASSES}
              >
                Modifier
              </Link>
              <Link
                href={`${rentalPath}/fin`}
                className={SECONDARY_BUTTON_CLASSES}
              >
                {rental.endDate
                  ? "Modifier la fin de la location"
                  : "Mettre fin à la location"}
              </Link>
              <Link
                href={`${rentalPath}/supprimer`}
                className={DESTRUCTIVE_BUTTON_SMALL_CLASSES}
              >
                Supprimer
              </Link>
            </div>
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
